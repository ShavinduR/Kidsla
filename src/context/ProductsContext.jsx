import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { initialProducts } from '../data/products'

const ProductsContext = createContext(null)

// Demo store. Admin edits live in memory only (refresh = reset).
// Production: fetch from GET /api/products and refetch after a bulk import.
export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(initialProducts)

  const applyUpdates = useCallback((updates) => {
    const byId = new Map(updates.map((u) => [u.id, u]))
    setProducts((prev) =>
      prev.map((p) => {
        const u = byId.get(p.id)
        return u ? { ...p, ...u, stock: { ...p.stock, ...u.stock } } : p
      }),
    )
  }, [])

  const reset = useCallback(() => setProducts(initialProducts), [])

  const value = useMemo(
    () => ({ products, getProduct: (id) => products.find((p) => p.id === id), applyUpdates, reset }),
    [products, applyUpdates, reset],
  )
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProducts() {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used inside <ProductsProvider>')
  return ctx
}
