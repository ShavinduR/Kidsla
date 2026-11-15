// Talks to the Vercel Functions in /api. The session lives in an HttpOnly cookie
// the browser sends automatically — JavaScript never sees or stores it.
async function call(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

export const getSession = () => call('/api/session')

export const login = (password) =>
  call('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })

export const logout = () => call('/api/logout', { method: 'POST' })
