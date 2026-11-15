// Inventory spreadsheet format + validation. Shared by /api (server) and the admin UI.
import { CLOTHING_SIZES } from '../src/data/sizeGuide.js'

export const SIZES = CLOTHING_SIZES
export const STATUSES = ['active', 'coming_soon', 'hidden']
export const INVENTORY_COLUMNS = ['id', 'title', 'category', 'gender', 'material', 'price', 'status', ...SIZES.map((s) => `stock_${s}`)]
export const ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,24}$/

export const productsToRows = (products) =>
  products.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    gender: p.gender ?? '',
    material: p.material,
    price: p.price,
    status: p.status,
    ...Object.fromEntries(SIZES.map((s) => [`stock_${s}`, p.category === 'Clothing' ? (p.stock?.[s] ?? 0) : ''])),
  }))

const isBlank = (v) => v === undefined || v === null || String(v).trim() === ''

/** Validate one set of edits for a product. Returns { update, diff, errors }. */
export function validateEdit(product, input, where = product.id) {
  const update = {}
  const diff = []
  const errors = []

  if (!isBlank(input.price)) {
    const price = Number(input.price)
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) errors.push(`${where}: invalid price "${input.price}".`)
    else if (Math.round(price) !== product.price) {
      update.price = Math.round(price)
      diff.push(`price ${product.price} → ${update.price}`)
    }
  }
  if (!isBlank(input.status)) {
    const status = String(input.status).trim()
    if (!STATUSES.includes(status)) errors.push(`${where}: status must be ${STATUSES.join(' / ')}.`)
    else if (status !== product.status) {
      update.status = status
      diff.push(`status ${product.status} → ${status}`)
    }
  }
  if (product.category === 'Clothing') {
    for (const s of SIZES) {
      const v = input.stock ? input.stock[s] : input[`stock_${s}`]
      if (isBlank(v)) continue
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0 || n > 100_000) {
        errors.push(`${where}: stock for ${s} must be a whole number ≥ 0.`)
        continue
      }
      const current = product.stock?.[s] ?? 0
      if (n !== current) {
        ;(update.stock ??= {})[s] = n
        diff.push(`${s} stock ${current} → ${n}`)
      }
    }
  }
  return { update, diff, errors }
}

/** Compare spreadsheet rows with the catalogue. Nothing is written here. */
export function diffRows(rows, products) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const updates = []
  const changes = []
  const errors = []
  const seen = new Set()

  if (!rows.length) errors.push('The file has no data rows.')
  else if (!('id' in rows[0])) errors.push('Missing the "id" column. Export the inventory first and edit that file.')

  rows.forEach((r, i) => {
    const id = String(r.id ?? '').trim()
    const line = `Row ${i + 2}`
    if (!id) return
    if (seen.has(id)) return errors.push(`${line}: "${id}" appears more than once — only the first row was used.`)
    seen.add(id)
    const p = byId.get(id)
    if (!p) return errors.push(`${line}: unknown product id "${id}".`)
    const { update, diff, errors: errs } = validateEdit(p, r, `${line} (${id})`)
    if (errs.length) return errors.push(...errs) // a row with any problem is skipped entirely
    if (diff.length) {
      updates.push({ id, ...update })
      changes.push({ id, title: p.title, diff })
    }
  })
  return { rows: rows.length, updates, changes, errors }
}
