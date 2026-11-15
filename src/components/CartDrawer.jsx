import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Banknote, CircleCheck, ExternalLink, Info, Landmark, MessageCircle, Minus, Plus, RotateCcw, ShoppingBag, Trash2, X,
} from 'lucide-react'
import SmartImage from './SmartImage'
import { useCart } from '../context/CartContext'
import { DISTRICTS, PAYMENT_METHODS, deliveryFeeFor, DELIVERY_FEES } from '../data/site'
import { formatLKR } from '../utils/format'
import { generateOrderId } from '../utils/orderId'
import { buildOrderMessage, prepareWhatsAppWindow, waLink } from '../utils/whatsapp'
import { track } from '../utils/analytics'
import useLockBody from '../utils/useLockBody'

const FORM_KEY = 'kidsla-customer-v2'
const EMPTY = { name: '', address: '', district: '', payment: 'cod' }
const PAY_ICONS = { cod: Banknote, bank: Landmark }

const loadForm = () => {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(FORM_KEY)) }
  } catch {
    return EMPTY
  }
}

export default function CartDrawer() {
  const { lines, isOpen, closeCart, setQty, removeItem, clearCart, subtotal, count } = useCart()
  const [form, setForm] = useState(loadForm)
  const [errors, setErrors] = useState({})
  const [placed, setPlaced] = useState(null) // { orderId, url, total } after checkout
  const [submitting, setSubmitting] = useState(false)
  const [orderError, setOrderError] = useState(null) // { message, problems[] } from the server
  const panel = useRef(null)

  useLockBody(isOpen)

  const handleClose = useCallback(() => {
    closeCart()
    setPlaced(null)
  }, [closeCart])

  // Focus the panel once when it opens (not on every render — that would steal focus from inputs).
  useEffect(() => {
    if (isOpen) panel.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === 'Escape' && handleClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  const deliveryFee = deliveryFeeFor(form.district)
  const total = subtotal + deliveryFee

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((er) => ({ ...er, [field]: undefined }))
  }

  const handleCheckout = async (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Please enter your name'
    if (form.address.trim().length < 10) next.address = 'Please enter your full address (house no, street, city)'
    if (!form.district) next.district = 'Please choose your district'
    setErrors(next)
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0]
      document.getElementById(`co-${first}`)?.focus()
      return
    }

    if (submitting) return
    setSubmitting(true)
    setOrderError(null)
    localStorage.setItem(FORM_KEY, JSON.stringify(form))
    const paymentLabel = PAYMENT_METHODS.find((p) => p.id === form.payment).label
    const wa = prepareWhatsAppWindow() // must happen inside the tap, before any await

    // 1) Save the order: the server re-checks stock, recomputes prices and issues the order number.
    let order = null
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          items: lines.map((l) => ({ id: l.id, size: l.size, color: l.color, qty: l.qty })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) order = data
      else if ([400, 409, 429].includes(res.status)) {
        // Something the customer needs to fix (e.g. an item just sold out) — don't send to WhatsApp.
        wa.cancel()
        setOrderError({ message: data.error ?? 'Please check your order.', problems: data.problems ?? [] })
        setSubmitting(false)
        return
      }
    } catch {
      /* offline / server down → fall back below */
    }

    // 2) Never lose a sale: if the server is unreachable or not set up, still send via WhatsApp.
    order ??= {
      orderId: generateOrderId(),
      items: lines.map((l) => ({ productId: l.id, title: l.product.title, size: l.size, color: l.color, qty: l.qty, price: l.product.price })),
      subtotal,
      deliveryFee,
      total,
    }

    const url = waLink(buildOrderMessage({ ...order, customer: form, paymentLabel }))
    track('InitiateCheckout', { value: order.total, num_items: count, content_ids: lines.map((l) => l.id) })

    // Keep a receipt BEFORE clearing so the customer can re-open WhatsApp if it didn't launch.
    setPlaced({ orderId: order.orderId, url, total: order.total, items: count, holdHours: order.holdHours })
    wa.go(url)
    clearCart()
    setSubmitting(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-sm" onClick={handleClose} />

      <aside ref={panel} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in flex-col bg-cream shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-sand px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold">
            {placed ? 'Order Sent' : <>Your Cart <span className="font-normal text-ink-soft">({count})</span></>}
          </h2>
          <button
            onClick={handleClose}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-all hover:rotate-90 hover:bg-sand"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {placed ? (
          <OrderPlaced placed={placed} onDone={handleClose} />
        ) : lines.length === 0 ? (
          <EmptyCart onShop={handleClose} />
        ) : (
          <form onSubmit={handleCheckout} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="flex-1 overflow-y-auto px-5 sm:px-6">
              <ul className="divide-y divide-sand">
                {lines.map((l) => (
                  <li key={l.key} className="flex gap-4 py-5">
                    <SmartImage src={l.product.images[0]} alt={l.product.title} sizes="80px" ratio="4:5" className="h-24 w-20 shrink-0 rounded-2xl" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm leading-snug font-medium">{l.product.title}</h3>
                        <button
                          type="button"
                          onClick={() => { removeItem(l.key); setOrderError(null) }}
                          className="-mt-1.5 -mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-blush-light hover:text-rose"
                          aria-label={`Remove ${l.product.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-soft">{l.color} · {l.size}</p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-full bg-white ring-1 ring-sand-dark">
                          <button type="button" onClick={() => { setQty(l.key, l.qty - 1); setOrderError(null) }} className="flex h-9 w-9 items-center justify-center rounded-l-full hover:bg-sand" aria-label="Decrease quantity">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                          <button type="button" onClick={() => { setQty(l.key, l.qty + 1); setOrderError(null) }} className="flex h-9 w-9 items-center justify-center rounded-r-full hover:bg-sand" aria-label="Increase quantity">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold">{formatLKR(l.product.price * l.qty)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Delivery details */}
              <fieldset className="border-t border-sand pt-5 pb-6">
                <legend className="sr-only">Delivery details</legend>
                <h3 className="font-semibold">Delivery Details</h3>
                <div className="mt-4 space-y-4">
                  <Field id="co-name" label="Full Name" error={errors.name}>
                    <input id="co-name" type="text" value={form.name} onChange={setField('name')} autoComplete="name" placeholder="e.g. Nimali Perera" className={inputClass(errors.name)} aria-invalid={!!errors.name} />
                  </Field>
                  <Field id="co-address" label="Delivery Address" error={errors.address}>
                    <textarea id="co-address" value={form.address} onChange={setField('address')} autoComplete="street-address" rows={3} placeholder="House no, street, city" className={`${inputClass(errors.address)} resize-none`} aria-invalid={!!errors.address} />
                  </Field>
                  <Field id="co-district" label="District" error={errors.district}>
                    <select id="co-district" value={form.district} onChange={setField('district')} className={`${inputClass(errors.district)} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%233A3631%22 stroke-width=%222%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10`} aria-invalid={!!errors.district}>
                      <option value="" disabled>Select your district</option>
                      <optgroup label={`Colombo — ${formatLKR(DELIVERY_FEES.colombo)} delivery`}>
                        <option value="Colombo">Colombo</option>
                      </optgroup>
                      <optgroup label={`Outstation — ${formatLKR(DELIVERY_FEES.outstation)} delivery`}>
                        {DISTRICTS.filter((d) => d !== 'Colombo').map((d) => <option key={d} value={d}>{d}</option>)}
                      </optgroup>
                    </select>
                  </Field>

                  <div role="radiogroup" aria-label="Payment method">
                    <span className="mb-1.5 block text-sm font-medium text-ink">Payment Method</span>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((m) => {
                        const Icon = PAY_ICONS[m.id]
                        const on = form.payment === m.id
                        return (
                          <label key={m.id} className={`relative flex cursor-pointer flex-col gap-1 rounded-2xl p-3.5 transition-all ${on ? 'bg-white ring-2 ring-sage-dark' : 'bg-white/60 ring-1 ring-sand-dark hover:ring-ink-soft'}`}>
                            <input type="radio" name="payment" value={m.id} checked={on} onChange={setField('payment')} className="sr-only" />
                            <span className="flex items-center gap-2 text-sm font-semibold">
                              <Icon className={`h-4 w-4 ${on ? 'text-sage-dark' : 'text-ink-soft'}`} /> {m.label}
                            </span>
                            <span className="text-xs leading-snug text-ink-soft">{m.hint}</span>
                            {on && <CircleCheck className="absolute top-3 right-3 h-4 w-4 text-sage-dark" />}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Summary */}
            <div className="border-t border-sand bg-white/80 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="font-medium">{formatLKR(subtotal)}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Delivery{form.district ? ` (${form.district === 'Colombo' ? 'Colombo' : 'Outstation'})` : ''}</dt>
                  <dd className="font-medium">{form.district ? formatLKR(deliveryFee) : <span className="text-ink-soft">Select district</span>}</dd>
                </div>
                <div className="flex justify-between border-t border-sand pt-2 text-base">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-lg font-semibold">{formatLKR(total)}</dd>
                </div>
              </dl>
              {orderError && (
                <div role="alert" className="mt-3 rounded-2xl bg-rose/10 p-3 text-sm text-ink ring-1 ring-rose/30">
                  <p className="font-semibold text-rose">{orderError.message}</p>
                  {orderError.problems.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {orderError.problems.map((p) => (
                        <li key={`${p.id}-${p.size}`}>• {p.title} ({p.size}): {p.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <button type="submit" disabled={submitting} className="mt-4 flex h-13 w-full disabled:cursor-wait disabled:opacity-70 items-center justify-center gap-2 rounded-full bg-wa font-semibold text-white shadow-lg shadow-wa/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-wa-dark hover:shadow-xl active:translate-y-0">
                <MessageCircle className="h-5 w-5" /> {submitting ? 'Placing order…' : 'Place Order via WhatsApp'}
              </button>
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                <RotateCcw className="h-3.5 w-3.5" /> 3-day exchanges · We confirm every order on WhatsApp
              </p>
            </div>
          </form>
        )}
      </aside>
    </div>
  )
}

function OrderPlaced({ placed, onDone }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-sage-light">
        <CircleCheck className="h-10 w-10 text-sage-dark" strokeWidth={1.75} />
      </div>
      <p className="mt-5 text-xl font-semibold">Thank you!</p>
      <p className="mt-1 text-ink-soft">Your order ID</p>
      <p className="mt-1 rounded-full bg-white px-4 py-1.5 font-mono text-lg font-semibold tracking-wider ring-1 ring-sand-dark">{placed.orderId}</p>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
        Just press <strong className="text-ink">Send</strong> in WhatsApp. We’ll confirm your order and delivery shortly.
      </p>
      {placed.holdHours && (
        <p className="mt-3 max-w-xs rounded-2xl bg-sage-light/70 px-4 py-2.5 text-sm text-sage-dark">
          We’re holding your items for <strong>{placed.holdHours} hours</strong> so nobody else can buy them.
        </p>
      )}
      <a href={placed.url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-wa px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-wa-dark">
        <ExternalLink className="h-4 w-4" /> WhatsApp didn’t open? Tap here
      </a>
      <button onClick={onDone} className="mt-3 rounded-full px-6 py-3 text-sm font-medium text-ink underline-offset-4 hover:underline">
        Continue shopping
      </button>
    </div>
  )
}

function EmptyCart({ onShop }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sand">
        <ShoppingBag className="h-8 w-8 text-ink-soft" strokeWidth={1.5} />
      </div>
      <p className="mt-5 text-lg font-medium">Your cart is empty</p>
      <p className="mt-1 text-sm text-ink-soft">Soft, breathable favourites are waiting for you.</p>
      <button
        onClick={() => {
          onShop()
          document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })
        }}
        className="mt-6 rounded-full bg-ink px-7 py-3 text-sm font-medium text-cream transition-colors hover:bg-sage-dark"
      >
        Start Shopping
      </button>
      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-soft"><Info className="h-3.5 w-3.5" /> Delivery: Colombo {formatLKR(DELIVERY_FEES.colombo)} · Outstation {formatLKR(DELIVERY_FEES.outstation)}</p>
    </div>
  )
}

const inputClass = (error) =>
  `w-full rounded-2xl bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/70 outline-none ring-1 transition-all focus:ring-2 ${
    error ? 'ring-rose focus:ring-rose' : 'ring-sand-dark focus:ring-sage-dark'
  }`

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-rose">{error}</p>}
    </div>
  )
}
