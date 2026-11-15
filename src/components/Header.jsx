import { useEffect, useState } from 'react'
import { Menu, ShoppingBag, X } from 'lucide-react'
import { useCart } from '../context/CartContext'

const NAV = [
  { label: 'Clothing', filter: 'Clothing' },
  { label: 'Toys', filter: 'Toys' },
  { label: 'Educational', filter: 'Educational' },
]

export default function Header({ onNavigate }) {
  const { count, openCart } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (filter) => {
    setMenuOpen(false)
    onNavigate(filter)
  }

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-cream/85 shadow-[0_1px_0_0_rgba(58,54,49,0.06)] backdrop-blur-md' : 'bg-cream'
      }`}
    >
      <div className="bg-sage-dark py-2 text-center text-[11px] font-medium tracking-[0.18em] text-cream uppercase sm:text-xs">
        Island-wide delivery · Order easily via WhatsApp
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="-ml-2 rounded-full p-2 transition-colors hover:bg-sand md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <a
          href="#top"
          onClick={() => go('All')}
          className="text-2xl font-bold tracking-[0.25em] text-ink transition-opacity hover:opacity-70 sm:text-[28px]"
        >
          KIDSLA
        </a>

        <nav className="hidden items-center gap-10 md:flex">
          {NAV.map((item) => (
            <button
              key={item.label}
              onClick={() => go(item.filter)}
              className="group relative text-sm font-medium tracking-wide text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-ink transition-all duration-300 group-hover:w-full" />
            </button>
          ))}
        </nav>

        <button
          onClick={openCart}
          className="relative -mr-2 rounded-full p-2.5 transition-colors hover:bg-sand"
          aria-label={`Open cart, ${count} items`}
        >
          <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.75} />
          {count > 0 && (
            <span
              key={count /* re-mount → bounce animation on every change */}
              className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-blush-dark px-1 text-[10px] font-semibold text-white ring-2 ring-cream"
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-t border-sand transition-all duration-300 md:hidden ${
          menuOpen ? 'max-h-64 opacity-100' : 'max-h-0 border-transparent opacity-0'
        }`}
      >
        <nav className="flex flex-col px-4 py-3">
          {NAV.map((item) => (
            <button
              key={item.label}
              onClick={() => go(item.filter)}
              className="rounded-xl px-3 py-3 text-left text-base font-medium text-ink transition-colors hover:bg-sand"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
