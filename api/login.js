import { guardWrite } from './_lib/http.js'
import {
  clearFailures, createToken, isConfigured, lockedFor, passwordMatches, readJson, recordFailure, send, sessionCookie,
} from './_lib/auth.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' })
  if (!guardWrite(req, res)) return // JSON only + same-origin (blocks login CSRF)
  if (!isConfigured())
    return send(res, 503, { error: 'Admin login is not set up yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel.' })

  const mins = lockedFor(req)
  if (mins) return send(res, 429, { error: `Too many attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` })

  const { password } = await readJson(req)
  if (typeof password !== 'string' || !passwordMatches(password)) {
    recordFailure(req)
    await sleep(600) // slow down guessing
    return send(res, 401, { error: 'Incorrect password' })
  }

  clearFailures(req)
  return send(res, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie(req, createToken()) })
}
