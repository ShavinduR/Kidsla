// Public shop settings for the storefront (delivery fees, payment methods, bank details…).
import { handle, send } from './_lib/http.js'
import { getSettings, publicSettings } from './_lib/settings.js'
import { payhereConfig } from './_lib/payhere.js'

export default handle(['GET'], async (req, res) => {
  const s = await getSettings()
  send(res, 200, publicSettings(s, Boolean(payhereConfig())), { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' })
})
