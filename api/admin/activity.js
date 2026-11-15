// Admin: recent activity (newest first). ?target=KD-2611-004 to see one product or order's history.
import { requireAdmin } from '../_lib/auth.js'
import { handle, query, send } from '../_lib/http.js'
import { getDb, isDbConfigured } from '../_lib/db.js'

export default handle(['GET'], async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  if (!isDbConfigured()) return send(res, 200, { entries: [] })
  const target = query(req).get('target')
  const filter = target && /^[A-Za-z0-9-]{1,40}$/.test(target) ? { target } : {}
  const entries = await (await getDb()).collection('audit_log').find(filter, { projection: { _id: 0 } }).sort({ at: -1 }).limit(200).toArray()
  send(res, 200, { entries })
})
