import { isAuthenticated, isConfigured, send } from './_lib/auth.js'

export default function handler(req, res) {
  return send(res, 200, { authenticated: isAuthenticated(req), configured: isConfigured() })
}
