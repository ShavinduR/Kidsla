import { Link } from 'react-router-dom'
import { Bell, Eye, Plus } from 'lucide-react'
import SmartImage from './SmartImage'
import { isOrderable, totalStock } from '../data/products'
import { formatLKR } from '../utils/format'

const BADGE_STYLES = {
  Bestseller: 'bg-white text-ink',
  New: 'bg-sage-dark text-white',
  'Coming Soon': 'bg-blush text-ink',
  'Sold Out': 'bg-ink text-cream',
}

// Cards are real links to /p/<slug> (shareable, crawlable). The shop opens them as a quick-view popup.
export default function ProductCard({ product }) {
  const orderable = isOrderable(product)
  const soldOut = orderable && totalStock(product) === 0
  const badge = !orderable ? 'Coming Soon' : soldOut ? 'Sold Out' : product.badge
  const tint = product.gender === 'Girls' ? 'bg-blush-light' : product.gender === 'Boys' ? 'bg-sage-light' : 'bg-sand'
  const link = { to: `/p/${product.slug}`, state: { fromShop: true } }

  return (
    <article className="group flex flex-col">
      <div className="relative">
        <Link {...link} className="block w-full overflow-hidden rounded-[1.5rem]" aria-label={`View ${product.title}`}>
          <SmartImage
            src={product.images[0]}
            alt={product.title}
            tint={tint}
            ratio="4:5"
            sizes="(min-width: 1280px) 290px, (min-width: 1024px) 23vw, (min-width: 768px) 31vw, 48vw"
            className={`aspect-[4/5] w-full ${!orderable || soldOut ? 'opacity-85 saturate-[0.85]' : ''}`}
          />
        </Link>

        {badge && (
          <span className={`pointer-events-none absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-sm ${BADGE_STYLES[badge]}`}>
            {badge}
          </span>
        )}

        {/* Desktop hover action */}
        <div className="absolute inset-x-3 bottom-3 hidden translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
          <Link
            {...link}
            tabIndex={-1}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white/95 py-3 text-sm font-semibold text-ink shadow-lg backdrop-blur transition-colors hover:bg-ink hover:text-cream"
          >
            {orderable ? <><Eye className="h-4 w-4" /> Quick View / Add</> : <><Bell className="h-4 w-4" /> Notify Me</>}
          </Link>
        </div>
        {/* Mobile action */}
        <Link
          {...link}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute right-3 bottom-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-md transition-transform active:scale-90 md:hidden"
        >
          {orderable ? <Plus className="h-5 w-5" /> : <Bell className="h-[18px] w-[18px]" />}
        </Link>
      </div>

      <div className="mt-3 flex flex-1 flex-col px-1 sm:mt-4">
        <p className="text-xs font-medium tracking-wide text-sage-dark">{product.material}</p>
        <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug font-medium text-ink sm:text-base">
          <Link {...link} className="text-left transition-colors hover:text-sage-dark">{product.title}</Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <p className="font-semibold text-ink">{formatLKR(product.price)}</p>
          <div className="flex -space-x-1" aria-hidden="true">
            {product.colors.slice(0, 3).map((c) => (
              <span key={c.name} className="h-4 w-4 rounded-full ring-2 ring-cream" style={{ backgroundColor: c.hex }} />
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
