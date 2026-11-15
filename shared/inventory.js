// Inventory spreadsheet format + validation. Shared by /api (server) and the admin UI.
import { CLOTHING_SIZES } from '../src/data/sizeGuide.js'
import { PRODUCT_STATUSES } from './productSchema.js'

export const SIZES = CLOTHING_SIZES
export const STATUSES = PRODUCT_STATUSES
// `version` = optimistic-concurrency counter. Every write to a product (admin edit, import, order
// confirm/cancel) increments it. An import row or edit is only applied if the version it was based on
// is still current, so stale spreadsheets / dialogs can't silently overwrite newer stock (audit H1).
// stock_<size> = units AVAILABLE to sell (editable). held_<size> = units held by pending orders
// (read-only, for information; ignored on import). Units on your shelf = stock + held.
export const INVENTORY_COLUMNS = [
  'id', 'version', 'title', 'category', 'gender', 'material', 'price', 'status',
  ...SIZES.map((s) => `stock_${s}`),
  ...SIZES.map((s) => `held_${s}`),
]
export const ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,24}$/

/** Shorten user-supplied text before echoing it back in messages (audit M1). */
export const clip = (v, max = 40) => {
  const s = String(v ?? '')
  return s.length > max ? `${s.slice(0, max)}…` : s
}

const toVersion = (v) => {
  const n = Number(String(v ?? '').trim())
  return String(v ?? '').trim() !== '' && Number.isInteger(n) && n >= 0 ? n : null
}

export const productsToRows = (products) =>
  products.map((p) => ({
    id: p.id,
    version: p.version ?? 0,
    title: p.title,
    category: p.category,
    gender: p.gender ?? '',
    material: p.material,
    price: p.price,
    status: p.status,
    ...Object.fromEntries(SIZES.map((s) => [`stock_${s}`, p.category === 'Clothing' ? (p.stock?.[s] ?? 0) : ''])),
    ...Object.fromEntries(SIZES.map((s) => [`held_${s}`, p.category === 'Clothing' ? (p.reserved?.[s] ?? 0) : ''])),
  }))

const isBlank = (v) => v === undefined || v === null || String(v).trim() === ''

/** Validate one set of edits for a product. Returns { update, diff, errors }. */
export function validateEdit(product, input, where = product.id) {
  const update = {}
  const diff = []
  const errors = []

  if (!isBlank(input.price)) {
    const price = Number(input.price)
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) errors.push(`${where}: invalid price "${clip(input.price)}".`)
    else if (Math.round(price) !== product.price) {
      update.price = Math.round(price)
      diff.push(`price ${product.price} → ${update.price}`)
    }
  }
  if (!isBlank(input.status)) {
    const status = String(input.status).trim()
    if (!STATUSES.includes(status)) errors.push(`${where}: status "${clip(status)}" must be ${STATUSES.join(' / ')}.`)
    else if (status === 'active' && product.category !== 'Clothing') errors.push(`${where}: ${product.category} items can’t be ordered yet: use coming_soon.`)
    else if (status !== product.status) {
      update.status = status
      diff.push(`status ${product.status} → ${status}`)
    }
  }
  if (product.category === 'Clothing') {
    for (const s of SIZES) {
      // Dialog sends { stock: { '1-2Y': 4 } }; spreadsheets send stock_1-2Y columns. A stray text
      // column literally named "stock" must not hide the real stock_ columns (audit L3).
      const v = input.stock && typeof input.stock === 'object' ? input.stock[s] : input[`stock_${s}`]
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
  else if (!('version' in rows[0])) {
    errors.push('This file has no "version" column, so it was exported before change-tracking existed. Export a fresh copy and edit that.')
    return { rows: rows.length, updates, changes, errors }
  }

  rows.forEach((r, i) => {
    const id = String(r.id ?? '').trim()
    const line = `Row ${i + 2}`
    if (!id) return
    if (seen.has(id)) return errors.push(`${line}: "${clip(id)}" appears more than once — only the first row was used.`)
    seen.add(id)
    const p = byId.get(id)
    if (!p) return errors.push(`${line}: unknown product id "${clip(id)}".`)

    const version = toVersion(r.version)
    if (version === null) return errors.push(`${line} (${id}): "version" must not be edited or removed.`)
    const current = p.version ?? 0
    if (version !== current) {
      return errors.push(
        `${line} (${id}): ${p.title} changed after you exported (orders or edits since then). Export a fresh copy to update it.`,
      )
    }

    const { update, diff, errors: errs } = validateEdit(p, r, `${line} (${id})`)
    if (errs.length) return errors.push(...errs) // a row with any problem is skipped entirely
    if (diff.length) {
      updates.push({ id, expectedVersion: current, ...update })
      changes.push({ id, title: p.title, diff })
    }
  })
  return { rows: rows.length, updates, changes, errors }
}
