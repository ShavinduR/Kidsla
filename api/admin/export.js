// Admin: download the inventory as Excel (.xlsx, default) or CSV.
import ExcelJS from 'exceljs'
import { requireAdmin } from '../_lib/auth.js'
import { handle, query, sendFile } from '../_lib/http.js'
import { loadProducts } from '../_lib/catalog.js'
import { INVENTORY_COLUMNS, productsToRows } from '../../shared/inventory.js'
import { toCSV } from '../../shared/csv.js'

export default handle(['GET'], async (req, res) => {
  if (!requireAdmin(req, res)) return
  const rows = productsToRows(await loadProducts())
  const date = new Date().toISOString().slice(0, 10)

  if (query(req).get('format') === 'csv') {
    return sendFile(res, '﻿' + toCSV(rows, INVENTORY_COLUMNS), `KIDSLA-inventory-${date}.csv`, 'text/csv; charset=utf-8')
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'KIDSLA'
  const ws = wb.addWorksheet('Inventory', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = INVENTORY_COLUMNS.map((key) => ({
    header: key,
    key,
    width: key === 'title' ? 28 : key === 'material' ? 24 : key.startsWith('stock_') ? 11 : 14,
  }))
  ws.addRows(rows)
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE3D5' } }
  // Make it obvious which columns are safe to edit.
  ;['id', 'title', 'category', 'gender', 'material'].forEach((k) => (ws.getColumn(k).font = { color: { argb: 'FF7A736A' } }))
  ws.getColumn('status').eachCell((c, row) => {
    if (row > 1) c.dataValidation = { type: 'list', allowBlank: false, formulae: ['"active,coming_soon,hidden"'] }
  })

  sendFile(res, Buffer.from(await wb.xlsx.writeBuffer()), `KIDSLA-inventory-${date}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
})
