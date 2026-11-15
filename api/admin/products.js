// Admin: list, create and edit products.
//  • Every create/edit is validated with the SAME zod rules the admin form uses (shared/productSchema.js).
//  • Edits carry the version they were based on: a stale edit gets 409 + the latest values (audit H1).
//  • Products are never deleted: status "archived" removes them from the shop but keeps old orders intact.
import { requireAdmin } from '../_lib/auth.js'
import { audit } from '../_lib/audit.js'
import { handle, readJson, send } from '../_lib/http.js'
import { fromDoc, getDb, isDbConfigured } from '../_lib/db.js'
import { loadProducts } from '../_lib/catalog.js'
import { isOwnCloudinaryImage } from '../_lib/cloudinary.js'
import { ID_PATTERN } from '../../shared/inventory.js'
import { EDITABLE_FIELDS, ONE_SIZE, fieldErrors, productSchema, slugify } from '../../shared/productSchema.js'

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k]]))
const invalid = (res, fields) => send(res, 400, { error: Object.values(fields)[0], fields })

/** New photos must be our own Cloudinary uploads or Unsplash links (both allowed by the CSP). */
function badImages(images, existing = []) {
  const fresh = images.filter((u) => !existing.includes(u))
  const bad = fresh.find((u) => new URL(u).hostname === 'res.cloudinary.com' && !isOwnCloudinaryImage(u))
  return bad ? { images: 'That Cloudinary image isn’t from this shop’s account. Upload it here instead.' } : null
}

async function slugTaken(db, slug, exceptId) {
  return Boolean(await db.collection('products').findOne({ slug, _id: { $ne: exceptId } }, { projection: { _id: 1 } }))
}

// SKU per line: KD-G-### (girls), KD-B-### (boys), KD-T-### (toys), KD-E-### (educational).
async function nextProductId(db, p) {
  const prefix = p.category === 'Clothing' ? (p.gender === 'Girls' ? 'KD-G' : 'KD-B') : p.category === 'Toys' ? 'KD-T' : 'KD-E'
  const ids = await db.collection('products').find({ _id: { $regex: `^${prefix}-\\d+$` } }, { projection: { _id: 1 } }).toArray()
  const highest = Math.max(0, ...ids.map((d) => Number(d._id.split('-').pop())))
  const counters = db.collection('counters')
  await counters.updateOne({ _id: `product-${prefix}` }, { $max: { seq: highest } }, { upsert: true })
  const { seq } = await counters.findOneAndUpdate({ _id: `product-${prefix}` }, { $inc: { seq: 1 } }, { returnDocument: 'after' })
  return `${prefix}-${String(seq).padStart(3, '0')}`
}

const describe = (before, after) => {
  const out = []
  if (before.price !== after.price) out.push(`price ${before.price} → ${after.price}`)
  if (before.status !== after.status) out.push(`status ${before.status} → ${after.status}`)
  for (const s of new Set([...Object.keys(before.stock ?? {}), ...Object.keys(after.stock ?? {})]))
    if ((before.stock?.[s] ?? 0) !== (after.stock?.[s] ?? 0)) out.push(`${s} stock ${before.stock?.[s] ?? 0} → ${after.stock?.[s] ?? 0}`)
  const labels = { title: 'title', slug: 'link', description: 'description', category: 'category', gender: 'girls/boys', material: 'material', badge: 'badge', sizes: 'sizes', colors: 'colours', images: 'photos' }
  const norm = (v) => JSON.stringify(v === undefined || v === '' ? null : v) // missing badge == '' badge
  for (const [k, label] of Object.entries(labels)) if (norm(before[k]) !== norm(after[k])) out.push(`${label} updated`)
  return out
}

export default handle(['GET', 'POST', 'PATCH'], async (req, res) => {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (!isDbConfigured()) return send(res, 200, { configured: false, products: [] })
  const db = await getDb()
  const products = db.collection('products')

  if (req.method === 'GET') return send(res, 200, { configured: true, products: await loadProducts() })

  const body = await readJson(req)
  if (!body || typeof body !== 'object') return send(res, 400, { error: 'Invalid request' })

  // ---------- Create ----------
  if (req.method === 'POST') {
    const input = pick(body, EDITABLE_FIELDS)
    if (input.category && input.category !== 'Clothing') Object.assign(input, { sizes: [ONE_SIZE], gender: null, stock: {} })
    input.slug = input.slug || slugify(input.title)
    const parsed = productSchema.safeParse(input)
    if (!parsed.success) return invalid(res, fieldErrors(parsed.error))
    const imgErr = badImages(parsed.data.images)
    if (imgErr) return invalid(res, imgErr)
    if (await slugTaken(db, parsed.data.slug)) return invalid(res, { slug: 'Another product already uses this link name' })

    const [first] = await products.find({}, { projection: { position: 1 } }).sort({ position: 1 }).limit(1).toArray()
    const now = new Date()
    const doc = {
      _id: await nextProductId(db, parsed.data),
      ...parsed.data,
      gender: parsed.data.gender ?? null,
      reserved: {},
      version: 0,
      position: (first?.position ?? 0) - 1, // new products appear first
      createdAt: now,
      updatedAt: now,
    }
    await products.insertOne(doc)
    await audit(admin, 'product.create', doc._id, { title: doc.title })
    return send(res, 201, { product: fromDoc(doc) })
  }

  // ---------- Edit ----------
  if (typeof body.id !== 'string' || !ID_PATTERN.test(body.id)) return send(res, 400, { error: 'Invalid product id' })
  let [product] = await loadProducts({ _id: body.id })
  if (!product) return send(res, 404, { error: 'Product not found' })
  const conflict = () =>
    send(res, 409, {
      error: 'This product changed while you were editing it (for example an order was confirmed). The latest values are loaded. Check them and save again.',
      product,
    })
  if (!Number.isInteger(body.version) || body.version < 0) return send(res, 400, { error: 'Missing version. Reload the page.' })
  if (body.version !== (product.version ?? 0)) return conflict()

  const patch = pick(body, EDITABLE_FIELDS)
  const current = pick(product, EDITABLE_FIELDS)
  const merged = { ...current, ...patch, stock: { ...(product.stock ?? {}), ...(patch.stock ?? {}) } }
  if (merged.category !== 'Clothing') Object.assign(merged, { gender: null, stock: {} })
  if (merged.category === 'Clothing' && current.category !== 'Clothing' && !('sizes' in patch)) merged.sizes = []

  // Removing a size (or changing category) must not strand units held by pending orders.
  const held = Object.entries(product.reserved ?? {}).filter(([s, n]) => n > 0 && !merged.sizes.includes(s))
  if (held.length) return invalid(res, { sizes: `Can’t remove ${held.map(([s, n]) => `${s} (${n} held by pending orders)`).join(', ')}` })
  for (const s of Object.keys(merged.stock)) if (!merged.sizes.includes(s)) delete merged.stock[s]

  const parsed = productSchema.safeParse(merged)
  if (!parsed.success) return invalid(res, fieldErrors(parsed.error))
  const imgErr = badImages(parsed.data.images, product.images)
  if (imgErr) return invalid(res, imgErr)
  if (parsed.data.slug !== product.slug && (await slugTaken(db, parsed.data.slug, product.id)))
    return invalid(res, { slug: 'Another product already uses this link name' })

  const next = { ...parsed.data, gender: parsed.data.gender ?? null }
  const changed = describe(product, next)
  if (!changed.length) return send(res, 200, { product, changed })

  const r = await products.updateOne(
    { _id: product.id, version: body.version },
    { $set: { ...next, updatedAt: new Date() }, $inc: { version: 1 } },
  )
  if (!r.matchedCount) {
    ;[product] = await loadProducts({ _id: body.id }) // lost a race by milliseconds
    return conflict()
  }
  const [saved] = await loadProducts({ _id: body.id })
  await audit(admin, next.status === 'archived' && product.status !== 'archived' ? 'product.archive' : 'product.update', product.id, { changed })
  send(res, 200, { product: saved, changed })
})
