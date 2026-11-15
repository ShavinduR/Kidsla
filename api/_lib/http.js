// Small helpers so handlers run unchanged on Vercel and in Vite's local dev server.

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

/** Wraps a handler: method check + JSON 500 on unexpected errors (details logged, not leaked). */
export const handle = (methods, fn) => async (req, res) => {
  if (!methods.includes(req.method)) return methodNotAllowed(res, methods)
  try {
    await fn(req, res)
  } catch (err) {
    console.error(`[${req.method} ${req.url}]`, err)
    if (err?.code === 'DB_NOT_CONFIGURED') return send(res, 503, { error: err.message, configured: false })
    if (/MongoServerSelectionError|MongoNetworkError|querySrv|ENOTFOUND|ECONNREFUSED/.test(`${err?.name} ${err?.message}`))
      return send(res, 503, { error: 'Can’t reach the database right now. Please try again shortly.' })
    send(res, 500, { error: 'Something went wrong on the server.' })
  }
}
