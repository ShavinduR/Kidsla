// Admin: list orders and move them between statuses. Stock handling lives in _lib/orders.js
// (transactions): confirm = sold, cancel = stock back, pending orders expire after 24 h.
import { requireAdmin } from '../_lib/auth.js'
import { handle, query, readJson, send } from '../_lib/http.js'
import { getDb, isDbConfigured } from '../_lib/db.js'
import { OrderError, changeOrderStatus, releaseExpired } from '../_lib/orders.js'

const STATUSES = ['pending', 'confirmed', 'cancelled', 'expired']
const ORDER_ID = /^KD-\d{4}-\d{3,6}$/

const countByStatus = async (orders) =>
  Object.fromEntries((await orders.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray()).map((c) => [c._id, c.n]))

export default handle(['GET', 'PATCH'], async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  if (!isDbConfigured()) return send(res, 200, { configured: false, orders: [] })
  const orders = (await getDb()).collection('orders')

  if (req.method === 'GET') {
    const expired = await releaseExpired()
    const q = query(req)
    if (q.get('countsOnly') === '1') return send(res, 200, { configured: true, counts: await countByStatus(orders), expired })
    const status = q.get('status')
    const filter = STATUSES.includes(status) ? { status } : {}
    const [list, counts] = await Promise.all([orders.find(filter).sort({ createdAt: -1 }).limit(200).toArray(), countByStatus(orders)])
    return send(res, 200, { configured: true, orders: list.map(({ _id, ...o }) => ({ id: _id, ...o })), counts, expired })
  }

  const body = await readJson(req)
  const { id, status } = body ?? {}
  if (typeof id !== 'string' || !ORDER_ID.test(id) || !['confirmed', 'cancelled'].includes(status))
    return send(res, 400, { error: 'Invalid request' })
  try {
    send(res, 200, await changeOrderStatus(id, status))
  } catch (err) {
    if (err instanceof OrderError) return send(res, err.status, { error: err.message })
    throw err
  }
})
