import { useEffect, useRef, useState } from 'react'
import { Bell, Check, ChevronDown, Link2, Minus, Plus, RotateCcw, Ruler, Share2, ShoppingBag, X } from 'lucide-react'
import ImageCarousel from './ImageCarousel'
import SizeGuide from './SizeGuide'
import { useCart } from '../context/CartContext'
import { isOrderable, stockFor } from '../data/products'
import { formatLKR } from '../utils/format'
import { buildNotifyMessage, openWhatsApp, waLink } from '../utils/whatsapp'
import { track } from '../utils/analytics'
import useLockBody from '../utils/useLockBody'

const LOW_STOCK = 3

// Native share sheet on phones (WhatsApp, Instagram, …); copy the link elsewhere.
function ShareButton({ product }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = `${window.location.origin}/p/${product.slug}`
    track('Share', { content_ids: [product.id] })
    if (navigator.share) {
      try {
        await navigator.share({ title: `${product.title} · KIDSLA`, text: `${product.title} from KIDSLA`, url })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft ring-1 ring-sand-dark transition-colors hover:bg-sand hover:text-ink"
    >
      {copied ? <><Link2 className="h-4 w-4" /> Link copied</> : <><Share2 className="h-4 w-4" /> Share</>}
    </button>
  )
}

export default function ProductModal({ product, onClose }) {
  const { addItem, openCart, qtyInCart } = useCart()
  const orderable = isOrderable(product)
  const singleSize = product.sizes.length === 1
  const [size, setSize] = useState(singleSize ? product.sizes[0] : null)
  const [color, setColor] = useState(product.colors[0].name)
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const closeBtn = useRef(null)

  useLockBody(true)

  useEffect(() => {
    closeBtn.current?.focus()
    track('ViewContent', { content_ids: [product.id], content_type: 'product', value: product.price })
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [product, onClose])

  const available = size ? stockFor(product, size) - qtyInCart(product.id, size) : 0
  const tint = product.gender === 'Girls' ? 'bg-blush-light' : product.gender === 'Boys' ? 'bg-sage-light' : 'bg-sand'

  const pickSize = (s) => {
    setSize(s)
    setError('')
    setQty((q) => Math.max(1, Math.min(q, stockFor(product, s) - qtyInCart(product.id, s))))
  }

  const handleAdd = () => {
    if (!size) return setError('Please select a size')
    if (available <= 0) return setError('You already have all available stock of this size in your cart')
    addItem(product, { size, color, qty })
    setAdded(true)
    setTimeout(() => {
      onClose()
      openCart()
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="pm-title">
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[94dvh] w-full animate-rise flex-col overflow-hidden rounded-t-[2rem] bg-cream shadow-2xl sm:max-h-[90vh] sm:max-w-5xl sm:flex-row sm:rounded-[2rem]">
        <button
          ref={closeBtn}
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-ink shadow-md backdrop-blur transition-transform hover:rotate-90"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-y-auto sm:flex sm:overflow-hidden">
          <ImageCarousel
            images={product.images}
            alt={product.title}
            tint={tint}
            className="aspect-[4/5] max-h-[52dvh] w-full shrink-0 sm:aspect-auto sm:max-h-none sm:w-1/2"
          />

          <div className="flex flex-col p-5 sm:w-1/2 sm:overflow-y-auto sm:p-8">
            <p className="text-xs font-semibold tracking-[0.16em] text-sage-dark uppercase">
              {product.gender ? `${product.gender} · ` : ''}{product.category}
            </p>
            <h2 id="pm-title" className="mt-2 pr-10 text-2xl font-semibold tracking-tight sm:text-3xl">{product.title}</h2>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xl font-semibold">{formatLKR(product.price)}</p>
              <ShareButton product={product} />
            </div>
            <p className="mt-4 leading-relaxed text-ink-soft">{product.description}</p>

            <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-sage-light px-3 py-1.5 text-sm font-medium text-sage-dark">
              <Check className="h-4 w-4" /> {product.material}
            </span>

            {!orderable ? (
              <ComingSoonPanel product={product} />
            ) : (
              <>
                {/* Colour */}
                <fieldset className="mt-6">
                  <legend className="mb-3 text-sm font-medium">
                    Colour: <span className="font-normal text-ink-soft">{color}</span>
                  </legend>
                  <div className="flex flex-wrap gap-3">
                    {product.colors.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setColor(c.name)}
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={color === c.name}
                        className={`h-11 w-11 rounded-full ring-offset-2 ring-offset-cream transition-all duration-200 hover:scale-110 ${
                          color === c.name ? 'ring-2 ring-ink' : 'ring-1 ring-sand-dark'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </fieldset>

                {/* Size */}
                <fieldset className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <legend className="text-sm font-medium">Size (age)</legend>
                    <button
                      type="button"
                      onClick={() => setShowGuide((v) => !v)}
                      aria-expanded={showGuide}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-sage-dark underline-offset-4 hover:underline"
                    >
                      <Ruler className="h-4 w-4" /> Size guide
                      <ChevronDown className={`h-4 w-4 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {product.sizes.map((s) => {
                      const left = stockFor(product, s)
                      const soldOut = left <= 0
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={soldOut}
                          onClick={() => pickSize(s)}
                          aria-pressed={size === s}
                          className={`relative rounded-2xl px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                            soldOut
                              ? 'cursor-not-allowed bg-sand/60 text-ink-soft line-through decoration-1'
                              : size === s
                                ? 'bg-ink text-cream shadow-md'
                                : 'bg-white text-ink ring-1 ring-sand-dark hover:ring-ink'
                          }`}
                        >
                          {s}
                          <span className={`block text-xs font-normal no-underline ${size === s ? 'text-cream/80' : 'text-ink-soft'}`}>
                            {soldOut ? 'Sold out' : left <= LOW_STOCK ? `Only ${left} left` : 'In stock'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {error && <p role="alert" className="mt-2 text-sm font-medium text-rose">{error}</p>}
                </fieldset>

                {showGuide && (
                  <div className="mt-4 animate-fade-in">
                    <SizeGuide highlight={size} />
                  </div>
                )}

                {/* Qty + Add */}
                <div className="sticky bottom-0 -mx-5 mt-6 flex items-center gap-3 border-t border-sand bg-cream/95 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:mt-auto sm:border-0 sm:bg-transparent sm:px-0 sm:pt-8 sm:pb-0">
                  <div className="flex items-center rounded-full bg-white ring-1 ring-sand-dark">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="flex h-12 w-11 items-center justify-center rounded-l-full transition-colors hover:bg-sand"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-semibold" aria-live="polite">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(size ? Math.max(1, available) : 10, q + 1))}
                      className="flex h-12 w-11 items-center justify-center rounded-r-full transition-colors hover:bg-sand"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={added}
                    className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 sm:text-base ${
                      added ? 'bg-sage-dark text-white' : 'bg-ink text-cream hover:-translate-y-0.5 hover:bg-sage-dark hover:shadow-lg'
                    }`}
                  >
                    {added ? (
                      <><Check className="h-5 w-5" /> Added</>
                    ) : (
                      <><ShoppingBag className="h-5 w-5" /> Add · {formatLKR(product.price * qty)}</>
                    )}
                  </button>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
                  <RotateCcw className="h-3.5 w-3.5" /> Easy exchanges within 3 days
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ComingSoonPanel({ product }) {
  return (
    <div className="mt-6 rounded-2xl bg-blush-light/70 p-5 ring-1 ring-blush">
      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wider text-ink uppercase">
        Coming Soon
      </span>
      <p className="mt-3 text-sm leading-relaxed text-ink">
        This piece isn’t available to order yet. Tap below and we’ll message you on WhatsApp the moment it lands.
      </p>
      <a
        href={waLink(buildNotifyMessage(product))}
        onClick={(e) => {
          e.preventDefault()
          track('Lead', { content_ids: [product.id], content_name: 'notify_me' })
          openWhatsApp(waLink(buildNotifyMessage(product)))
        }}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-cream transition-all hover:-translate-y-0.5 hover:bg-sage-dark hover:shadow-lg"
      >
        <Bell className="h-4 w-4" /> Notify Me on WhatsApp
      </a>
    </div>
  )
}
