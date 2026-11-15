# Backend plan — Inventory bulk import/export (Node.js + Express + MongoDB + xlsx)

The frontend already calls `src/services/inventoryApi.js`. Today it works in-browser with CSV;
swap each function body for a `fetch()` to these endpoints and the Admin UI stays the same.

## Install

```bash
npm i express mongoose multer xlsx
# SheetJS: prefer the official build (the npm "xlsx" 0.18.x is old):
npm i https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz
```

## Model

```js
// models/Product.js
const SIZES = ['1-2Y', '3-4Y', '5-6Y']
const ProductSchema = new mongoose.Schema({
  sku:      { type: String, required: true, unique: true }, // e.g. KD-G-001 (the "id" column)
  title:    String,
  category: { type: String, enum: ['Clothing', 'Toys', 'Educational'] },
  gender:   { type: String, enum: ['Girls', 'Boys', null] },
  material: String,
  price:    { type: Number, min: 0 },
  status:   { type: String, enum: ['active', 'coming_soon', 'hidden'], default: 'active' },
  stock:    { type: Map, of: { type: Number, min: 0 } },   // { '1-2Y': 6, ... }
  images:   [String],
}, { timestamps: true })
```

## Routes (protect with auth middleware — never ship /admin without it)

```js
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// EXPORT
router.get('/api/admin/inventory/export', requireAdmin, async (req, res) => {
  const products = await Product.find().lean()
  const rows = products.map(p => ({
    id: p.sku, title: p.title, category: p.category, gender: p.gender ?? '', material: p.material,
    price: p.price, status: p.status,
    ...Object.fromEntries(SIZES.map(s => [`stock_${s}`, p.stock?.[s] ?? 0])),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Inventory')
  res.setHeader('Content-Disposition', 'attachment; filename="KIDSLA-inventory.xlsx"')
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
})

// IMPORT  (?dryRun=1 returns the change report without writing — powers the "Review import" dialog)
router.post('/api/admin/inventory/import', requireAdmin, upload.single('file'), async (req, res) => {
  const wb = XLSX.read(req.file.buffer)                        // .xlsx, .xls and .csv
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })

  const errors = [], ops = []
  rows.forEach((r, i) => {
    const $set = {}
    if (r.price !== '') { const n = Number(r.price); n >= 0 ? ($set.price = n) : errors.push(`Row ${i + 2}: bad price`) }
    if (r.status) ['active','coming_soon','hidden'].includes(r.status) ? ($set.status = r.status) : errors.push(`Row ${i + 2}: bad status`)
    for (const s of SIZES) {
      const v = r[`stock_${s}`]; if (v === '') continue
      Number.isInteger(+v) && +v >= 0 ? ($set[`stock.${s}`] = +v) : errors.push(`Row ${i + 2}: bad stock_${s}`)
    }
    if (r.id && Object.keys($set).length) ops.push({ updateOne: { filter: { sku: String(r.id) }, update: { $set } } })
  })

  if (req.query.dryRun) return res.json({ rows: rows.length, ops: ops.length, errors })
  const result = await Product.bulkWrite(ops, { ordered: false }) // ONE round-trip for all rows
  res.json({ matched: result.matchedCount, modified: result.modifiedCount, errors })
})
```

## Also needed before launch
- **Auth** for `/api/admin/*` (e.g. a single admin account + httpOnly session cookie, or Clerk/Auth0).
- **Order IDs** from a Mongo counter (`findOneAndUpdate({ _id: 'order' }, { $inc: { seq: 1 } }, { upsert: true })`) instead of random digits.
- **Stock decrement** when you confirm a WhatsApp order (an "Orders" screen in the admin).
