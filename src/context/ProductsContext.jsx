import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { initialProducts } from '../data/products'

const ProductsContext = createContext(null)

// Shows the bundled catalogue instantly, then swaps in the live one from MongoDB (/api/products).
// If the API or database is unavailable, the bundled catalogue simply stays — the shop never goes blank.
export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(initialProducts)
  const [source, setSource] = useState('bundled') // bundled | live

  useEffect(() => {
    let cancelled = false
    fetch('/api/products')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.configured && Array.isArray(data.products) && data.products.length) {
          setProducts(data.products)
          setSource('live')
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({ products, source, getProduct: (id) => products.find((p) => p.id === id) }),
    [products, source],
  )
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProducts() {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used inside <ProductsProvider>')
  return ctx
}
