import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import Header from '../components/Header'
import Hero from '../components/Hero'
import Categories from '../components/Categories'
import ProductGrid from '../components/ProductGrid'
import ProductModal from '../components/ProductModal'
import CartDrawer from '../components/CartDrawer'
import TrustStrip from '../components/TrustStrip'
import Footer from '../components/Footer'
import { useProducts } from '../context/ProductsContext'

const DEFAULT_TITLE = document.title

// "/" and "/p/:slug" both render this page. A product link opens the quick-view popup on top of the
// shop, so shared links land on the product, and the phone's Back button simply closes it.
export default function Storefront() {
  const [filter, setFilter] = useState('All')
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { getBySlug, ready } = useProducts()
  const activeProduct = slug ? getBySlug(slug) : null
  const missing = Boolean(slug && ready && !activeProduct)

  const showShop = useCallback((nextFilter) => {
    setFilter(nextFilter)
    requestAnimationFrame(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }))
  }, [])

  // Opened from the grid → Back returns to where they were. Arrived via a shared link → go home.
  const closeModal = useCallback(() => {
    if (location.state?.fromShop) navigate(-1)
    else navigate('/', { replace: true })
  }, [location.state, navigate])

  useEffect(() => {
    document.title = activeProduct ? `${activeProduct.title} · KIDSLA` : DEFAULT_TITLE
  }, [activeProduct])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#shop" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-cream">
        Skip to products
      </a>
      <Header onNavigate={(f) => (f === 'All' ? setFilter('All') : showShop(f))} />
      {missing && (
        <div role="status" className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-3xl items-center justify-between gap-3 rounded-2xl bg-blush-light px-4 py-3 text-sm text-ink ring-1 ring-blush">
          <span>Sorry, that product is no longer available. Have a look at what’s in the shop below.</span>
          <button onClick={() => navigate('/', { replace: true })} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <main className="flex-1">
        <Hero onShop={() => showShop('All')} />
        <Categories onSelect={showShop} />
        <ProductGrid filter={filter} onFilterChange={setFilter} />
        <TrustStrip />
      </main>
      <Footer />
      {activeProduct && <ProductModal key={activeProduct.id} product={activeProduct} onClose={closeModal} />}
      <CartDrawer />
    </div>
  )
}
