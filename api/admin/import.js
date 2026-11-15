// Admin: bulk update from an Excel (.xlsx) or CSV file.
// Body = the raw file. ?dryRun=1 returns the change report without writing anything.
import ExcelJS from 'exceljs'
import { requireAdmin } from '../_lib/auth.js'
import { handle, query, readRaw, send } from '../_lib/http.js'
import { applyUpdates, loadProducts } from '../_lib/catalog.js'
import { diffRows } from '../../shared/inventory.js'
import { parseCSV } from '../../shared/csv.js'

const MAX_BYTES = 2_000_000
const MAX_ROWS = 5000

// ExcelJS cells can be numbers, strings, rich text, formulas or hyperlinks — flatten to text.
const cellText = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result)
    if ('text' in v) return cellText(v.text)
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('')
    return ''
  }
  return String(v).trim()
}

async function parseXlsx(buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const header = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => (header[col] = cellText(c.value)))
  const rows = []
  ws.eachRow((row, n) => {
    if (n === 1 || rows.length >= MAX_ROWS) return
    const obj = {}
    header.forEach((key, col) => key && (obj[key] = cellText(row.getCell(col).value)))
    if (Object.values(obj).some(Boolean)) rows.push(obj)
  })
  return rows
}

export default handle(['POST'], async (req, res) => {
  if (!requireAdmin(req, res)) return
  const q = query(req)
  const name = (q.get('filename') ?? '').toLowerCase()
  const buffer = await readRaw(req, MAX_BYTES)
  if (!buffer) return send(res, 413, { error: 'File is too large (max 2 MB).' })
  if (!buffer.length) return send(res, 400, { error: 'The file is empty.' })

  let rows
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b // .xlsx files are zip archives ("PK")
  try {
    if (isZip) rows = await parseXlsx(buffer)
    else if (name.endsWith('.csv')) rows = parseCSV(buffer.toString('utf8')).slice(0, MAX_ROWS)
    else return send(res, 415, { error: 'Please upload the .xlsx or .csv file you exported.' })
  } catch {
    return send(res, 400, { error: 'Couldn’t read that file. Re-save it from Excel as .xlsx and try again.' })
  }

  const report = diffRows(rows, await loadProducts())
  if (q.get('dryRun') === '1') return send(res, 200, { dryRun: true, ...report })

  const result = await applyUpdates(report.updates)
  send(res, 200, { dryRun: false, ...report, ...result })
})
