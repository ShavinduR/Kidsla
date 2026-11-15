// Email alerts via Resend (https://resend.com): new orders, server errors, login attacks.
//
// Env (server-only):
//   RESEND_API_KEY    API key from resend.com → API Keys
//   ALERT_EMAIL_TO    where alerts go (comma-separate several). With Resend's free test sender,
//                     this must be the email address of your Resend account.
//   ALERT_EMAIL_FROM  optional; default "KIDSLA Alerts <onboarding@resend.dev>" (no domain setup needed).
//                     After verifying your own domain in Resend, use e.g. "KIDSLA <alerts@kidsla.lk>".
// Without RESEND_API_KEY + ALERT_EMAIL_TO, alerts are skipped (logged only).
//
// Alerts never block or break the request: they run after the response via waitUntil().
import { waitUntil } from '@vercel/functions'
import { formatLKR } from '../../src/utils/format.js'
import { hit } from './ratelimit.js'

const API = process.env.RESEND_API_URL || 'https://api.resend.com/emails' // overridable for tests

export const alertsConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO)

// Customer-typed text goes into HTML email. Escape it so nobody can inject markup or links.
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const siteUrl = () => (process.env.VITE_SITE_URL || '').replace(/\/$/, '')

async function sendEmail({ subject, html, text }) {
  if (!alertsConfigured()) {
    console.log(`[alert skipped: email not configured] ${subject}`)
    return { skipped: true }
  }
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ALERT_EMAIL_FROM || 'KIDSLA Alerts <onboarding@resend.dev>',
        to: process.env.ALERT_EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) console.error('[alert] Resend error', res.status, (await res.text()).slice(0, 300))
    return { ok: res.ok }
  } catch (err) {
    console.error('[alert] send failed', err?.message)
    return { ok: false }
  }
}

/** Run in the background: the HTTP response doesn't wait for the email. */
const background = (promise) => {
  const p = promise.catch((err) => console.error('[alert]', err?.message))
  try {
    waitUntil(p)
  } catch {
    /* not on Vercel: the promise still runs */
  }
  return p
}

export function alertNewOrder(order) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.title)} <span style="color:#625B53">· ${esc(i.color)} · ${esc(i.size)} × ${i.qty}</span></td>` +
        `<td style="padding:6px 0;text-align:right">${formatLKR(i.price * i.qty)}</td></tr>`,
    )
    .join('')
  const admin = siteUrl() ? `<p><a href="${esc(siteUrl())}/admin" style="color:#55654B">Open the admin →</a></p>` : ''
  const c = order.customer
  return background(
    sendEmail({
      subject: `${order.paidOnline ? '💳 Paid order' : '🛍️ New order'} ${order._id ?? order.orderId}: ${formatLKR(order.total)}`,
      html: `<div style="font-family:system-ui,sans-serif;color:#3A3631;max-width:520px">
        <h2 style="margin:0 0 4px">New order ${esc(order._id ?? order.orderId)}</h2>
        <p style="margin:0 0 16px;color:#625B53">${order.paidOnline ? 'Paid online via PayHere and confirmed automatically. Pack and ship it.' : 'Pending: confirm it in the admin when the customer’s WhatsApp message arrives.'}</p>
        <p style="margin:0"><strong>${esc(c.name)}</strong> · ${esc(c.phone ?? '')}<br>${esc(c.address)}<br>${esc(c.district)} · ${{ bank: 'Bank transfer', online: 'Paid online', cod: 'Cash on delivery' }[c.payment] ?? 'Cash on delivery'}</p>
        <table style="width:100%;margin:16px 0;border-top:1px solid #EFE7DC;border-bottom:1px solid #EFE7DC">${rows}</table>
        <p style="margin:0">Delivery ${formatLKR(order.deliveryFee)}<br><strong>Total ${formatLKR(order.total)}</strong></p>${admin}</div>`,
      text: `New order ${order._id ?? order.orderId} from ${c.name} (${c.district}): ${formatLKR(order.total)}`,
    }),
  )
}

/** Server errors: at most one email per 10 minutes so an outage doesn't flood your inbox. */
let lastErrorAlert = 0
export function alertServerError(where, err) {
  return background(
    (async () => {
      let allowed
      try {
        allowed = (await hit('alertError', 'all')).allowed
      } catch {
        allowed = Date.now() - lastErrorAlert > 10 * 60_000 // DB down → in-memory fallback
      }
      if (!allowed) return
      lastErrorAlert = Date.now()
      await sendEmail({
        subject: '⚠️ KIDSLA: server error',
        html: `<div style="font-family:system-ui,sans-serif"><h3>A request failed on the website</h3>
          <p><strong>${esc(where)}</strong></p><pre style="white-space:pre-wrap;background:#FAF7F2;padding:12px">${esc(String(err?.stack ?? err).slice(0, 1500))}</pre>
          <p>More details: Vercel → your project → Logs. You’ll get at most one of these emails every 10 minutes.</p></div>`,
        text: `Server error at ${where}: ${String(err?.message ?? err)}`,
      })
    })(),
  )
}

/** Someone is guessing the admin password from many places at once. */
export function alertLoginAttack(count) {
  return background(
    sendEmail({
      subject: '🔐 KIDSLA: many failed admin sign-ins',
      html: `<div style="font-family:system-ui,sans-serif"><h3>${count} failed admin sign-in attempts in the last hour</h3>
        <p>Admin sign-in is paused for everyone until the hour resets. If this wasn’t you, consider changing
        <code>ADMIN_PASSWORD</code> in Vercel (this also signs out every device).</p></div>`,
      text: `${count} failed admin sign-in attempts in the last hour.`,
    }),
  )
}

/** Payment needs a human: late payment for sold-out items, amount mismatch, chargeback, unknown order. */
export function alertPaymentProblem(orderId, text) {
  return background(
    sendEmail({
      subject: `⚠️ KIDSLA payment needs attention: ${String(orderId ?? '').slice(0, 30)}`,
      html: `<div style="font-family:system-ui,sans-serif"><h3>Order ${esc(orderId)}</h3><p>${esc(text)}</p><p>Open the admin → Orders, and your PayHere account.</p></div>`,
      text: `Order ${orderId}: ${text}`,
    }),
  )
}
