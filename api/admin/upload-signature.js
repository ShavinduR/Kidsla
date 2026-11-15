// Admin: get a short-lived Cloudinary upload signature (see _lib/cloudinary.js).
import { getSession, requireAdmin } from '../_lib/auth.js'
import { handle, send } from '../_lib/http.js'
import { uploadTicket } from '../_lib/cloudinary.js'
import { hit, minutes } from '../_lib/ratelimit.js'

export default handle(['POST'], async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const ticket = uploadTicket()
  if (!ticket) return send(res, 503, { configured: false, error: 'Photo upload isn’t set up yet. Add CLOUDINARY_URL in Vercel, or paste Unsplash links for now.' })
  const r = await hit('upload', String((await getSession(req))._id).slice(0, 16))
  if (!r.allowed) return send(res, 429, { error: `Too many uploads. Try again in ${minutes(r.retryAfter)}.` })
  send(res, 200, { configured: true, ...ticket })
})
