// Daily safety net: release stock held by pending orders older than 24 h.
// (Expiry also runs automatically at every checkout and whenever the admin opens Orders,
// so this only matters on quiet days.) Scheduled in vercel.json → "crons".
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". Set CRON_SECRET in Vercel to enable.
import crypto from 'node:crypto'
import { handle, send } from '../_lib/http.js'
import { releaseExpired } from '../_lib/orders.js'

const authorized = (req) => {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const a = Buffer.from(String(req.headers.authorization ?? ''))
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export default handle(['GET'], async (req, res) => {
  if (!authorized(req)) return send(res, 401, { error: 'Unauthorized' })
  let released = 0
  for (let i = 0; i < 20; i++) {
    const n = await releaseExpired(50)
    released += n
    if (n < 50) break
  }
  console.log(`[cron] released ${released} expired orders`)
  send(res, 200, { released })
})
