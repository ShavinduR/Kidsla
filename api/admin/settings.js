// Admin: read / change shop settings (version-checked like products).
import { requireAdmin } from '../_lib/auth.js'
import { audit } from '../_lib/audit.js'
import { handle, readJson, send } from '../_lib/http.js'
import { isDbConfigured } from '../_lib/db.js'
import { getSettings, saveSettings } from '../_lib/settings.js'
import { payhereConfig } from '../_lib/payhere.js'
import { fieldErrors } from '../../shared/productSchema.js'

const KEYS = ['deliveryFees', 'freeDeliveryOver', 'payments', 'bankDetails', 'holdHours', 'onlineHoldMinutes']

export default handle(['GET', 'PATCH'], async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (!isDbConfigured()) return send(res, 200, { configured: false })
  const cfg = payhereConfig()
  const extra = { payhere: cfg ? { configured: true, mode: cfg.mode, merchantId: cfg.merchantId } : { configured: false } }

  if (req.method === 'GET') return send(res, 200, { settings: await getSettings({ fresh: true }), ...extra })

  const body = await readJson(req)
  if (!body || !Number.isInteger(body.version)) return send(res, 400, { error: 'Missing version. Reload the page.' })
  const patch = Object.fromEntries(KEYS.filter((k) => k in body).map((k) => [k, body[k]]))
  const r = await saveSettings(patch, body.version)
  if (r.conflict) return send(res, 409, { error: 'Settings were changed elsewhere. The latest values are loaded.', settings: r.conflict, ...extra })
  if (r.errors) {
    const fields = fieldErrors(r.errors)
    return send(res, 400, { error: Object.values(fields)[0], fields })
  }
  const changed = KEYS.filter((k) => JSON.stringify(r.before[k]) !== JSON.stringify(r.after[k]))
  await audit(admin, 'settings.update', 'shop', { changed })
  send(res, 200, { settings: r.settings, changed, ...extra })
})
