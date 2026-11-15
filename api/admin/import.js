// Admin: bulk update from an Excel (.xlsx) or CSV file.
// Body = the raw file. ?dryRun=1 returns the change report without writing anything.
import ExcelJS from 'exceljs'
import { requireAdmin } from '../_lib/auth.js'
import { handle, query, readRaw, send } from '../_lib/http.js'
import { applyUpdates, loadProducts } from '../_lib/catalog.js'
import { diffRows } from '../../shared/inventory.js'
import { parseCSV } from '../../shared/csv.js'
import { UnsafeFileError, assertSafeZip } from '../_lib/zipguard.js'

const MAX_BYTES = 2_000_000 // uploaded file (compressed)
const MAX_ROWS = 5000 // data rows read; anything beyond is ignored and reported
const MAX_CELL = 200 // characters kept per cell
const MAX_ERRORS = 100 // problems returned to the browser

// ExcelJS cells can be numbers, strings, rich text, formulas or hyperlinks — flatten to text.
const cellText = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result)
    if ('text' in v) return cellText(v.text)
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').trim().slice(0, MAX_CELL)
    return ''
  }
  return String(v).trim().slice(0, MAX_CELL)
}

async function parseXlsx(buffer) {
  assertSafeZip(buffer) // throws before ExcelJS allocates anything big
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return { rows: [], truncated: false }
  const header = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => (header[col] = cellText(c.value).slice(0, 40)))
  const rows = []
  const last = Math.min(ws.rowCount, MAX_ROWS + 1)
  for (let n = 2; n <= last; n++) {
    const row = ws.getRow(n)
    const obj = Object.create(null) // no prototype: a "__proto__" column is just a column
    header.forEach((key, col) => key && (obj[key] = cellText(row.getCell(col).value)))
    if (Object.values(obj).some(Boolean)) rows.push(obj)
  }
  return { rows, truncated: ws.rowCount > MAX_ROWS + 1 }
}

export default handle(['POST'], async (req, res) => {
  if (!requireAdmin(req, res)) return
  const q = query(req)
  const name = (q.get('filename') ?? '').toLowerCase()
  const buffer = await readRaw(req, MAX_BYTES)
  if (!buffer) return send(res, 413, { error: 'File is too large (max 2 MB).' })
  if (!buffer.length) return send(res, 400, { error: 'The file is empty.' })

  let rows
  let truncated = false
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b // .xlsx files are zip archives ("PK")
  try {
    if (isZip) ({ rows, truncated } = await parseXlsx(buffer))
    else if (name.endsWith('.csv')) {
      const all = parseCSV(buffer.toString('utf8'))
      truncated = all.length > MAX_ROWS
      rows = all.slice(0, MAX_ROWS).map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, MAX_CELL)])),
      )
    } else return send(res, 415, { error: 'Please upload the .xlsx or .csv file you exported.' })
  } catch (err) {
    if (err instanceof UnsafeFileError) return send(res, 400, { error: err.message })
    console.error('[import] parse failed', err?.message)
    return send(res, 400, { error: 'Couldn’t read that file. Re-save it from Excel as .xlsx and try again.' })
  }

  const report = diffRows(rows, await loadProducts())
  if (truncated) report.errors.unshift(`Only the first ${MAX_ROWS} rows were read.`)
  if (report.errors.length > MAX_ERRORS) {
    const more = report.errors.length - MAX_ERRORS
    report.errors = [...report.errors.slice(0, MAX_ERRORS), `…and ${more} more problem${more === 1 ? '' : 's'}.`]
  }
  if (q.get('dryRun') === '1') return send(res, 200, { dryRun: true, ...report })

  const result = await applyUpdates(report.updates)
  send(res, 200, { dryRun: false, ...report, ...result })
}, { contentTypes: ['application/octet-stream'] })
