import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { ProductsProvider } from './context/ProductsContext'
import { CartProvider } from './context/CartContext'
import Storefront from './pages/Storefront'
import { excludeAdmin, initMetaPixel } from './utils/analytics'

// Admin is code-split: shoppers never download it. The gate checks the server session first.
const AdminGate = lazy(() => import('./pages/AdminGate'))

export default function App() {
  useEffect(() => initMetaPixel(), [])

  return (
    <ProductsProvider>
      <CartProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="grid min-h-screen place-items-center text-ink-soft">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Storefront />} />
              <Route path="/admin" element={<AdminGate />} />
              <Route path="*" element={<Storefront />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        {/*
          Vercel Web Analytics — counts visitors & page views on every route automatically
          (React Router navigations included). Data appears once Analytics is enabled in
          Vercel → Project → Analytics. Loads /_vercel/insights/script.js, which only exists
          on Vercel deployments (404 locally is expected).
        */}
        <Analytics beforeSend={excludeAdmin} />
      </CartProvider>
    </ProductsProvider>
  )
}
