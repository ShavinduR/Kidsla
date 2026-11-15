// Admin API client. Every call carries the HttpOnly session cookie automatically.
// A 401 means the session expired → AdminGate shows the login screen again.
export const SESSION_EXPIRED = 'kidsla:session-expired'

async function call(path, options = {}) {
  let res
  try {
    res = await fetch(path, { credentials: 'same-origin', ...options })
  } catch {
    return { ok: false, status: 0, error: 'Can’t reach the server. Check your connection.' }
  }
  if (res.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED))
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const fetchAdminProducts = () => call('/api/admin/products')
export const updateProduct = (edit) => call('/api/admin/products', json('PATCH', edit))
export const seedCatalogue = () => call('/api/admin/seed', json('POST', {}))

export const fetchOrders = (status) => call(`/api/admin/orders${status ? `?status=${status}` : ''}`)
export const fetchOrderCounts = () => call('/api/admin/orders?countsOnly=1')
export const signOutAllDevices = () => call('/api/logout', json('POST', { all: true }))
export const setOrderStatus = (id, status) => call('/api/admin/orders', json('PATCH', { id, status }))

/** Same-origin download link (cookie included). */
export const exportUrl = (format = 'xlsx') => `/api/admin/export?format=${format}`

/** Upload the raw file. dryRun=true → change report only; false → apply. */
export const importInventory = (file, { dryRun }) =>
  call(`/api/admin/import?dryRun=${dryRun ? 1 : 0}&filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  })
