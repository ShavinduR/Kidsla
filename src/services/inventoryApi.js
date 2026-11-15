/**
 * Inventory API — MOCK.
 *
 * Today: runs entirely in the browser (CSV export/import) so the admin UI is usable now.
 * Later: each function becomes a fetch() to the Node.js/Express backend described below
 * and in docs/BACKEND.md. The UI won't need to change.
 *
 *   GET  /api/admin/inventory/export   → streams KIDSLA-inventory.xlsx
 *   POST /api/admin/inventory/import   → multipart upload (.xlsx/.csv), returns a change report
 *
 * Backend flow for import:
 *   1. multer (memoryStorage) receives the file           → req.file.buffer
 *   2. xlsx: XLSX.read(buffer) → sheet_to_json(rows)       → plain JS objects
 *   3. Validate each row (id exists, price ≥ 0, stock integers ≥ 0, status enum)
 *   4. Product.bulkWrite(rows.map(r => ({ updateOne: { filter: { sku: r.id }, update: { $set: {...} } } })))
 *      — ONE round-trip to MongoDB no matter how many rows.
 *   5. Respond { matched, modified, errors[] } so the admin sees exactly what changed.
 */
import { CLOTHING_SIZES } from '../data/sizeGuide'
import { toCSV, parseCSV, downloadFile } from '../utils/csv'

const SIZE_COLS = CLOTHING_SIZES.map((s) => `stock_${s}`)
export const INVENTORY_COLUMNS = ['id', 'title', 'category', 'gender', 'material', 'price', 'status', ...SIZE_COLS]
const STATUSES = ['active', 'coming_soon', 'hidden']

const log = (...a) => console.log('%c[inventoryApi]', 'color:#55654B;font-weight:600', ...a)

export function productsToRows(products) {
  return products.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    gender: p.gender ?? '',
    material: p.material,
    price: p.price,
    status: p.status,
    ...Object.fromEntries(CLOTHING_SIZES.map((s) => [`stock_${s}`, p.category === 'Clothing' ? (p.stock?.[s] ?? 0) : ''])),
  }))
}

export async function exportInventory(products) {
  log('EXPORT → production: GET /api/admin/inventory/export')
  log('Server: const rows = await Product.find().lean(); const ws = XLSX.utils.json_to_sheet(rows);')
  log('        XLSX.utils.book_append_sheet(wb, ws, "Inventory"); res.send(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))')
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(toCSV(productsToRows(products), INVENTORY_COLUMNS), `KIDSLA-inventory-${date}.csv`)
  log('Demo: generated CSV in the browser (opens in Excel).')
}

/**
 * Validates an uploaded sheet against the current catalogue.
 * Returns { updates, changes, errors } — nothing is applied until the admin confirms.
 */
export async function previewImport(file, products) {
  log(`IMPORT → production: POST /api/admin/inventory/import  (file: ${file.name}, ${file.size} bytes)`)
  log('Server: multer → XLSX.read(req.file.buffer) → sheet_to_json → validate → Product.bulkWrite([...updateOne])')

  if (!/\.csv$/i.test(file.name)) {
    log('Demo mode parses .csv only. .xlsx is parsed by the Node backend with the `xlsx` package.')
    return { updates: [], changes: [], errors: ['Demo mode accepts .csv files. In Excel use File → Save As → CSV UTF-8. (.xlsx will be supported once the Node backend is connected.)'] }
  }

  const rows = parseCSV(await file.text())
  const byId = new Map(products.map((p) => [p.id, p]))
  const updates = [], changes = [], errors = []

  if (!rows.length) errors.push('The file has no data rows.')
  else if (!('id' in rows[0])) errors.push('Missing required "id" column. Export first and edit that file.')

  rows.forEach((r, i) => {
    const line = i + 2 // header is line 1
    const p = byId.get(r.id)
    if (!r.id) return
    if (!p) return errors.push(`Row ${line}: unknown product id "${r.id}" (new products must be added in the dashboard).`)

    const u = { id: p.id }
    const diff = []

    if (r.price !== undefined && r.price !== '') {
      const price = Number(r.price)
      if (!Number.isFinite(price) || price < 0) errors.push(`Row ${line} (${p.id}): invalid price "${r.price}".`)
      else if (price !== p.price) { u.price = price; diff.push(`price ${p.price} → ${price}`) }
    }
    if (r.status) {
      if (!STATUSES.includes(r.status)) errors.push(`Row ${line} (${p.id}): status must be ${STATUSES.join(' / ')}.`)
      else if (r.status !== p.status) { u.status = r.status; diff.push(`status ${p.status} → ${r.status}`) }
    }
    if (p.category === 'Clothing') {
      for (const s of CLOTHING_SIZES) {
        const v = r[`stock_${s}`]
        if (v === undefined || v === '') continue
        const n = Number(v)
        if (!Number.isInteger(n) || n < 0) { errors.push(`Row ${line} (${p.id}): stock_${s} must be a whole number ≥ 0.`); continue }
        if (n !== (p.stock?.[s] ?? 0)) { (u.stock ??= {})[s] = n; diff.push(`${s} stock ${p.stock?.[s] ?? 0} → ${n}`) }
      }
    }
    if (diff.length) { updates.push(u); changes.push({ id: p.id, title: p.title, diff }) }
  })

  log(`Validated ${rows.length} rows: ${changes.length} products changed, ${errors.length} errors.`)
  return { updates, changes, errors }
}

export async function commitImport(updates, applyUpdates) {
  log('COMMIT → production: server runs Product.bulkWrite(ops, { ordered: false }) inside a transaction.')
  log('Ops:', updates.map((u) => ({ updateOne: { filter: { sku: u.id }, update: { $set: u } } })))
  applyUpdates(updates)
  return { matched: updates.length, modified: updates.length }
}
