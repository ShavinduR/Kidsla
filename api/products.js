// Public catalogue for the storefront.
import { handle, send } from './_lib/http.js'
import { isDbConfigured } from './_lib/db.js'
import { loadProducts } from './_lib/catalog.js'

export default handle(['GET'], async (req, res) => {
  // No database yet → the site keeps using the catalogue bundled in the code.
  if (!isDbConfigured()) return send(res, 200, { configured: false, products: null })
  const products = await loadProducts({ status: { $ne: 'hidden' } })
  // Vercel's CDN serves this for 30s, then refreshes in the background: admin edits show within ~30s.
  send(res, 200, { configured: true, products }, { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300' })
})
