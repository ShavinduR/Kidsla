// PayHere (https://www.payhere.lk): cards, eZcash, mCash, Genie, Frimi… for Sri Lankan shops.
//
// Env (server-only, Vercel → Settings → Environment Variables):
//   PAYHERE_MERCHANT_ID      from PayHere → Settings → Domains & Credentials
//   PAYHERE_MERCHANT_SECRET  generated there FOR YOUR DOMAIN (the secret is tied to the domain)
//   PAYHERE_MODE             "sandbox" (testing, default) or "live"
//
// Flow: our server creates the order (stock held) and signs the payment request → the browser is
// sent to PayHere's checkout page → PayHere calls our /api/payhere/notify SERVER-TO-SERVER with a
// signed result → only that notification marks the order paid. The return_url the customer comes
// back to proves nothing on its own (anyone can type a URL).
import crypto from 'node:crypto'

export function payhereConfig() {
  const merchantId = process.env.PAYHERE_MERCHANT_ID
  const secret = process.env.PAYHERE_MERCHANT_SECRET
  if (!merchantId || !secret) return null
  const mode = process.env.PAYHERE_MODE === 'live' ? 'live' : 'sandbox'
  return {
    merchantId,
    secret,
    mode,
    checkoutUrl: mode === 'live' ? 'https://www.payhere.lk/pay/checkout' : 'https://sandbox.payhere.lk/pay/checkout',
  }
}

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase()

/** PayHere wants amounts with exactly 2 decimals, e.g. 4250 → "4250.00". */
export const amountStr = (lkr) => (Math.round(Number(lkr) * 100) / 100).toFixed(2)

/** Signature for the checkout request (sent to PayHere). */
export const checkoutHash = (merchantId, orderId, amount, currency, secret) =>
  md5(`${merchantId}${orderId}${amountStr(amount)}${currency}${md5(secret)}`)

/** Expected signature of a notification (sent by PayHere). */
export const notifySignature = (f, secret) =>
  md5(`${f.merchant_id}${f.order_id}${f.payhere_amount}${f.payhere_currency}${f.status_code}${md5(secret)}`)

/** Constant-time check of the md5sig PayHere sent. */
export function verifyNotification(f, cfg) {
  if (!f?.md5sig || f.merchant_id !== cfg.merchantId) return false
  const a = Buffer.from(String(f.md5sig).toUpperCase())
  const b = Buffer.from(notifySignature(f, cfg.secret))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const PAYHERE_STATUS = { '2': 'paid', '0': 'processing', '-1': 'cancelled', '-2': 'failed', '-3': 'chargedback' }

/** Fields for the auto-submitted form that takes the customer to PayHere. */
export function checkoutForm(order, { base, accessToken }) {
  const cfg = payhereConfig()
  const [first, ...rest] = order.customer.name.split(/\s+/)
  const back = `${base}/order/${encodeURIComponent(order._id)}?t=${encodeURIComponent(accessToken)}`
  const fields = {
    merchant_id: cfg.merchantId,
    return_url: back,
    cancel_url: `${back}&cancelled=1`,
    notify_url: `${base}/api/payhere/notify`,
    order_id: order._id,
    items: `KIDSLA order ${order._id}`.slice(0, 100),
    currency: 'LKR',
    amount: amountStr(order.total),
    first_name: first.slice(0, 50),
    last_name: (rest.join(' ') || first).slice(0, 50),
    email: order.customer.email,
    phone: order.customer.phone,
    address: order.customer.address.slice(0, 100),
    city: order.customer.district,
    country: 'Sri Lanka',
    delivery_address: order.customer.address.slice(0, 100),
    delivery_city: order.customer.district,
    delivery_country: 'Sri Lanka',
  }
  fields.hash = checkoutHash(cfg.merchantId, order._id, order.total, 'LKR', cfg.secret)
  return { action: cfg.checkoutUrl, fields, mode: cfg.mode }
}
