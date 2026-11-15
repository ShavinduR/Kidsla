// Public: create an order when the customer taps "Place Order via WhatsApp".
// The server re-checks availability and recomputes every price — the browser's numbers are never trusted.
import { clientIp } from './_lib/auth.js'
import { handle, readJson, send } from './_lib/http.js'
import { fromDoc, getDb } from './_lib/db.js'
import { isOrderable } from '../src/data/products.js'
import { DISTRICTS, PAYMENT_METHODS, deliveryFeeFor } from '../src/data/site.js'
import { ID_PATTERN } from '../shared/inventory.js'

const recent = new Map() // best-effort spam guard per instance: 10 orders / 10 min / IP
const tooMany = (ip) => {
  const now = Date.now()
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 600_000)
  list.push(now)
  recent.set(ip, list)
  return list.length > 10
}

// Order numbers follow Sri Lanka time: KD-YYMM-NNN, counting up from 001 each month.
const yymm = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', year: '2-digit', month: '2-digit' }).formatToParts(new Date())
  return parts.find((p) => p.type === 'year').value + parts.find((p) => p.type === 'month').value
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default handle(['POST'], async (req, res) => {
  if (tooMany(clientIp(req))) return send(res, 429, { error: 'Too many orders from this device. Please message us on WhatsApp.' })
  const body = await readJson(req)
  if (!body) return send(res, 400, { error: 'Invalid request' })

  const customer = {
    name: str(body.customer?.name, 80),
    address: str(body.customer?.address, 300),
    district: str(body.customer?.district, 40),
    payment: str(body.customer?.payment, 10),
  }
  if (customer.name.length < 2) return send(res, 400, { error: 'Please enter your name' })
  if (customer.address.length < 10) return send(res, 400, { error: 'Please enter your full address' })
  if (!DISTRICTS.includes(customer.district)) return send(res, 400, { error: 'Please choose your district' })
  if (!PAYMENT_METHODS.some((m) => m.id === customer.payment)) return send(res, 400, { error: 'Please choose a payment method' })

  const items = Array.isArray(body.items) ? body.items.slice(0, 31) : []
  if (!items.length || items.length > 30) return send(res, 400, { error: 'Your cart is empty or too large' })
  for (const it of items) {
    if (typeof it?.id !== 'string' || !ID_PATTERN.test(it.id) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20)
      return send(res, 400, { error: 'Invalid cart item' })
  }

  const db = await getDb()
  const ids = [...new Set(items.map((i) => i.id))]
  const products = new Map((await db.collection('products').find({ _id: { $in: ids } }).toArray()).map((d) => [d._id, fromDoc(d)]))

  const problems = []
  const wanted = new Map() // id|size → qty across lines
  const lines = items.map((it) => {
    const p = products.get(it.id)
    const size = str(it.size, 20)
    const color = str(it.color, 40)
    if (!p || !isOrderable(p)) problems.push({ id: it.id, size, reason: 'no longer available' })
    else if (!p.sizes.includes(size)) problems.push({ id: it.id, size, reason: 'size not available' })
    else if (!p.colors.some((c) => c.name === color)) problems.push({ id: it.id, size, reason: 'colour not available' })
    const k = `${it.id}|${size}`
    wanted.set(k, (wanted.get(k) ?? 0) + it.qty)
    return { productId: it.id, title: p?.title ?? it.id, size, color, qty: it.qty, price: p?.price ?? 0 }
  })
  for (const [k, qty] of wanted) {
    const [id, size] = k.split('|')
    if (problems.some((p) => p.id === id && p.size === size)) continue // already reported
    const left = products.get(id)?.stock?.[size] ?? 0
    if (products.get(id) && qty > left) problems.push({ id, size, reason: left ? `only ${left} left` : 'sold out', available: left })
  }
  if (problems.length) {
    return send(res, 409, {
      error: 'Some items in your cart changed. Please review them.',
      problems: problems.map((p) => ({ ...p, title: products.get(p.id)?.title ?? p.id })),
    })
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const deliveryFee = deliveryFeeFor(customer.district)
  const total = subtotal + deliveryFee

  const period = yymm()
  const counter = await db
    .collection('counters')
    .findOneAndUpdate({ _id: `order-${period}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
  const orderId = `KD-${period}-${String(counter.seq).padStart(3, '0')}`

  const now = new Date()
  await db.collection('orders').insertOne({
    _id: orderId,
    status: 'pending',
    customer,
    items: lines,
    subtotal,
    deliveryFee,
    total,
    createdAt: now,
    history: [{ status: 'pending', at: now }],
  })

  send(res, 201, { orderId, items: lines, subtotal, deliveryFee, total })
})
