// Log out. Deletes the session on the server, so the cookie is useless even if it was copied.
// Body { "all": true } → sign out ALL devices (must be signed in).
import { destroyAllSessions, destroySession, isAuthenticated, sessionCookie } from './_lib/auth.js'
import { handle, readJson, send } from './_lib/http.js'
import { isDbConfigured } from './_lib/db.js'

export default handle(['POST'], async (req, res) => {
  const clear = { 'Set-Cookie': sessionCookie(req, null) }
  if (!isDbConfigured()) return send(res, 200, { authenticated: false }, clear)
  const body = (await readJson(req)) ?? {}
  if (body.all === true) {
    if (!(await isAuthenticated(req))) return send(res, 401, { error: 'Not signed in' })
    const ended = await destroyAllSessions()
    return send(res, 200, { authenticated: false, ended }, clear)
  }
  await destroySession(req)
  send(res, 200, { authenticated: false }, clear)
})
