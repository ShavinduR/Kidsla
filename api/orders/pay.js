// POST /api/orders/pay { id, t }: try paying online again (same order, stock still held).
import { handle, readJson, send } from '../_lib/http.js'
import { orderForToken } from '../_lib/orderAccess.js'
import { checkoutForm, payhereConfig } from '../_lib/payhere.js'
import { siteUrl } from '../_lib/catalogPublic.js'

export default handle(['POST'], async (req, res) => {
  const body = await readJson(req)
  const order = await orderForToken(body?.id, body?.t)
  if (!order) return send(res, 404, { error: 'Order not found' })
  if (!payhereConfig()) return send(res, 503, { error: 'Online payment is not available right now.' })
  if (order.payment?.method !== 'online' || order.payment?.status === 'paid')
    return send(res, 409, { error: 'This order doesn’t need an online payment.' })
  if (order.status !== 'pending' || !order.expiresAt || new Date(order.expiresAt) < new Date())
    return send(res, 409, { error: 'The time to pay for this order has run out. Please place a new order.' })
  send(res, 200, { payhere: checkoutForm(order, { base: siteUrl(req), accessToken: body.t }) })
})
