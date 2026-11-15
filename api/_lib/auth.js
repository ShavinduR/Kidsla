// Admin auth helpers for Vercel Functions (plain Node — also used by the Vite dev server).
//
// Required environment variables (Vercel → Settings → Environment Variables, NOT prefixed with VITE_):
//   ADMIN_PASSWORD        — the admin login password (use 12+ characters)
//   ADMIN_SESSION_SECRET  — random string used to sign session cookies (e.g. `openssl rand -hex 32`)
// Changing either one logs everyone out.
import crypto from 'node:crypto'

export const COOKIE = 'kidsla_admin'
const SESSION_HOURS = 8
const MAX_FAILS = 5
const LOCK_MINUTES = 15

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest()
const hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url')

export const isConfigured = () =>
  (process.env.ADMIN_PASSWORD ?? '').length >= 8 && (process.env.ADMIN_SESSION_SECRET ?? '').length >= 32

/** Constant-time comparison (hashing first makes lengths equal). */
export const passwordMatches = (input) =>
  crypto.timingSafeEqual(sha256(input ?? ''), sha256(process.env.ADMIN_PASSWORD))

export function createToken() {
  const payload = b64url(JSON.stringify({ sub: 'admin', exp: Date.now() + SESSION_HOURS * 3600_000 }))
  return `${payload}.${hmac(payload, process.env.ADMIN_SESSION_SECRET)}`
}

export function verifyToken(token) {
  if (!token || !isConfigured()) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = hmac(payload, process.env.ADMIN_SESSION_SECRET)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return sub === 'admin' && Date.now() < exp
  } catch {
    return false
  }
}

const readCookie = (req, name) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === name)?.[1]

export const isAuthenticated = (req) => verifyToken(readCookie(req, COOKIE))

const isLocal = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')

export function sessionCookie(req, token) {
  const parts = [`${COOKIE}=${token ?? ''}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${token ? SESSION_HOURS * 3600 : 0}`]
  if (!isLocal(req)) parts.push('Secure')
  return parts.join('; ')
}

// ---- tiny response helpers (work in Vercel and in Vite's dev server) ----
export function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body // Vercel already parsed it
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 10_000) break
  }
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

/**
 * Guard for future admin endpoints, e.g. inventory import:
 *   if (!requireAdmin(req, res)) return
 */
export function requireAdmin(req, res) {
  if (isAuthenticated(req)) return true
  send(res, 401, { error: 'Not signed in' })
  return false
}

// ---- brute-force protection ----
// Best-effort, per server instance (serverless instances don't share memory).
// For stronger protection add Upstash Redis / Vercel KV — see docs/BACKEND.md.
const attempts = new Map()
const clientIp = (req) => String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '?').split(',')[0].trim()

export function lockedFor(req) {
  const a = attempts.get(clientIp(req))
  return a?.until && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 60000) : 0
}
export function recordFailure(req) {
  const ip = clientIp(req)
  const a = attempts.get(ip) ?? { count: 0, until: 0 }
  a.count += 1
  if (a.count >= MAX_FAILS) Object.assign(a, { count: 0, until: Date.now() + LOCK_MINUTES * 60000 })
  attempts.set(ip, a)
}
export const clearFailures = (req) => attempts.delete(clientIp(req))
