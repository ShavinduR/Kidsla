import { formatLKR } from './format'
import { WHATSAPP_NUMBER } from '../data/site'

export const waLink = (text) =>
  `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`

/** items: [{ productId, title, size, color, qty, price }] — the server-confirmed lines when available. */
export function buildOrderMessage({ orderId, customer, items: orderItems, subtotal, deliveryFee, total, paymentLabel }) {
  const items = orderItems.map(
    (l, i) =>
      `${i + 1}. ${l.title} (${l.productId})\n    Colour: ${l.color} | Size: ${l.size} | Qty: ${l.qty} | ${formatLKR(l.price * l.qty)}`,
  )
  return [
    `🛍️ *New KIDSLA Order — ${orderId}*`,
    '',
    `*Name:* ${customer.name.trim()}`,
    `*Address:* ${customer.address.trim()}`,
    `*District:* ${customer.district}`,
    `*Payment:* ${paymentLabel}`,
    '',
    '*Items:*',
    ...items,
    '',
    `Subtotal: ${formatLKR(subtotal)}`,
    `Delivery (${customer.district === 'Colombo' ? 'Colombo' : 'Outstation'}): ${formatLKR(deliveryFee)}`,
    `*Total: ${formatLKR(total)}*`,
    '',
    customer.payment === 'bank'
      ? 'Please send me the bank details to complete my order. Thank you!'
      : 'Please confirm my order. Thank you!',
  ].join('\n')
}

export const buildNotifyMessage = (product) =>
  `Hi KIDSLA! Please notify me when "${product.title}" (${product.id}) is available. Thank you!`

/**
 * For checkouts that must wait for the server: open a blank tab immediately (inside the tap,
 * so popup blockers allow it), then point it at WhatsApp once the order is saved.
 */
export function prepareWhatsAppWindow() {
  const win = window.open('', '_blank')
  if (win) win.opener = null
  return {
    go(url) {
      if (win && !win.closed) win.location.href = url
      else window.location.href = url
    },
    cancel() {
      if (win && !win.closed) win.close()
    },
  }
}

/**
 * Opens WhatsApp in a new tab. Returns true if it (probably) opened.
 * Note: passing "noopener" to window.open makes it ALWAYS return null, so we
 * detach the opener manually instead — otherwise we can't detect popup blockers.
 */
export function openWhatsApp(url) {
  const win = window.open(url, '_blank')
  if (win) {
    win.opener = null
    return true
  }
  window.location.href = url // popup blocked → same-tab redirect
  return false
}
