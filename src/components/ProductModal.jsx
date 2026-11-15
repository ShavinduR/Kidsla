import { useEffect, useState } from 'react'
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import SmartImage from './SmartImage'
import { useCart } from '../context/CartContext'
import { formatLKR } from '../utils/format'
import useLockBody from '../utils/useLockBody'

export default function ProductModal({ product, onClose }) {
  const { addItem, openCart } = useCart()
  const singleSize = product.sizes.length === 1
  const [size, setSize] = useState(singleSize ? product.sizes[0] : null)
  const [color, setColor] = useState(product.colors[0].name)
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)

  useLockBody(true)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleAdd = () => {
    if (!size) {
      setError('Please select a size')
      return
    }
    addItem(product, { size, color, qty })
    setAdded(true)
    setTimeout(() => {
      onClose()
      openCart()
    }, 650)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[92vh] w-full animate-rise flex-col overflow-hidden rounded-t-[2rem] bg-cream shadow-2xl sm:max-w-4xl sm:flex-row sm:rounded-[2rem]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition-transform hover:rotate-90"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-sand-dark sm:hidden" />

        <SmartImage
          src={product.imageUrl}
          alt={product.title}
          tint="bg-sand"
          className="aspect-[4/3] w-full shrink-0 sm:aspect-auto sm:w-1/2"
        />

        <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-8">
          <p className="text-[11px] font-medium tracking-[0.18em] text-sage-dark uppercase">
            {product.gender ? `${product.gender} · ` : ''}
            {product.category}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{product.title}</h2>
          <p className="mt-2 text-xl font-semibold">{formatLKR(product.price)}</p>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{product.description}</p>

          <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-sage-light px-3 py-1 text-xs font-medium text-sage-dark">
            <Check className="h-3.5 w-3.5" /> {product.material}
          </span>

          {/* Colour */}
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium">
              Colour: <span className="font-normal text-ink-soft">{color}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {product.colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  title={c.name}
                  aria-label={c.name}
                  className={`h-10 w-10 rounded-full ring-offset-2 ring-offset-cream transition-all duration-200 hover:scale-110 ${
                    color === c.name ? 'ring-2 ring-ink' : 'ring-1 ring-sand-dark'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium">Size{singleSize ? '' : ' (age)'}</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSize(s)
                    setError('')
                  }}
                  className={`min-w-14 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    size === s
                      ? 'bg-ink text-cream'
                      : 'bg-white text-ink ring-1 ring-sand-dark hover:ring-ink'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {error && <p className="mt-2 text-xs font-medium text-blush-dark">{error}</p>}
          </div>

          {/* Qty + Add */}
          <div className="mt-auto flex items-center gap-3 pt-8">
            <div className="flex items-center rounded-full bg-white ring-1 ring-sand-dark">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-12 w-11 items-center justify-center rounded-l-full transition-colors hover:bg-sand"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center text-sm font-semibold">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                className="flex h-12 w-11 items-center justify-center rounded-r-full transition-colors hover:bg-sand"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={added}
              className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium tracking-wide transition-all duration-300 ${
                added ? 'bg-sage text-white' : 'bg-ink text-cream hover:-translate-y-0.5 hover:bg-sage-dark hover:shadow-lg'
              }`}
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Added
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" /> Add to Cart · {formatLKR(product.price * qty)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
