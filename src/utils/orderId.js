// KD-YYMM-NNN  e.g. KD-2611-042 (Nov 2026, #042)
// NOTE: 3 random digits = 1,000 IDs/month, so duplicates become likely after ~40 orders
// in a month. When the Node backend exists, issue IDs from a MongoDB counter instead.
export function generateOrderId(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const n = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `KD-${yy}${mm}-${n}`
}
