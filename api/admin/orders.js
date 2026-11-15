// Admin: list orders and move them between pending → confirmed / cancelled.
// Confirming takes the items out of stock; cancelling a confirmed order puts them back.
import { requireAdmin } from '../_lib/auth.js'
import { handle, query, readJson, send } from '../_lib/http.js'
import { getDb, isDbConfigured } from '../_lib/db.js'

const STATUSES = ['pending', 'confirmed', 'cancelled']
const ORDER_ID = /^KD-\d{4}-\d{3,6}$/

export default handle(['GET', 'PATCH'], async (req, res) => {
  if (!requireAdmin(req, res)) return
  if (!isDbConfigured()) return send(res, 200, { configured: false, orders: [] })
  const db = await getDb()
  const orders = db.collection('orders')

  if (req.method === 'GET') {
    const status = query(req).get('status')
    const filter = STATUSES.includes(status) ? { status } : {}
    const [list, counts] = await Promise.all([
      orders.find(filter).sort({ createdAt: -1 }).limit(200).toArray(),
      orders.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    ])
    return send(res, 200, {
      configured: true,
      orders: list.map(({ _id, ...o }) => ({ id: _id, ...o })),
      counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
    })
  }

  const body = await readJson(req)
  const { id, status } = body ?? {}
  if (typeof id !== 'string' || !ORDER_ID.test(id) || !['confirmed', 'cancelled'].includes(status))
    return send(res, 400, { error: 'Invalid request' })

  const now = new Date()
  const products = db.collection('products')
  const stockOp = (items, sign) =>
    items.map((it) => ({
      updateOne: { filter: { _id: it.productId }, update: { $inc: { [`stock.${it.size}`]: sign * it.qty }, $set: { updatedAt: now } } },
    }))

  if (status === 'confirmed') {
    // Claim the order first so two clicks can't confirm it twice.
    const order = await orders.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status: 'confirmed', confirmedAt: now }, $push: { history: { status: 'confirmed', at: now } } },
      { returnDocument: 'before' },
    )
    if (!order) return send(res, 409, { error: 'This order is no longer pending.' })

    // Take stock one line at a time, only if enough is left. Undo everything if any line is short.
    const taken = []
    for (const it of order.items) {
      const r = await products.updateOne(
        { _id: it.productId, [`stock.${it.size}`]: { $gte: it.qty } },
        { $inc: { [`stock.${it.size}`]: -it.qty }, $set: { updatedAt: now } },
      )
      if (!r.modifiedCount) {
        if (taken.length) await products.bulkWrite(stockOp(taken, +1))
        await orders.updateOne({ _id: id }, { $set: { status: 'pending' }, $unset: { confirmedAt: '' }, $pop: { history: 1 } })
        return send(res, 409, { error: `Not enough stock: ${it.title} (${it.size}) × ${it.qty}. Update stock or cancel the order.` })
      }
      taken.push(it)
    }
    return send(res, 200, { id, status: 'confirmed' })
  }

  // Cancel: pending → cancelled, or confirmed → cancelled (restock).
  const order = await orders.findOneAndUpdate(
    { _id: id, status: { $in: ['pending', 'confirmed'] } },
    { $set: { status: 'cancelled', cancelledAt: now }, $push: { history: { status: 'cancelled', at: now } } },
    { returnDocument: 'before' },
  )
  if (!order) return send(res, 409, { error: 'This order is already cancelled.' })
  if (order.status === 'confirmed') await products.bulkWrite(stockOp(order.items, +1))
  send(res, 200, { id, status: 'cancelled', restocked: order.status === 'confirmed' })
})
