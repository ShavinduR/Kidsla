import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Database, LogOut, Download, FileSpreadsheet, Lock, Package, PackageX, RefreshCw, Search, Server, TriangleAlert, Upload, X,
} from 'lucide-react'
import { useProducts } from '../context/ProductsContext'
import { CLOTHING_SIZES } from '../data/sizeGuide'
import { totalStock } from '../data/products'
import { commitImport, exportInventory, previewImport } from '../services/inventoryApi'
import { formatLKR } from '../utils/format'

const LOW = 3
const STATUS_STYLE = {
  active: 'bg-sage-light text-sage-dark',
  coming_soon: 'bg-blush-light text-rose',
  hidden: 'bg-sand text-ink-soft',
}
const STATUS_LABEL = { active: 'Active', coming_soon: 'Coming soon', hidden: 'Hidden' }

export default function AdminDashboard({ onLogout }) {
  const { products, applyUpdates, reset } = useProducts()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [preview, setPreview] = useState(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const stats = useMemo(() => {
    const clothing = products.filter((p) => p.category === 'Clothing')
    const sizeSlots = clothing.flatMap((p) => CLOTHING_SIZES.map((s) => p.stock?.[s] ?? 0))
    return {
      total: products.length,
      active: products.filter((p) => p.status === 'active').length,
      units: clothing.reduce((s, p) => s + totalStock(p), 0),
      low: sizeSlots.filter((n) => n > 0 && n <= LOW).length,
      out: sizeSlots.filter((n) => n === 0).length,
    }
  }, [products])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter(
      (p) => (cat === 'All' || p.category === cat) && (!q || `${p.id} ${p.title} ${p.material}`.toLowerCase().includes(q)),
    )
  }, [products, query, cat])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setBusy(true)
    try {
      setPreview({ fileName: file.name, ...(await previewImport(file, products)) })
    } finally {
      setBusy(false)
    }
  }

  const confirmImport = async () => {
    const res = await commitImport(preview.updates, applyUpdates)
    setPreview(null)
    setToast(`Updated ${res.modified} product${res.modified === 1 ? '' : 's'}.`)
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-30 border-b border-sand bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Back to store">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <p className="text-lg font-bold tracking-[0.2em]">KIDSLA</p>
          <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream">Admin</span>
          <button
            onClick={onLogout}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink ring-1 ring-sand-dark transition-colors hover:bg-sand"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div role="note" className="flex items-start gap-3 rounded-2xl bg-sand/70 p-4 text-sm text-ink ring-1 ring-sand-dark">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sage-dark" />
          <p>
            <strong className="font-semibold">Signed in securely.</strong> Inventory is still demo data: imports change this browser only and reset on
            refresh, until the database backend is connected.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inventory</h1>
            <p className="mt-1 text-ink-soft">Manage prices, status and stock per size.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => exportInventory(products).then(() => setToast('Inventory exported — open it in Excel.'))}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 font-semibold text-ink ring-1 ring-sand-dark transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Download className="h-5 w-5" /> Export Inventory to Excel/CSV
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-cream transition-all hover:-translate-y-0.5 hover:bg-sage-dark hover:shadow-md disabled:opacity-60"
            >
              <Upload className="h-5 w-5" /> {busy ? 'Reading file…' : 'Bulk Import Update'}
            </button>
            <input ref={fileInput} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
          </div>
        </div>

        {/* Stats */}
        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: 'Products', value: stats.total, Icon: Package },
            { label: 'Active', value: stats.active, Icon: FileSpreadsheet },
            { label: 'Units in stock', value: stats.units, Icon: Database },
            { label: `Low stock sizes (≤${LOW})`, value: stats.low, Icon: TriangleAlert, warn: stats.low > 0 },
            { label: 'Sold-out sizes', value: stats.out, Icon: PackageX, warn: stats.out > 0 },
          ].map(({ label, value, Icon, warn }) => (
            <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-sand">
              <dt className="flex items-center gap-2 text-sm text-ink-soft">
                <Icon className={`h-4 w-4 ${warn ? 'text-rose' : 'text-sage-dark'}`} /> {label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Filters */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search products</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU or material"
              className="h-12 w-full rounded-full bg-white pr-4 pl-11 ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark"
            />
          </label>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {['All', 'Clothing', 'Toys', 'Educational'].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                aria-pressed={cat === c}
                className={`h-12 shrink-0 rounded-full px-5 text-sm font-medium transition-colors ${cat === c ? 'bg-ink text-cream' : 'bg-sand/70 text-ink hover:bg-sand-dark'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <button onClick={() => { reset(); setToast('Demo data restored.') }} className="inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-soft hover:bg-sand" title="Reset demo data">
            <RefreshCw className="h-4 w-4" /> Reset
          </button>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-sand">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-sand bg-sand/40 text-xs tracking-wide text-ink-soft uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                <th scope="col" className="px-4 py-3 font-semibold">Price</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                {CLOTHING_SIZES.map((s) => <th key={s} scope="col" className="px-3 py-3 text-center font-semibold">{s}</th>)}
                <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {rows.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-cream">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.images[0]} alt="" className="h-12 w-10 rounded-lg bg-sand object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="font-mono text-xs text-ink-soft">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{p.gender ? `${p.category} · ${p.gender}` : p.category}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{formatLKR(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  {CLOTHING_SIZES.map((s) => {
                    if (p.category !== 'Clothing') return <td key={s} className="px-3 py-3 text-center text-ink-soft">—</td>
                    const n = p.stock?.[s] ?? 0
                    return (
                      <td key={s} className="px-3 py-3 text-center">
                        <span className={`inline-flex min-w-9 justify-center rounded-full px-2 py-1 text-xs font-semibold ${n === 0 ? 'bg-rose/10 text-rose' : n <= LOW ? 'bg-blush-light text-ink' : 'bg-sage-light/70 text-sage-dark'}`}>
                          {n}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right font-semibold">{p.category === 'Clothing' ? totalStock(p) : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5 + CLOTHING_SIZES.length} className="px-4 py-12 text-center text-ink-soft">No products match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* How it works */}
        <details className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-sand open:pb-6">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <Server className="h-4 w-4 text-sage-dark" /> How bulk update works (and how it connects to the backend)
          </summary>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
            <li><strong className="text-ink">Export</strong> the inventory, then open it in Excel.</li>
            <li>Edit <code>price</code>, <code>status</code> (active / coming_soon / hidden) or the <code>stock_…</code> columns. Don’t change <code>id</code>.</li>
            <li>Save as <strong className="text-ink">CSV UTF-8</strong> (demo) and click <strong className="text-ink">Bulk Import Update</strong>.</li>
            <li>Review the change list. Nothing is saved until you press <em>Apply</em>.</li>
            <li>With the Node backend: the file goes to <code>POST /api/admin/inventory/import</code>. The <code>xlsx</code> package parses it and MongoDB <code>bulkWrite</code> updates every row in one go. See <code>docs/BACKEND.md</code>.</li>
          </ol>
        </details>
      </main>

      {preview && <ImportPreview preview={preview} onCancel={() => setPreview(null)} onConfirm={confirmImport} />}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise rounded-full bg-ink px-5 py-3 text-sm font-medium text-cream shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}

function ImportPreview({ preview, onCancel, onConfirm }) {
  const { fileName, changes, errors, updates } = preview
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="ip-title">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative flex max-h-[85dvh] w-full max-w-2xl animate-rise flex-col rounded-t-[2rem] bg-cream shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-sand p-5 sm:p-6">
          <div>
            <h2 id="ip-title" className="text-lg font-semibold">Review import</h2>
            <p className="mt-0.5 text-sm text-ink-soft">{fileName}</p>
          </div>
          <button onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {errors.length > 0 && (
            <div className="rounded-2xl bg-rose/10 p-4 ring-1 ring-rose/30">
              <p className="flex items-center gap-2 font-semibold text-rose"><TriangleAlert className="h-4 w-4" /> {errors.length} problem{errors.length > 1 ? 's' : ''} (these rows will be skipped)</p>
              <ul className="mt-2 space-y-1 text-sm text-ink">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>
            </div>
          )}
          <div>
            <p className="font-semibold">{changes.length} product{changes.length === 1 ? '' : 's'} will change</p>
            {changes.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No differences from the current inventory.</p>
            ) : (
              <ul className="mt-3 divide-y divide-sand rounded-2xl bg-white ring-1 ring-sand">
                {changes.map((c) => (
                  <li key={c.id} className="p-4">
                    <p className="font-medium">{c.title} <span className="font-mono text-xs text-ink-soft">{c.id}</span></p>
                    <ul className="mt-1 text-sm text-ink-soft">{c.diff.map((d) => <li key={d}>{d}</li>)}</ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex gap-3 border-t border-sand p-5 sm:p-6">
          <button onClick={onCancel} className="h-12 flex-1 rounded-full font-semibold ring-1 ring-sand-dark hover:bg-sand">Cancel</button>
          <button onClick={onConfirm} disabled={!updates.length} className="h-12 flex-1 rounded-full bg-ink font-semibold text-cream hover:bg-sage-dark disabled:cursor-not-allowed disabled:opacity-40">
            Apply {updates.length || ''} update{updates.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
