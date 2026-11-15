// Customers can look up THEIR order (payment result page) with the private token from checkout.
import crypto from 'node:crypto'
import { getDb } from './db.js'

const ORDER_ID = /^KD-\d{4}-\d{3,6}$/

export async function orderForToken(id, token) {
  if (typeof id !== 'string' || !ORDER_ID.test(id) || typeof token !== 'string' || token.length < 20 || token.length > 64) return null
  const order = await (await getDb()).collection('orders').findOne({ _id: id })
  if (!order?.access) return null
  const a = Buffer.from(order.access)
  const b = Buffer.from(crypto.createHash('sha256').update(token).digest('hex'))
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? order : null
}

/** What the customer may see: no address, phone or email. */
export const publicOrder = (o) => ({
  id: o._id,
  status: o.status,
  payment: { method: o.payment?.method, status: o.payment?.status },
  total: o.total,
  items: o.items.map((i) => ({ title: i.title, size: i.size, color: i.color, qty: i.qty })),
  expiresAt: o.expiresAt ?? null,
})
