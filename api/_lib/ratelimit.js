// Rate limiting shared by ALL server instances, stored in MongoDB (audit M2/M3).
// Fixed-window counters: one tiny document per (rule, client, time window), auto-deleted by a TTL
// index. No extra service or API key is needed. (Upstash Redis would be faster at very high traffic,
// but at KIDSLA's scale one indexed upsert per login/order is a few milliseconds.)
import crypto from 'node:crypto'
import { getDb } from './db.js'

export const RULES = {
  loginFailIp: { limit: 5, windowSec: 15 * 60 }, // wrong passwords per IP
  loginFailAll: { limit: 100, windowSec: 60 * 60 }, // wrong passwords site-wide (distributed attacks)
  orderIp: { limit: 10, windowSec: 10 * 60 }, // checkouts per IP. Generous: Sri Lankan mobile
  orderIpDay: { limit: 50, windowSec: 24 * 3600 }, //   carriers put many customers behind one IP (CGNAT)
  orderAll: { limit: 300, windowSec: 60 * 60 }, // checkouts site-wide (spam floods)
  import: { limit: 20, windowSec: 60 * 60 }, // spreadsheet uploads per admin
  alertError: { limit: 1, windowSec: 10 * 60 }, // max one "server error" email per 10 minutes
}

/** Client IP. On Vercel, x-forwarded-for is set by Vercel itself and can't be spoofed by the client. */
export const clientIp = (req) =>
  String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '?')
    .split(',')[0]
    .trim()

// IPs are personal data: store only a short hash.
export const ipKey = (req) => crypto.createHash('sha256').update(`kidsla:${clientIp(req)}`).digest('hex').slice(0, 20)

const windowOf = (windowSec, now = Date.now()) => Math.floor(now / (windowSec * 1000))
const docId = (rule, who, win) => `${rule}:${who}:${win}`

/** Count one event. Returns { count, allowed, retryAfter (seconds) }. */
export async function hit(rule, who) {
  const { limit, windowSec } = RULES[rule]
  const now = Date.now()
  const win = windowOf(windowSec, now)
  const end = (win + 1) * windowSec * 1000
  const db = await getDb()
  const doc = await db.collection('ratelimits').findOneAndUpdate(
    { _id: docId(rule, who, win) },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(end + 60_000) } },
    { upsert: true, returnDocument: 'after' },
  )
  return { count: doc.count, allowed: doc.count <= limit, retryAfter: Math.ceil((end - now) / 1000) }
}

/** Current count without adding one. */
export async function peek(rule, who) {
  const { limit, windowSec } = RULES[rule]
  const now = Date.now()
  const win = windowOf(windowSec, now)
  const db = await getDb()
  const doc = await db.collection('ratelimits').findOne({ _id: docId(rule, who, win) })
  const count = doc?.count ?? 0
  return { count, blocked: count >= limit, retryAfter: Math.ceil(((win + 1) * windowSec * 1000 - now) / 1000) }
}

export async function reset(rule, who) {
  const db = await getDb()
  await db.collection('ratelimits').deleteOne({ _id: docId(rule, who, windowOf(RULES[rule].windowSec)) })
}

export const minutes = (sec) => `${Math.max(1, Math.ceil(sec / 60))} minute${Math.ceil(sec / 60) > 1 ? 's' : ''}`
