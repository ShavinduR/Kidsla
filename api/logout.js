import { send, sessionCookie } from './_lib/auth.js'
import { guardWrite } from './_lib/http.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' })
  if (!guardWrite(req, res)) return // stops other sites from logging you out
  return send(res, 200, { authenticated: false }, { 'Set-Cookie': sessionCookie(req, null) })
}
