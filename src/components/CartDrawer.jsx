import { useEffect, useState } from 'react'
import { Info, MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import SmartImage from './SmartImage'
import { useCart } from '../context/CartContext'
import { formatLKR } from '../utils/format'
import { buildOrderMessage, buildWhatsAppUrl } from '../utils/whatsapp'
import useLockBody from '../utils/useLockBody'

const FORM_KEY = 'kidsla-customer-v1'

export default function CartDrawer() {
  const { items, isOpen, closeCart, updateQty, removeItem, subtotal, count } = useCart()
  const [form, setForm] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FORM_KEY)) ?? { name: '', address: '' }
    } catch {
      return { name: '', address: '' }
    }
  })
  const [errors, setErrors] = useState({})

  useLockBody(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === 'Escape' && closeCart()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeCart])

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((er) => ({ ...er, [field]: undefined }))
  }

  const handleCheckout = (e) => {
    e.preventDefault()
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Please enter your name'
    if (form.address.trim().length < 8) next.address = 'Please enter your full delivery address'
    setErrors(next)
    if (Object.keys(next).length) return

    localStorage.setItem(FORM_KEY, JSON.stringify(form))
    const message = buildOrderMessage({ name: form.name, address: form.address, items, total: subtotal })
    const url = buildWhatsAppUrl(message)
    // Open WhatsApp (app on mobile, web on desktop). Fall back to same-tab redirect if popups are blocked.
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) window.location.href = url
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm" onClick={closeCart} />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in flex-col bg-cream shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold">
            Your Cart <span className="font-normal text-ink-soft">({count})</span>
          </h2>
          <button
            onClick={closeCart}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:rotate-90 hover:bg-sand"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sand">
              <ShoppingBag className="h-8 w-8 text-ink-soft" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-lg font-medium">Your cart is empty</p>
            <p className="mt-1 text-sm text-ink-soft">Soft, breathable favourites are waiting for you.</p>
            <button
              onClick={() => {
                closeCart()
                document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="mt-6 rounded-full bg-ink px-7 py-3 text-sm font-medium text-cream transition-colors hover:bg-sage-dark"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="flex-1 overflow-y-auto px-5 sm:px-6">
              {/* Items */}
              <ul className="divide-y divide-sand">
                {items.map((item) => (
                  <li key={item.key} className="flex gap-4 py-5">
                    <SmartImage src={item.imageUrl} alt={item.title} className="h-24 w-20 shrink-0 rounded-2xl" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-sm font-medium">{item.title}</h3>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          className="-mt-1 -mr-1 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-blush-light hover:text-blush-dark"
                          aria-label={`Remove ${item.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {item.color} · Size {item.size}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-full bg-white ring-1 ring-sand-dark">
                          <button
                            type="button"
                            onClick={() => updateQty(item.key, item.qty - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-l-full transition-colors hover:bg-sand"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.key, Math.min(20, item.qty + 1))}
                            className="flex h-8 w-8 items-center justify-center rounded-r-full transition-colors hover:bg-sand"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold">{formatLKR(item.price * item.qty)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Customer details */}
              <div className="border-t border-sand pt-5 pb-6">
                <h3 className="text-sm font-semibold">Delivery Details</h3>
                <div className="mt-4 space-y-4">
                  <Field label="Full Name" error={errors.name}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={setField('name')}
                      autoComplete="name"
                      placeholder="e.g. Nimali Perera"
                      className={inputClass(errors.name)}
                    />
                  </Field>
                  <Field label="Delivery Address" error={errors.address}>
                    <textarea
                      value={form.address}
                      onChange={setField('address')}
                      autoComplete="street-address"
                      rows={3}
                      placeholder="House no, street, city"
                      className={`${inputClass(errors.address)} resize-none`}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Summary + Checkout */}
            <div className="border-t border-sand bg-white/70 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-soft">Subtotal</span>
                <span className="text-lg font-semibold">{formatLKR(subtotal)}</span>
              </div>
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-sage-light/70 px-3 py-2.5 text-xs leading-relaxed text-sage-dark">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Delivery charges will be calculated and confirmed via WhatsApp.
              </p>
              <button
                type="submit"
                className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-semibold tracking-wide text-white shadow-lg shadow-[#25D366]/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1EBE5A] hover:shadow-xl active:translate-y-0"
              >
                <MessageCircle className="h-5 w-5" />
                Checkout via WhatsApp
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  )
}

const inputClass = (error) =>
  `w-full rounded-2xl bg-white px-4 py-3 text-base text-ink placeholder:text-ink-soft/60 outline-none ring-1 transition-all focus:ring-2 sm:text-sm ${
    error ? 'ring-blush-dark focus:ring-blush-dark' : 'ring-sand-dark focus:ring-sage'
  }`

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-medium text-blush-dark">{error}</span>}
    </label>
  )
}
