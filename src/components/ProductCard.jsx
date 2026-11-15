import { Eye, Plus } from 'lucide-react'
import SmartImage from './SmartImage'
import { formatLKR } from '../utils/format'

const BADGE_STYLES = {
  Bestseller: 'bg-white text-ink',
  New: 'bg-sage text-white',
  'Coming Soon': 'bg-blush text-ink',
}

export default function ProductCard({ product, onQuickView }) {
  const tint = product.gender === 'Girls' ? 'bg-blush-light' : product.gender === 'Boys' ? 'bg-sage-light' : 'bg-sand'

  return (
    <article className="group flex flex-col">
      <div className="relative">
        <button
          onClick={() => onQuickView(product)}
          className="block w-full overflow-hidden rounded-[1.5rem]"
          aria-label={`Quick view ${product.title}`}
        >
          <SmartImage src={product.imageUrl} alt={product.title} tint={tint} className="aspect-[4/5] w-full" />
        </button>

        {product.badge && (
          <span
            className={`pointer-events-none absolute top-3 left-3 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wider uppercase shadow-sm ${
              BADGE_STYLES[product.badge] ?? 'bg-white text-ink'
            }`}
          >
            {product.badge}
          </span>
        )}

        {/* Desktop: slide-up quick action. Mobile: always-visible round button */}
        <div className="absolute inset-x-3 bottom-3 hidden translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
          <button
            onClick={() => onQuickView(product)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white/95 py-3 text-sm font-medium text-ink shadow-lg backdrop-blur transition-colors hover:bg-ink hover:text-cream"
          >
            <Eye className="h-4 w-4" /> Quick View / Add
          </button>
        </div>
        <button
          onClick={() => onQuickView(product)}
          className="absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-md transition-transform active:scale-90 md:hidden"
          aria-label={`Add ${product.title}`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex flex-1 flex-col px-1 sm:mt-4">
        <p className="text-[10px] font-medium tracking-[0.15em] text-sage-dark uppercase sm:text-[11px]">
          {product.material}
        </p>
        <h3 className="mt-1 line-clamp-1 text-sm font-medium text-ink sm:text-base">
          <button onClick={() => onQuickView(product)} className="text-left transition-colors hover:text-sage-dark">
            {product.title}
          </button>
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink sm:text-base">{formatLKR(product.price)}</p>
          <div className="flex -space-x-1">
            {product.colors.slice(0, 3).map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="h-3.5 w-3.5 rounded-full ring-2 ring-cream"
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
