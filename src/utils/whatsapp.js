import { formatLKR } from './format'

// Local number 0742327807 → international format for wa.me (Sri Lanka: +94, drop leading 0)
export const WHATSAPP_NUMBER = '94742327807'

export function buildOrderMessage({ name, address, items, total }) {
  const lines = items.map(
    (item, i) =>
      `${i + 1}. ${item.title} - ${item.color} - Size: ${item.size} - Qty: ${item.qty} - ${formatLKR(item.price * item.qty)}`,
  )

  return [
    'Hello KIDSLA, I would like to place an order:',
    '',
    `Name: ${name.trim()}`,
    `Address: ${address.trim()}`,
    '',
    'Items:',
    ...lines,
    '',
    `Total: ${formatLKR(total)}`,
    '',
    'Please let me know the delivery charges.',
  ].join('\n')
}

export function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
