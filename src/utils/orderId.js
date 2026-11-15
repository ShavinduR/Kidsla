// FALLBACK order IDs, only used when the server can't be reached at checkout.
// Real orders get sequential IDs from the database: KD-YYMM-NNN (e.g. KD-2611-042).
// Fallback IDs use a different prefix and 4 random hex characters, KDX-YYMM-XXXX (e.g. KDX-2611-7F3A),
// so they can never be confused with a real database order. "X" = not in the admin; handle it from WhatsApp.
export function generateOrderId(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const rand = crypto.getRandomValues(new Uint16Array(1))[0].toString(16).toUpperCase().padStart(4, '0')
  return `KDX-${yy}${mm}-${rand}`
}
