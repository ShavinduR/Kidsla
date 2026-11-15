import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CircleCheck, Clock, CreditCard, MessageCircle, TriangleAlert } from 'lucide-react'
import { formatLKR } from '../utils/format'
import { waLink } from '../utils/whatsapp'
import { submitToPayHere } from '../utils/payhere'
import { track } from '../utils/analytics'

const when = (d) => new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' })

// Where PayHere sends the customer back (return_url / cancel_url). The page asks OUR server for the
// result: only PayHere's server-to-server notification can mark an order paid, never this URL.
export default function OrderStatus() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const cancelled = params.get('cancelled') === '1'
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders/status?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`)
    if (!r.ok) return setError('We couldn’t find this order. If you paid, please message us on WhatsApp with your order ID.')
    setOrder({ ...(await r.json()), checkedAt: Date.now() })
  }, [id, token])

  // PayHere's confirmation usually arrives within seconds. Check every 2 s for up to a minute.
  useEffect(() => {
    load() // eslint-disable-line react-hooks/set-state-in-effect -- fetch status
  }, [load, tries])
  const paid = order?.payment?.status === 'paid'
  const waiting = order && !paid && !cancelled && ['awaiting', 'processing'].includes(order.payment?.status) && order.status === 'pending'
  useEffect(() => {
    if (!waiting || tries >= 30) return
    const t = setTimeout(() => setTries((n) => n + 1), 2000)
    return () => clearTimeout(t)
  }, [waiting, tries])

  useEffect(() => {
    if (paid) track('Purchase', { value: order.total, content_ids: [order.id] })
  }, [paid]) // eslint-disable-line react-hooks/exhaustive-deps

  const payAgain = async () => {
    setBusy(true)
    const r = await fetch('/api/orders/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, t: token }) })
    const data = await r.json().catch(() => ({}))
    if (r.ok && data.payhere) return submitToPayHere(data.payhere)
    setBusy(false)
    setError(data.error ?? 'Couldn’t start the payment. Please try again.')
  }

  const canRetry = order && !paid && order.payment?.method === 'online' && order.status === 'pending' && order.expiresAt && new Date(order.expiresAt).getTime() > order.checkedAt
  let icon, title, text
  if (error && !order) [icon, title, text] = [TriangleAlert, 'Order not found', error]
  else if (!order) [icon, title, text] = [Clock, 'Checking your payment…', '']
  else if (paid) [icon, title, text] = [CircleCheck, 'Payment received. Thank you!', 'Your order is confirmed. We’ll message you on WhatsApp about delivery.']
  else if (waiting && tries < 30) [icon, title, text] = [Clock, 'Confirming your payment…', 'This usually takes a few seconds. Please keep this page open.']
  else if (order.status === 'expired') [icon, title, text] = [TriangleAlert, 'Payment time ran out', 'We released the items. You’re welcome to place the order again.']
  else if (cancelled || ['cancelled', 'failed'].includes(order.payment?.status))
    [icon, title, text] = [TriangleAlert, order.payment?.status === 'failed' ? 'Payment didn’t go through' : 'Payment cancelled', canRetry ? `Your items are held until ${when(order.expiresAt)}. You can try again.` : 'No money was taken.']
  else [icon, title, text] = [Clock, 'Payment not confirmed yet', 'If you completed the payment, it can take a minute. Refresh, or message us on WhatsApp with your order ID.']
  const Icon = icon

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-xl shadow-ink/5 ring-1 ring-sand sm:p-9">
        <Link to="/" className="text-lg font-bold tracking-[0.25em]">KIDSLA</Link>
        <div className={`mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full ${paid ? 'bg-sage-light' : 'bg-sand'}`}>
          <Icon className={`h-8 w-8 ${paid ? 'text-sage-dark' : 'text-ink-soft'} ${!order && !error ? 'animate-pulse' : ''}`} />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        {text && <p className="mt-2 text-ink-soft">{text}</p>}
        {order && (
          <div className="mt-6 rounded-2xl bg-cream p-4 text-left text-sm">
            <p className="flex justify-between font-mono font-semibold"><span>{order.id}</span><span>{formatLKR(order.total)}</span></p>
            <ul className="mt-2 space-y-0.5 text-ink-soft">
              {order.items.map((i, n) => <li key={n}>{i.title} · {i.color} · {i.size} × {i.qty}</li>)}
            </ul>
          </div>
        )}
        {error && order && <p role="alert" className="mt-4 text-sm font-medium text-rose">{error}</p>}
        <div className="mt-6 flex flex-col gap-2">
          {canRetry && !waiting && (
            <button onClick={payAgain} disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink font-semibold text-cream hover:bg-sage-dark disabled:opacity-60">
              <CreditCard className="h-5 w-5" /> {busy ? 'Opening payment…' : 'Try paying again'}
            </button>
          )}
          <a
            href={waLink(`Hi KIDSLA! About my order ${id}${paid ? ' (paid online)' : ''}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-wa font-semibold text-white hover:bg-wa-dark"
          >
            <MessageCircle className="h-5 w-5" /> Message us on WhatsApp
          </a>
          <Link to="/" className="mt-1 text-sm font-medium text-ink underline-offset-4 hover:underline">Back to the shop</Link>
        </div>
      </div>
    </main>
  )
}
