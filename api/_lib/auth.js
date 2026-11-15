// Admin authentication with SERVER-SIDE sessions (audit H4, Phase 1).
//
// Required environment variables (Vercel → Settings → Environment Variables, NOT prefixed with VITE_):
//   ADMIN_PASSWORD        the admin login password (use 16+ random characters)
//   ADMIN_SESSION_SECRET  random string (e.g. `openssl rand -hex 32`)
//
// How it works:
//   • Sign-in creates a random 256-bit session token. The browser gets it in an HttpOnly cookie;
//     the database stores only its SHA-256 hash (a database leak doesn't leak usable sessions).
//   • Every admin request looks the session up → Log out / "Sign out all devices" take effect instantly.
//   • Each session records a fingerprint of ADMIN_PASSWORD + ADMIN_SESSION_SECRET. Changing either one
//     makes every existing session invalid immediately.
//   • Sessions expire after 8 hours (and MongoDB deletes them automatically via a TTL index).
import crypto from 'node:crypto'
import { send } from './http.js'
import { getDb, isDbConfigured } from './db.js'
import { ipKey } from './ratelimit.js'

export { send, readJson } from './http.js'
export { clientIp } from './ratelimit.js'

export const COOKIE = 'kidsla_admin'
const SESSION_HOURS = 8

const sha256hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

export const isConfigured = () =>
  (process.env.ADMIN_PASSWORD ?? '').length >= 8 &&
  (process.env.ADMIN_SESSION_SECRET ?? '').length >= 32 &&
  isDbConfigured()

/** Constant-time comparison (hashing first makes lengths equal). */
export const passwordMatches = (input) =>
  crypto.timingSafeEqual(
    crypto.createHash('sha256').update(String(input ?? '')).digest(),
    crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest(),
  )

/** Fingerprint of the current credentials. Changes if the password or secret changes. */
const credentialTag = () => sha256hex(process.env.ADMIN_SESSION_SECRET + sha256hex(process.env.ADMIN_PASSWORD)).slice(0, 32)

const readCookie = (req, name) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === name)?.[1]

const sessions = async () => (await getDb()).collection('sessions')

export async function createSession(req) {
  const token = crypto.randomBytes(32).toString('base64url')
  const now = new Date()
  await (await sessions()).insertOne({
    _id: sha256hex(token),
    tag: credentialTag(),
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_HOURS * 3600_000),
    device: String(req.headers['user-agent'] ?? '').slice(0, 160),
    ip: ipKey(req),
  })
  return token
}

/** Returns the session document, or null. */
export async function getSession(req) {
  const token = readCookie(req, COOKIE)
  if (!token || token.length > 100 || !isConfigured()) return null
  return (await sessions()).findOne({ _id: sha256hex(token), tag: credentialTag(), expiresAt: { $gt: new Date() } })
}

export const isAuthenticated = async (req) => Boolean(await getSession(req))

export async function destroySession(req) {
  const token = readCookie(req, COOKIE)
  if (token && token.length <= 100) await (await sessions()).deleteOne({ _id: sha256hex(token) })
}

/** "Sign out all devices". Returns how many sessions were ended. */
export async function destroyAllSessions() {
  return (await (await sessions()).deleteMany({})).deletedCount
}

const isLocal = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')

export function sessionCookie(req, token) {
  const parts = [`${COOKIE}=${token ?? ''}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${token ? SESSION_HOURS * 3600 : 0}`]
  if (!isLocal(req)) parts.push('Secure')
  return parts.join('; ')
}

/** Guard for admin endpoints:  if (!(await requireAdmin(req, res))) return */
export async function requireAdmin(req, res) {
  if (await isAuthenticated(req)) return true
  send(res, 401, { error: 'Not signed in' })
  return false
}
