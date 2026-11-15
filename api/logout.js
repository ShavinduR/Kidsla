import { send, sessionCookie } from './_lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' })
  return send(res, 200, { authenticated: false }, { 'Set-Cookie': sessionCookie(req, null) })
}
