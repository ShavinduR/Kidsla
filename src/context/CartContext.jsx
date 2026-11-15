import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useProducts } from './ProductsContext'
import { isOrderable, stockFor } from '../data/products'
import { track } from '../utils/analytics'

const CartContext = createContext(null)
const STORAGE_KEY = 'kidsla-cart-v2' // v2: size ranges + stock. Old v1 carts are discarded.

const load = () => {
  try {
    localStorage.removeItem('kidsla-cart-v1')
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const { products } = useProducts()
  const [raw, setRaw] = useState(load)
  const [isOpen, setIsOpen] = useState(false)
  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  // The cart only stores ids — price, title and availability always come from the live
  // catalogue, so a stale saved cart can never order an unavailable item or an old price.
  const lines = useMemo(
    () =>
      raw
        .map((item) => {
          const product = products.find((p) => p.id === item.id)
          if (!product || !isOrderable(product) || !product.sizes.includes(item.size)) return null
          const qty = Math.min(item.qty, stockFor(product, item.size))
          return qty > 0 ? { ...item, qty, product } : null
        })
        .filter(Boolean),
    [raw, products],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.map(({ product: _p, ...rest }) => rest)))
  }, [lines])

  const qtyInCart = useCallback(
    (id, size) => lines.filter((l) => l.id === id && l.size === size).reduce((s, l) => s + l.qty, 0),
    [lines],
  )

  /** Returns the number actually added (may be less than requested if stock is short). */
  const addItem = useCallback(
    (product, { size, color, qty = 1 }) => {
      if (!isOrderable(product)) return 0
      const room = stockFor(product, size) - qtyInCart(product.id, size)
      const add = Math.max(0, Math.min(qty, room))
      if (!add) return 0
      const key = `${product.id}__${size}__${color}`
      setRaw((prev) => {
        const kept = prev.filter((i) => lines.some((l) => l.key === i.key)) // drop stale entries
        const hit = kept.find((i) => i.key === key)
        return hit
          ? kept.map((i) => (i.key === key ? { ...i, qty: i.qty + add } : i))
          : [...kept, { key, id: product.id, size, color, qty: add }]
      })
      track('AddToCart', { content_ids: [product.id], content_type: 'product', value: product.price * add })
      return add
    },
    [lines, qtyInCart],
  )

  const setQty = useCallback(
    (key, qty) => {
      const line = lines.find((l) => l.key === key)
      if (!line) return
      const others = qtyInCart(line.id, line.size) - line.qty
      const max = stockFor(line.product, line.size) - others
      setRaw((prev) =>
        qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, qty: Math.min(qty, max) } : i)),
      )
    },
    [lines, qtyInCart],
  )

  const value = useMemo(() => {
    const count = lines.reduce((s, l) => s + l.qty, 0)
    const subtotal = lines.reduce((s, l) => s + l.qty * l.product.price, 0)
    return {
      lines,
      count,
      subtotal,
      isOpen,
      openCart,
      closeCart,
      addItem,
      setQty,
      removeItem: (key) => setRaw((prev) => prev.filter((i) => i.key !== key)),
      clearCart: () => setRaw([]),
      qtyInCart,
    }
  }, [lines, isOpen, openCart, closeCart, addItem, setQty, qtyInCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
