import { useCallback, useEffect, useState } from 'react'
import { Banknote, Check, Clock, Inbox, Landmark, MapPin, RefreshCw, X } from 'lucide-react'
import { Notice, Spinner, btn } from './ui'
import { fetchOrders, setOrderStatus } from '../../services/adminApi'
import { formatLKR } from '../../utils/format'

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'expired', label: 'Expired' },
  { id: 'cancelled', label: 'Cancelled' },
]
const STATUS_STYLE = {
  pending: 'bg-blush-light text-ink',
  confirmed: 'bg-sage-light text-sage-dark',
  expired: 'bg-sand-dark/60 text-ink',
  cancelled: 'bg-sand text-ink-soft',
}
const POLL_MS = 30_000
const when = (d) =>
  new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function OrdersTab({ toast, onStockChanged, onCounts }) {
  const [filter, setFilter] = useState('pending')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const res = await fetchOrders(filter)
    if (!res.ok) return setError(res.error ?? 'Couldn’t load orders.')
    setData(res)
    onCounts?.(res.counts ?? {})
  }, [filter, onCounts])

  useEffect(() => {
    load() // eslint-disable-line react-hooks/set-state-in-effect -- fetch on filter change
    // Auto-refresh while this tab is visible, so new orders appear without pressing Refresh.
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const act = async (order, status) => {
    const note = order.status === 'confirmed' || order.stockHeld ? ' Its items go back into stock.' : ''
    if (status === 'cancelled' && !window.confirm(`Cancel order ${order.id}?${note}`)) return
    setWorking(order.id)
    const res = await setOrderStatus(order.id, status)
    setWorking(null)
    if (!res.ok) return toast(res.error ?? 'Couldn’t update the order.', 'error')
    toast(status === 'confirmed' ? `${order.id} confirmed: stock updated.` : `${order.id} cancelled${res.restocked ? ': items restocked' : ''}.`)
    if (status === 'confirmed' || res.restocked) onStockChanged()
    load()
  }

  const counts = data?.counts ?? {}
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">
            Every checkout is saved here as <strong className="text-ink">Pending</strong>. When the customer’s WhatsApp message arrives,
            match the order ID and press <strong className="text-ink">Confirm</strong>. Items are held for 24 hours from checkout; unconfirmed orders
            then <strong className="text-ink">expire</strong> and their items go back on sale. Updates every 30 seconds.
          </p>
        </div>
        <button onClick={load} className={btn.ghost}><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const n = f.id ? counts[f.id] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0)
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={`h-11 shrink-0 rounded-full px-5 text-sm font-medium transition-colors ${filter === f.id ? 'bg-ink text-cream' : 'bg-sand/70 text-ink hover:bg-sand-dark'}`}>
              {f.label} <span className="ml-1 opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : !data ? (
          <Spinner label="Loading orders" />
        ) : data.orders.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-white py-16 text-center ring-1 ring-sand">
            <Inbox className="h-8 w-8 text-ink-soft" strokeWidth={1.5} />
            <p className="mt-3 font-medium">No {filter || ''} orders</p>
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.orders.map((o) => {
              const PayIcon = o.customer.payment === 'bank' ? Landmark : Banknote
              return (
                <li key={o.id} className="flex flex-col rounded-2xl bg-white p-5 ring-1 ring-sand">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-base font-semibold tracking-wide">{o.id}</p>
                      <p className="text-sm text-ink-soft">{when(o.createdAt)}</p>
                      {o.status === 'pending' && o.expiresAt && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-rose"><Clock className="h-3.5 w-3.5" /> Held until {when(o.expiresAt)}</p>
                      )}
                      {o.status === 'expired' && <p className="mt-1 text-xs text-ink-soft">Hold ended: items back on sale. You can still confirm if stock allows.</p>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                  </div>
                  <div className="mt-4 space-y-1 text-sm">
                    <p className="font-medium">{o.customer.name}</p>
                    <p className="flex gap-1.5 text-ink-soft"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {o.customer.address} · <strong className="font-medium text-ink">{o.customer.district}</strong></p>
                    <p className="flex items-center gap-1.5 text-ink-soft"><PayIcon className="h-4 w-4" /> {o.customer.payment === 'bank' ? 'Bank transfer' : 'Cash on delivery'}</p>
                  </div>
                  <ul className="mt-4 divide-y divide-sand rounded-xl bg-cream text-sm">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-3 px-3 py-2">
                        <span>{it.title} <span className="text-ink-soft">· {it.color} · {it.size} × {it.qty}</span></span>
                        <span className="font-medium whitespace-nowrap">{formatLKR(it.price * it.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-3 space-y-0.5 text-sm">
                    <div className="flex justify-between text-ink-soft"><dt>Delivery</dt><dd>{formatLKR(o.deliveryFee)}</dd></div>
                    <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatLKR(o.total)}</dd></div>
                  </dl>
                  {o.status !== 'cancelled' && (
                    <div className="mt-4 flex gap-2 pt-1">
                      {['pending', 'expired'].includes(o.status) && (
                        <button onClick={() => act(o, 'confirmed')} disabled={working === o.id} className={`${btn.primary} h-11 flex-1 text-sm`}>
                          <Check className="h-4 w-4" /> Confirm
                        </button>
                      )}
                      <button onClick={() => act(o, 'cancelled')} disabled={working === o.id} className={`${btn.secondary} h-11 flex-1 text-sm`}>
                        <X className="h-4 w-4" /> Cancel
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
