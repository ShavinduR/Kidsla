// Admin: list every product (incl. hidden) and edit one.
import { requireAdmin } from '../_lib/auth.js'
import { handle, readJson, send } from '../_lib/http.js'
import { isDbConfigured } from '../_lib/db.js'
import { applyUpdates, loadProducts } from '../_lib/catalog.js'
import { ID_PATTERN, validateEdit } from '../../shared/inventory.js'

export default handle(['GET', 'PATCH'], async (req, res) => {
  if (!requireAdmin(req, res)) return
  if (!isDbConfigured()) return send(res, 200, { configured: false, products: [] })

  if (req.method === 'GET') return send(res, 200, { configured: true, products: await loadProducts() })

  const body = await readJson(req)
  if (!body || typeof body.id !== 'string' || !ID_PATTERN.test(body.id)) return send(res, 400, { error: 'Invalid product id' })
  const [product] = await loadProducts({ _id: body.id })
  if (!product) return send(res, 404, { error: 'Product not found' })

  const { update, diff, errors } = validateEdit(product, body)
  if (errors.length) return send(res, 400, { error: errors.join(' ') })
  if (diff.length) await applyUpdates([{ id: product.id, ...update }])
  const [saved] = await loadProducts({ _id: body.id })
  send(res, 200, { product: saved, changed: diff })
})
