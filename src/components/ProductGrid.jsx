import { useMemo } from 'react'
import ProductCard from './ProductCard'
import { useProducts } from '../context/ProductsContext'

const FILTERS = ['All', 'Girls', 'Boys', 'Toys', 'Educational']

export default function ProductGrid({ filter, onFilterChange }) {
  const { products: all } = useProducts()
  const products = useMemo(() => all.filter((p) => p.status !== 'hidden'), [all])
  const visible = useMemo(() => {
    switch (filter) {
      case 'All':
        return products
      case 'Clothing':
        return products.filter((p) => p.category === 'Clothing')
      case 'Girls':
      case 'Boys':
        return products.filter((p) => p.gender === filter)
      default:
        return products.filter((p) => p.category === filter)
    }
  }, [filter, products])

  const isActive = (f) => f === filter || (filter === 'Clothing' && (f === 'Girls' || f === 'Boys'))

  return (
    <section id="shop" className="scroll-mt-28 bg-white/60 py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div className="text-center md:text-left">
            <p className="text-xs font-medium tracking-[0.2em] text-sage-dark uppercase">The Collection</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {filter === 'All' ? 'Little Essentials' : filter}
            </h2>
          </div>

          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                aria-pressed={isActive(f)}
                className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  isActive(f)
                    ? 'bg-ink text-cream shadow-md'
                    : 'bg-sand/70 text-ink-soft hover:bg-sand-dark hover:text-ink'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div key={filter} className="grid animate-fade-in grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {visible.length === 0 && <p className="py-16 text-center text-ink-soft">New pieces arriving soon.</p>}
      </div>
    </section>
  )
}
