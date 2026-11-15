import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { ProductsProvider } from './context/ProductsContext'
import { CartProvider } from './context/CartContext'
import Storefront from './pages/Storefront'
import { initMetaPixel } from './utils/analytics'

// Admin is code-split: shoppers never download it.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

export default function App() {
  useEffect(() => initMetaPixel(), [])

  return (
    <ProductsProvider>
      <CartProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="grid min-h-screen place-items-center text-ink-soft">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Storefront />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<Storefront />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        {/* Vercel Analytics — enable in Vercel → Project → Analytics. No-op until then. */}
        <Analytics />
      </CartProvider>
    </ProductsProvider>
  )
}
