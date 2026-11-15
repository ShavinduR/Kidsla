import { useMemo, useRef, useState } from 'react'
import { Database, Download, FileSpreadsheet, Package, PackageX, Pencil, RefreshCw, Search, TriangleAlert, Upload } from 'lucide-react'
import ImportDialog from './ImportDialog'
import EditProductDialog from './EditProductDialog'
import { btn } from './ui'
import { SIZES } from '../../../shared/inventory.js'
import { totalStock } from '../../data/products'
import { exportUrl, importInventory } from '../../services/adminApi'
import { formatLKR } from '../../utils/format'

const LOW = 3
const STATUS_STYLE = { active: 'bg-sage-light text-sage-dark', coming_soon: 'bg-blush-light text-rose', hidden: 'bg-sand text-ink-soft' }
const STATUS_LABEL = { active: 'Active', coming_soon: 'Coming soon', hidden: 'Hidden' }

export default function InventoryTab({ products, onReload, onProductSaved, toast }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(null) // { file, report }
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const stats = useMemo(() => {
    const clothing = products.filter((p) => p.category === 'Clothing')
    const slots = clothing.flatMap((p) => SIZES.map((s) => p.stock?.[s] ?? 0))
    return {
      total: products.length,
      active: products.filter((p) => p.status === 'active').length,
      units: clothing.reduce((s, p) => s + totalStock(p), 0),
      low: slots.filter((n) => n > 0 && n <= LOW).length,
      out: slots.filter((n) => n === 0).length,
    }
  }, [products])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => (cat === 'All' || p.category === cat) && (!q || `${p.id} ${p.title} ${p.material}`.toLowerCase().includes(q)))
  }, [products, query, cat])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const res = await importInventory(file, { dryRun: true })
    setBusy(false)
    if (!res.ok) return toast(res.error ?? 'Couldn’t read that file.', 'error')
    setImporting({ file, report: res })
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inventory</h1>
          <p className="mt-1 text-ink-soft">Live from your database. Changes appear in the shop within about 30 seconds.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a href={exportUrl('xlsx')} className={btn.secondary} download>
            <Download className="h-5 w-5" /> Export to Excel
          </a>
          <button onClick={() => fileInput.current?.click()} disabled={busy} className={btn.primary}>
            <Upload className="h-5 w-5" /> {busy ? 'Checking file…' : 'Bulk Import Update'}
          </button>
          <input ref={fileInput} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFile} />
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-soft sm:text-right">
        Prefer CSV? <a href={exportUrl('csv')} className="font-medium text-sage-dark underline underline-offset-2" download>Export as CSV</a>
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Products', value: stats.total, Icon: Package },
          { label: 'Active', value: stats.active, Icon: FileSpreadsheet },
          { label: 'Units in stock', value: stats.units, Icon: Database },
          { label: `Low stock sizes (≤${LOW})`, value: stats.low, Icon: TriangleAlert, warn: stats.low > 0 },
          { label: 'Sold-out sizes', value: stats.out, Icon: PackageX, warn: stats.out > 0 },
        ].map(({ label, value, Icon, warn }) => (
          <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-sand">
            <dt className="flex items-center gap-2 text-sm text-ink-soft"><Icon className={`h-4 w-4 ${warn ? 'text-rose' : 'text-sage-dark'}`} /> {label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, SKU or material" className="h-12 w-full rounded-full bg-white pr-4 pl-11 ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark" />
        </label>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {['All', 'Clothing', 'Toys', 'Educational'].map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`h-12 shrink-0 rounded-full px-5 text-sm font-medium transition-colors ${cat === c ? 'bg-ink text-cream' : 'bg-sand/70 text-ink hover:bg-sand-dark'}`}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={onReload} className={btn.ghost}><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-sand">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-sand bg-sand/40 text-xs tracking-wide text-ink-soft uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Product</th>
              <th scope="col" className="px-4 py-3 font-semibold">Category</th>
              <th scope="col" className="px-4 py-3 font-semibold">Price</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              {SIZES.map((s) => <th key={s} scope="col" className="px-3 py-3 text-center font-semibold">{s}</th>)}
              <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {rows.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-cream">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.images?.[0]} alt="" className="h-12 w-10 rounded-lg bg-sand object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="font-mono text-xs text-ink-soft">{p.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{p.gender ? `${p.category} · ${p.gender}` : p.category}</td>
                <td className="px-4 py-3 font-medium whitespace-nowrap">{formatLKR(p.price)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                {SIZES.map((s) => {
                  if (p.category !== 'Clothing') return <td key={s} className="px-3 py-3 text-center text-ink-soft">—</td>
                  const n = p.stock?.[s] ?? 0
                  return (
                    <td key={s} className="px-3 py-3 text-center">
                      <span className={`inline-flex min-w-9 justify-center rounded-full px-2 py-1 text-xs font-semibold ${n === 0 ? 'bg-rose/10 text-rose' : n <= LOW ? 'bg-blush-light text-ink' : 'bg-sage-light/70 text-sage-dark'}`}>{n}</span>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-right font-semibold">{p.category === 'Clothing' ? totalStock(p) : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-sand-dark hover:bg-sand" aria-label={`Edit ${p.title}`}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6 + SIZES.length} className="px-4 py-12 text-center text-ink-soft">No products match.</td></tr>}
          </tbody>
        </table>
      </div>

      <details className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-sand">
        <summary className="cursor-pointer font-semibold">How bulk update works</summary>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
          <li><strong className="text-ink">Export to Excel</strong>, then open the file.</li>
          <li>Edit <code>price</code>, <code>status</code> (active / coming_soon / hidden) or the <code>stock_…</code> columns. Leave <code>id</code> as it is.</li>
          <li>Save, then click <strong className="text-ink">Bulk Import Update</strong> and pick the file (.xlsx or .csv).</li>
          <li>Check the list of changes. Nothing is saved until you press <em>Apply</em>.</li>
        </ol>
      </details>

      {editing && (
        <EditProductDialog
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, changed) => {
            setEditing(null)
            onProductSaved(saved)
            toast(changed?.length ? `Saved: ${changed.join(', ')}` : 'No changes.')
          }}
        />
      )}
      {importing && (
        <ImportDialog
          {...importing}
          onClose={() => setImporting(null)}
          onApplied={(res) => {
            setImporting(null)
            onReload()
            toast(`Updated ${res.modified} product${res.modified === 1 ? '' : 's'}.`)
          }}
        />
      )}
    </>
  )
}
