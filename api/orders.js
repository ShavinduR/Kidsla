// Public: create an order when the customer taps "Place Order via WhatsApp".
// The server re-checks availability, recomputes every price (the browser's numbers are never trusted)
// and HOLDS the stock for 24 hours inside a transaction, so the last unit can't be promised twice.
import { handle, readJson, send } from './_lib/http.js'
import { fromDoc, getDb } from './_lib/db.js'
import { OrderError, createHeldOrder, releaseExpired } from './_lib/orders.js'
import { hit, ipKey, minutes } from './_lib/ratelimit.js'
import { alertNewOrder } from './_lib/alerts.js'
import { isOrderable } from '../src/data/products.js'
import { DISTRICTS, PAYMENT_METHODS, deliveryFeeFor, normalizePhone } from '../src/data/site.js'
import { getSettings } from './_lib/settings.js'
import { checkoutForm, payhereConfig } from './_lib/payhere.js'
import { siteUrl } from './_lib/catalogPublic.js'
import crypto from 'node:crypto'
import { ID_PATTERN } from '../shared/inventory.js'

// Order numbers follow Sri Lanka time: KD-YYMM-NNN, counting up from 001 each month.
const yymm = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', year: '2-digit', month: '2-digit' }).formatToParts(new Date())
  return parts.find((p) => p.type === 'year').value + parts.find((p) => p.type === 'month').value
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default handle(['POST'], async (req, res) => {
  // Shared rate limits (all server instances): per IP per 10 min, per IP per day, and site-wide per hour.
  const ip = ipKey(req)
  for (const [rule, who] of [['orderIp', ip], ['orderIpDay', ip], ['orderAll', 'all']]) {
    const r = await hit(rule, who)
    if (!r.allowed)
      return send(res, 429, { error: `Too many orders right now. Please try again in ${minutes(r.retryAfter)}, or message us on WhatsApp.` }, { 'Retry-After': String(r.retryAfter) })
  }
  const body = await readJson(req)
  if (!body) return send(res, 400, { error: 'Invalid request' })

  const settings = await getSettings()
  const customer = {
    name: str(body.customer?.name, 80),
    phone: normalizePhone(body.customer?.phone),
    email: str(body.customer?.email, 120).toLowerCase(),
    address: str(body.customer?.address, 300),
    district: str(body.customer?.district, 40),
    payment: str(body.customer?.payment, 10),
  }
  if (customer.name.length < 2) return send(res, 400, { error: 'Please enter your name', field: 'name' })
  if (!customer.phone) return send(res, 400, { error: 'Please enter a valid phone number, e.g. 077 123 4567', field: 'phone' })
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(customer.email)) return send(res, 400, { error: 'Please check your email address', field: 'email' })
  if (customer.address.length < 10) return send(res, 400, { error: 'Please enter your full address', field: 'address' })
  if (!DISTRICTS.includes(customer.district)) return send(res, 400, { error: 'Please choose your district', field: 'district' })
  const online = customer.payment === 'online'
  const enabled = PAYMENT_METHODS.some((m) => m.id === customer.payment) && settings.payments[customer.payment] && (!online || payhereConfig())
  if (!enabled) return send(res, 400, { error: 'Please choose an available payment method', field: 'payment' })
  if (online && !customer.email) return send(res, 400, { error: 'Please enter your email for the payment receipt', field: 'email' })
  if (!customer.email) delete customer.email

  const items = Array.isArray(body.items) ? body.items.slice(0, 31) : []
  if (!items.length || items.length > 30) return send(res, 400, { error: 'Your cart is empty or too large' })
  for (const it of items) {
    if (typeof it?.id !== 'string' || !ID_PATTERN.test(it.id) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20)
      return send(res, 400, { error: 'Invalid cart item' })
  }

  const db = await getDb()
  await releaseExpired(10) // free stock from abandoned orders before checking availability
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
  const deliveryFee = deliveryFeeFor(customer.district, subtotal, settings)
  const total = subtotal + deliveryFee

  // Hold the stock + assign the order number in ONE transaction: if any line is short (someone
  // else just bought it), nothing is held and no order number is used up.
  // A private link token lets this customer (only) check the order's payment status later.
  const accessToken = crypto.randomBytes(18).toString('base64url')
  const paymentStatus = online ? 'awaiting' : customer.payment === 'cod' ? 'on_delivery' : 'awaiting_transfer'
  let order
  try {
    order = await createHeldOrder({
      holdMs: online ? settings.onlineHoldMinutes * 60_000 : settings.holdHours * 3600_000,
      orderIdFor: async (database, session) => {
        const period = yymm()
        const counter = await database
          .collection('counters')
          .findOneAndUpdate({ _id: `order-${period}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
        return `KD-${period}-${String(counter.seq).padStart(3, '0')}`
      },
      doc: {
        customer,
        items: lines,
        subtotal,
        deliveryFee,
        total,
        payment: { method: customer.payment, status: paymentStatus },
        access: crypto.createHash('sha256').update(accessToken).digest('hex'),
      },
    })
  } catch (err) {
    if (err instanceof OrderError) return send(res, err.status, { error: err.message, ...err.extra })
    throw err
  }

  if (!online) alertNewOrder(order) // online orders alert when PayHere confirms payment
  send(res, 201, {
    orderId: order._id,
    accessToken,
    items: lines,
    subtotal,
    deliveryFee,
    total,
    payment: customer.payment,
    holdHours: online ? undefined : settings.holdHours,
    holdMinutes: online ? settings.onlineHoldMinutes : undefined,
    expiresAt: order.expiresAt,
    bankDetails: customer.payment === 'bank' ? settings.bankDetails : undefined,
    payhere: online ? checkoutForm(order, { base: siteUrl(req), accessToken }) : undefined,
  })
})
