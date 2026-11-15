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
  let [product] = await loadProducts({ _id: body.id })
  if (!product) return send(res, 404, { error: 'Product not found' })

  // Optimistic concurrency (audit H1): the dialog sends the version it loaded. If an order was
  // confirmed or someone else saved in the meantime, refuse and hand back the latest values.
  const conflict = () =>
    send(res, 409, {
      error: 'This product changed while you were editing it (for example an order was confirmed). The latest values are loaded. Check them and save again.',
      product,
    })
  if (!Number.isInteger(body.version) || body.version < 0) return send(res, 400, { error: 'Missing version. Reload the page.' })
  if (body.version !== (product.version ?? 0)) return conflict()

  const { update, diff, errors } = validateEdit(product, body)
  if (errors.length) return send(res, 400, { error: errors.join(' ') })
  if (diff.length) {
    const r = await applyUpdates([{ id: product.id, expectedVersion: body.version, ...update }])
    if (r.conflicts.length) {
      ;[product] = await loadProducts({ _id: body.id }) // lost the race by milliseconds
      return conflict()
    }
  }
  const [saved] = await loadProducts({ _id: body.id })
  send(res, 200, { product: saved, changed: diff })
})
