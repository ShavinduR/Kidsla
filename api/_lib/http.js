// Small helpers so handlers run unchanged on Vercel and in Vite's local dev server.
import { alertServerError } from './alerts.js'

export function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (!('Cache-Control' in headers)) res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

export function sendFile(res, buffer, filename, type) {
  res.statusCode = 200
  res.setHeader('Content-Type', type)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.end(buffer)
}

export const query = (req) => new URL(req.url, 'http://localhost').searchParams

export const methodNotAllowed = (res, allowed) =>
  send(res, 405, { error: 'Method not allowed' }, { Allow: allowed.join(', ') })

export async function readJson(req, limit = 50_000) {
  try {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body // pre-parsed by Vercel
  } catch {
    return null
  }
  const raw = await readRaw(req, limit)
  if (raw === null) return null
  try {
    return JSON.parse(raw.toString('utf8') || '{}')
  } catch {
    return null
  }
}

/** Raw request body as a Buffer, or null if larger than `limit` bytes. */
export async function readRaw(req, limit = 4_000_000) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

/**
 * CSRF / cross-site abuse guard for every state-changing request (POST, PATCH, PUT, DELETE).
 *  1. Content-Type must be one we expect (application/json by default). HTML forms can only send
 *     urlencoded / multipart / text/plain, and a cross-origin fetch with JSON triggers a CORS
 *     preflight that we never approve, so a foreign website can't forge these requests.
 *  2. Origin must be present and equal to this site's own host. Browsers always send Origin on
 *     POST/PATCH and scripts on other sites can't fake it. Same-origin, so it works on
 *     *.vercel.app previews, production and a future custom domain without configuration.
 *  3. Sec-Fetch-Site (modern browsers) must not be "cross-site"/"same-site": blocks sibling subdomains.
 * Returns true if allowed; otherwise sends 403/415 and returns false.
 */
export function guardWrite(req, res, { contentTypes = ['application/json'] } = {}) {
  if (SAFE_METHODS.includes(req.method)) return true

  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (!contentTypes.includes(type)) {
    send(res, 415, { error: `Unsupported content type. Expected ${contentTypes.join(' or ')}.` })
    return false
  }

  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim().toLowerCase()
  let originHost = ''
  try {
    originHost = new URL(req.headers.origin).host.toLowerCase()
  } catch {
    /* missing or malformed Origin */
  }
  const site = req.headers['sec-fetch-site']
  if (!host || originHost !== host || (site && !['same-origin', 'none'].includes(site))) {
    send(res, 403, { error: 'Request blocked: it must come from this website.' })
    return false
  }
  return true
}

/**
 * Wraps a handler: method check, write guard (content type + origin), and a JSON 500 on unexpected
 * errors (details logged, never leaked). `contentTypes` applies to non-GET methods only.
 */
export const handle = (methods, fn, { contentTypes } = {}) => async (req, res) => {
  if (!methods.includes(req.method)) return methodNotAllowed(res, methods)
  if (!guardWrite(req, res, { contentTypes })) return
  try {
    await fn(req, res)
  } catch (err) {
    console.error(`[${req.method} ${req.url}]`, err)
    if (err?.code === 'DB_NOT_CONFIGURED') return send(res, 503, { error: err.message, configured: false })
    alertServerError(`${req.method} ${String(req.url).split('?')[0]}`, err) // email (max 1 per 10 min)
    if (/MongoServerSelectionError|MongoNetworkError|querySrv|ENOTFOUND|ECONNREFUSED/.test(`${err?.name} ${err?.message}`))
      return send(res, 503, { error: 'Can’t reach the database right now. Please try again shortly.' })
    send(res, 500, { error: 'Something went wrong on the server.' })
  }
}
