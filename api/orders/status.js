// GET /api/orders/status?id=KD-…&t=<token>: payment result page polling.
import { handle, query, send } from '../_lib/http.js'
import { orderForToken, publicOrder } from '../_lib/orderAccess.js'

export default handle(['GET'], async (req, res) => {
  const q = query(req)
  const order = await orderForToken(q.get('id'), q.get('t'))
  if (!order) return send(res, 404, { error: 'Order not found' })
  send(res, 200, publicOrder(order))
})
