import { useCallback, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Categories from './components/Categories'
import ProductGrid from './components/ProductGrid'
import ProductModal from './components/ProductModal'
import CartDrawer from './components/CartDrawer'
import TrustStrip from './components/TrustStrip'
import Footer from './components/Footer'

export default function App() {
  const [filter, setFilter] = useState('All')
  const [activeProduct, setActiveProduct] = useState(null)

  const showShop = useCallback((nextFilter) => {
    setFilter(nextFilter)
    requestAnimationFrame(() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }))
  }, [])

  const closeModal = useCallback(() => setActiveProduct(null), [])

  return (
    <div className="flex min-h-screen flex-col">
      <Header onNavigate={(f) => (f === 'All' ? setFilter('All') : showShop(f))} />
      <main className="flex-1">
        <Hero onShop={() => showShop('All')} />
        <Categories onSelect={showShop} />
        <ProductGrid filter={filter} onFilterChange={setFilter} onQuickView={setActiveProduct} />
        <TrustStrip />
      </main>
      <Footer />

      {activeProduct && <ProductModal key={activeProduct.id} product={activeProduct} onClose={closeModal} />}
      <CartDrawer />
    </div>
  )
}
