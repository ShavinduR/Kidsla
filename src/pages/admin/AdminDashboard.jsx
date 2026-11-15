import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Database, LogOut, Package, ShoppingBag } from 'lucide-react'
import InventoryTab from './InventoryTab'
import OrdersTab from './OrdersTab'
import { Notice, Spinner, btn } from './ui'
import { fetchAdminProducts, seedCatalogue } from '../../services/adminApi'

export default function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState('inventory')
  const [state, setState] = useState({ status: 'loading' }) // loading | ready | error
  const [toastMsg, setToastMsg] = useState(null)
  const [pending, setPending] = useState(null)

  const toast = useCallback((text, tone = 'ok') => setToastMsg({ text, tone, at: Date.now() }), [])
  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 4500)
    return () => clearTimeout(t)
  }, [toastMsg])

  const load = useCallback(async () => {
    const res = await fetchAdminProducts()
    if (!res.ok) return setState({ status: 'error', error: res.error ?? 'Couldn’t load products.' })
    setState({ status: 'ready', configured: res.configured, products: res.products })
  }, [])

  useEffect(() => {
    load() // eslint-disable-line react-hooks/set-state-in-effect -- initial fetch
  }, [load])

  const onCounts = useCallback((c) => setPending(c.pending ?? 0), [])

  const seed = async () => {
    const res = await seedCatalogue()
    if (!res.ok) return toast(res.error ?? 'Couldn’t load the catalogue.', 'error')
    toast(`Added ${res.inserted} products to your database.`)
    load()
  }

  let body
  if (state.status === 'loading') body = <Spinner label="Loading inventory" />
  else if (state.status === 'error') body = <Notice tone="error" icon={Database}>{state.error} <button onClick={load} className="ml-1 font-semibold underline">Try again</button></Notice>
  else if (!state.configured)
    body = (
      <Notice tone="warn" icon={Database}>
        <strong className="font-semibold">Database not connected.</strong> Add <code>MONGODB_URI</code> in Vercel → Settings → Environment Variables, then redeploy.
        Until then the shop keeps using the catalogue built into the code.
      </Notice>
    )
  else if (state.products.length === 0)
    body = (
      <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-14 text-center ring-1 ring-sand">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-light"><Database className="h-6 w-6 text-sage-dark" /></span>
        <h1 className="mt-4 text-xl font-semibold">Your database is connected and empty</h1>
        <p className="mt-2 max-w-md text-ink-soft">Load the starter catalogue (the 14 products currently on the site) to begin. You can then edit prices and stock here or in Excel.</p>
        <button onClick={seed} className={`${btn.primary} mt-6`}>Load starter catalogue</button>
      </div>
    )
  else if (tab === 'inventory')
    body = (
      <InventoryTab
        products={state.products}
        onReload={load}
        onProductSaved={(p) => setState((s) => ({ ...s, products: s.products.map((x) => (x.id === p.id ? p : x)) }))}
        toast={toast}
      />
    )
  else body = <OrdersTab toast={toast} onStockChanged={load} onCounts={onCounts} />

  const ready = state.status === 'ready' && state.configured && state.products.length > 0

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-30 border-b border-sand bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Back to store"><ArrowLeft className="h-5 w-5" /></Link>
          <p className="text-lg font-bold tracking-[0.2em]">KIDSLA</p>
          <span className="hidden rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-cream sm:inline">Admin</span>
          <button onClick={onLogout} className="ml-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-sand-dark hover:bg-sand">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
        {ready && (
          <nav className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6 lg:px-8" aria-label="Admin sections">
            {[
              { id: 'inventory', label: 'Inventory', Icon: Package },
              { id: 'orders', label: 'Orders', Icon: ShoppingBag, badge: pending },
            ].map(({ id, label, Icon, badge }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`relative inline-flex h-12 items-center gap-2 px-4 text-sm font-semibold transition-colors ${tab === id ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
              >
                <Icon className="h-4 w-4" /> {label}
                {badge > 0 && <span className="rounded-full bg-rose px-2 py-0.5 text-xs text-white">{badge}</span>}
                {tab === id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ink" />}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{body}</main>

      {toastMsg && (
        <div role="status" key={toastMsg.at} className={`fixed bottom-6 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 animate-rise rounded-full px-5 py-3 text-sm font-medium shadow-xl ${toastMsg.tone === 'error' ? 'bg-rose text-white' : 'bg-ink text-cream'}`}>
          {toastMsg.text}
        </div>
      )}
    </div>
  )
}
