// Admin sign-in. Brute-force protection is shared by all server instances (stored in MongoDB):
//   • 5 wrong passwords per IP per 15 min → that IP waits
//   • 100 wrong passwords site-wide per hour → sign-in paused for everyone + email alert
//     (stops attacks spread across many IPs; a long password makes them hopeless anyway)
import { createSession, isConfigured, passwordMatches, sessionCookie } from './_lib/auth.js'
import { handle, readJson, send } from './_lib/http.js'
import { hit, ipKey, minutes, peek, reset, RULES } from './_lib/ratelimit.js'
import { alertLoginAttack } from './_lib/alerts.js'
import { audit } from './_lib/audit.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default handle(['POST'], async (req, res) => {
  if (!isConfigured())
    return send(res, 503, { error: 'Admin login is not set up yet. Add ADMIN_PASSWORD, ADMIN_SESSION_SECRET and MONGODB_URI in Vercel.' })

  const ip = ipKey(req)
  const [mine, everyone] = await Promise.all([peek('loginFailIp', ip), peek('loginFailAll', 'all')])
  if (mine.blocked) return send(res, 429, { error: `Too many attempts. Try again in ${minutes(mine.retryAfter)}.` }, { 'Retry-After': String(mine.retryAfter) })
  if (everyone.blocked)
    return send(res, 429, { error: `Sign-in is paused because of many failed attempts. Try again in ${minutes(everyone.retryAfter)}.` }, { 'Retry-After': String(everyone.retryAfter) })

  const body = await readJson(req)
  const password = body?.password
  if (typeof password !== 'string' || !passwordMatches(password)) {
    const [, all] = await Promise.all([hit('loginFailIp', ip), hit('loginFailAll', 'all')])
    if (all.count === RULES.loginFailAll.limit) alertLoginAttack(all.count) // exactly once per hour
    await audit('login', 'admin.login_failed', null, { ip: ip.slice(0, 8) })
    await sleep(600) // slow down guessing
    return send(res, 401, { error: 'Incorrect password' })
  }

  await reset('loginFailIp', ip)
  const token = await createSession(req)
  await audit('login', 'admin.login', null, { ip: ip.slice(0, 8), device: String(req.headers['user-agent'] ?? '').slice(0, 80) })
  send(res, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie(req, token) })
})
