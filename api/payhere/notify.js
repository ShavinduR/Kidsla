// PayHere → our server: the payment result (server-to-server, form-encoded, signed).
// THIS is the only thing that marks an order paid. Safe to receive more than once.
import { handle, readRaw, send } from '../_lib/http.js'
import { getDb } from '../_lib/db.js'
import { PAYHERE_STATUS, amountStr, payhereConfig, verifyNotification } from '../_lib/payhere.js'
import { OrderError, recordPayment } from '../_lib/orders.js'
import { alertNewOrder, alertPaymentProblem } from '../_lib/alerts.js'
import { audit } from '../_lib/audit.js'

export default handle(
  ['POST'],
  async (req, res) => {
    const cfg = payhereConfig()
    if (!cfg) return send(res, 503, { error: 'PayHere not configured' })
    const raw = await readRaw(req, 20_000)
    const f = Object.fromEntries(new URLSearchParams(raw?.toString('utf8') ?? ''))

    if (!verifyNotification(f, cfg)) {
      await audit('payhere', 'payment.bad_signature', String(f.order_id ?? '').slice(0, 30), { status: f.status_code })
      return send(res, 400, { error: 'Invalid signature' })
    }
    const status = PAYHERE_STATUS[f.status_code]
    if (!status || !f.payment_id) return send(res, 400, { error: 'Unknown status' })

    // Idempotency: each (payment, status) is processed once, however often PayHere retries.
    const db = await getDb()
    try {
      await db.collection('payments').insertOne({
        _id: `${f.payment_id}:${f.status_code}`,
        orderId: f.order_id,
        paymentId: f.payment_id,
        status,
        amount: f.payhere_amount,
        currency: f.payhere_currency,
        via: f.method, // VISA, MASTER, EZCASH, GENIE… (card numbers are never stored)
        message: String(f.status_message ?? '').slice(0, 200),
        receivedAt: new Date(),
      })
    } catch (err) {
      if (err?.code === 11000) return send(res, 200, { ok: true, duplicate: true })
      throw err
    }

    const order = await db.collection('orders').findOne({ _id: f.order_id }, { projection: { total: 1, customer: 1, items: 1, deliveryFee: 1 } })
    if (!order) {
      alertPaymentProblem(f.order_id, `PayHere sent a ${status} payment (${f.payment_id}) for an order that doesn’t exist.`)
      return send(res, 200, { ok: true, unknownOrder: true })
    }
    // The amount must match OUR total exactly (protects against a tampered checkout form).
    if (f.payhere_amount !== amountStr(order.total) || f.payhere_currency !== 'LKR') {
      await audit('payhere', 'payment.amount_mismatch', order._id, { paid: f.payhere_amount, expected: amountStr(order.total), status })
      if (status === 'paid') alertPaymentProblem(order._id, `Paid LKR ${f.payhere_amount} ${f.payhere_currency}, but the order total is LKR ${amountStr(order.total)}. Not marked as paid. Check PayHere.`)
      await db.collection('orders').updateOne({ _id: order._id }, { $set: { needsAttention: `Payment amount mismatch (${f.payhere_amount} ${f.payhere_currency}). Check PayHere.` } })
      return send(res, 200, { ok: true, amountMismatch: true })
    }

    let outcome
    try {
      ;({ outcome } = await recordPayment(order._id, { status, paymentId: f.payment_id, via: f.method, message: String(f.status_message ?? '').slice(0, 200) }))
    } catch (err) {
      if (err instanceof OrderError) return send(res, 200, { ok: true, error: err.message })
      throw err
    }
    await audit('payhere', `payment.${status}`, order._id, { paymentId: f.payment_id, via: f.method, outcome })
    if (outcome === 'paid') alertNewOrder({ ...order, paidOnline: true })
    if (outcome === 'paid-needs-attention') alertPaymentProblem(order._id, 'Paid online, but the items had sold out after the payment window ended. Restock and confirm, or refund in PayHere.')
    if (status === 'chargedback') alertPaymentProblem(order._id, 'A card payment was charged back (disputed). Check PayHere.')
    send(res, 200, { ok: true, outcome })
  },
  { contentTypes: ['application/x-www-form-urlencoded'], sameOrigin: false },
)
