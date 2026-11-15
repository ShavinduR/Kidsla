// Order lifecycle with STOCK HOLDING (audit H2). Every stock change happens in a MongoDB transaction.
//
//   checkout ──► pending (stock held for HOLD_HOURS) ──► confirmed (sold)
//                   │                                     │
//                   ├─► cancelled (stock released)        └─► cancelled (stock returned)
//                   └─► expired after HOLD_HOURS (stock released) ──► confirmed (if still available)
//
// Product fields:  stock.<size>    = units AVAILABLE to sell (what the shop shows)
//                  reserved.<size> = units held by pending orders (shown in the admin)
// Order field:     stockHeld        = this order currently holds units in reserved.<size>
//
// Because checkout takes stock with a conditional update ("only if stock ≥ qty") inside a
// transaction, two customers can never both get the last unit: the second one is told it's sold out.
import { getDb } from './db.js'
import { withTransaction } from './tx.js'

export const HOLD_HOURS = 24

export class OrderError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

// Combine lines for the same product + size (e.g. two colours of the same size share stock).
const bySize = (items) => {
  const m = new Map()
  for (const it of items) {
    const k = `${it.productId}|${it.size}`
    m.set(k, { productId: it.productId, size: it.size, title: it.title, qty: (m.get(k)?.qty ?? 0) + it.qty })
  }
  return [...m.values()]
}

const stockMove = (it, { stock = 0, reserved = 0 }, now) => ({
  updateOne: {
    filter: { _id: it.productId },
    update: {
      $inc: {
        ...(stock && { [`stock.${it.size}`]: stock, version: 1 }), // version++ whenever sellable stock moves (audit H1)
        ...(reserved && { [`reserved.${it.size}`]: reserved }),
      },
      $set: { updatedAt: now },
    },
  },
})

/** Take `qty` units from available stock, only if enough is left. Throws OrderError(409) otherwise. */
async function takeStock(db, session, lines, { hold }, now) {
  for (const l of bySize(lines)) {
    const r = await db.collection('products').updateOne(
      { _id: l.productId, [`stock.${l.size}`]: { $gte: l.qty } },
      {
        $inc: { [`stock.${l.size}`]: -l.qty, ...(hold && { [`reserved.${l.size}`]: l.qty }), version: 1 },
        $set: { updatedAt: now },
      },
      { session },
    )
    if (!r.modifiedCount) {
      const p = await db.collection('products').findOne({ _id: l.productId }, { session, projection: { stock: 1, title: 1 } })
      const left = p?.stock?.[l.size] ?? 0
      throw new OrderError(409, 'Some items in your cart changed. Please review them.', {
        problems: [{ id: l.productId, size: l.size, title: p?.title ?? l.title, reason: left ? `only ${left} left` : 'just sold out', available: left }],
      })
    }
  }
}

/** Create a pending order and hold its stock. All-or-nothing. Returns the order document. */
export async function createHeldOrder({ orderIdFor, doc }) {
  const db = await getDb()
  return withTransaction(async (session) => {
    const now = new Date()
    await takeStock(db, session, doc.items, { hold: true }, now)
    const orderId = await orderIdFor(db, session)
    const order = {
      _id: orderId,
      ...doc,
      status: 'pending',
      stockHeld: true,
      createdAt: now,
      expiresAt: new Date(now.getTime() + HOLD_HOURS * 3600_000),
      history: [{ status: 'pending', at: now }],
    }
    await db.collection('orders').insertOne(order, { session })
    return order
  })
}

const STATUS_FROM = { confirmed: ['pending', 'expired'], cancelled: ['pending', 'confirmed', 'expired'] }

/** Admin: confirm or cancel. Returns { id, status, restocked }. */
export async function changeOrderStatus(id, status) {
  const db = await getDb()
  return withTransaction(async (session) => {
    const now = new Date()
    const orders = db.collection('orders')
    const order = await orders.findOne({ _id: id }, { session })
    if (!order) throw new OrderError(404, 'Order not found.')
    if (!STATUS_FROM[status].includes(order.status)) throw new OrderError(409, `This order is already ${order.status}.`)

    const ops = []
    let restocked = false
    if (status === 'confirmed') {
      if (order.stockHeld) {
        for (const it of bySize(order.items)) ops.push(stockMove(it, { reserved: -it.qty }, now)) // held → sold
      } else {
        // Expired (or created before stock holding existed): take stock now, if still available.
        try {
          await takeStock(db, session, order.items, { hold: false }, now)
        } catch (err) {
          const p = err.extra?.problems?.[0]
          throw new OrderError(409, p ? `Not enough stock: ${p.title} (${p.size}): ${p.reason}. Update stock or cancel the order.` : err.message)
        }
      }
    } else {
      if (order.stockHeld) {
        for (const it of bySize(order.items)) ops.push(stockMove(it, { stock: it.qty, reserved: -it.qty }, now))
        restocked = true
      } else if (order.status === 'confirmed') {
        for (const it of bySize(order.items)) ops.push(stockMove(it, { stock: it.qty }, now))
        restocked = true
      }
    }
    if (ops.length) await db.collection('products').bulkWrite(ops, { session, ordered: true })

    // Guarded on the status we read, so two simultaneous clicks can't both apply.
    const r = await orders.updateOne(
      { _id: id, status: order.status },
      {
        $set: { status, stockHeld: false, [`${status}At`]: now },
        $unset: { expiresAt: '' },
        $push: { history: { status, at: now } },
      },
      { session },
    )
    if (!r.modifiedCount) throw new OrderError(409, 'This order was just updated. Refresh and try again.')
    return { id, status, restocked }
  })
}

/**
 * Release the stock of pending orders whose hold has run out. Cheap (indexed) and safe to call
 * often: from checkout, the admin and the daily cron. Returns how many orders expired.
 */
export async function releaseExpired(limit = 25) {
  const db = await getDb()
  const due = await db
    .collection('orders')
    .find({ status: 'pending', expiresAt: { $lt: new Date() } }, { projection: { _id: 1 } })
    .limit(limit)
    .toArray()
  let released = 0
  for (const { _id } of due) {
    try {
      await withTransaction(async (session) => {
        const now = new Date()
        const order = await db
          .collection('orders')
          .findOneAndUpdate(
            { _id, status: 'pending', expiresAt: { $lt: now } },
            { $set: { status: 'expired', stockHeld: false, expiredAt: now }, $unset: { expiresAt: '' }, $push: { history: { status: 'expired', at: now } } },
            { session, returnDocument: 'before' },
          )
        if (!order) return // someone confirmed/cancelled it meanwhile
        if (order.stockHeld) {
          const ops = bySize(order.items).map((it) => stockMove(it, { stock: it.qty, reserved: -it.qty }, now))
          await db.collection('products').bulkWrite(ops, { session, ordered: true })
        }
        released++
      })
    } catch (err) {
      console.error('[orders] expiry failed for', _id, err?.message)
    }
  }
  return released
}
