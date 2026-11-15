// Admin: load the starter catalogue into an EMPTY database (first-time setup only).
import { requireAdmin } from '../_lib/auth.js'
import { audit } from '../_lib/audit.js'
import { handle, send } from '../_lib/http.js'
import { getDb, toDoc } from '../_lib/db.js'
import { initialProducts } from '../../src/data/products.js'

export default handle(['POST'], async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = await getDb()
  const products = db.collection('products')
  if (await products.estimatedDocumentCount()) return send(res, 409, { error: 'The database already has products.' })
  const now = new Date()
  await products.insertMany(initialProducts.map((p, i) => ({ ...toDoc(p), position: i, version: 0, reserved: {}, createdAt: now, updatedAt: now })))
  await audit(admin, 'catalogue.seed', null, { inserted: initialProducts.length })
  send(res, 201, { inserted: initialProducts.length })
})
