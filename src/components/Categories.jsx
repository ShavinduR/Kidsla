import { ArrowUpRight } from 'lucide-react'
import SmartImage from './SmartImage'

const img = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`

const TILES = [
  {
    key: 'Girls',
    title: 'Girls',
    subtitle: 'Clothing',
    image: img('photo-1518831959646-742c3a14ebf7'),
    tint: 'bg-blush-light',
    className: 'md:col-span-2 md:row-span-2 aspect-[4/5] md:aspect-auto',
  },
  {
    key: 'Boys',
    title: 'Boys',
    subtitle: 'Clothing',
    image: img('photo-1519238263530-99bdd11df2ea'),
    tint: 'bg-sage-light',
    className: 'md:col-span-2 md:row-span-2 aspect-[4/5] md:aspect-auto',
  },
  {
    key: 'Toys',
    title: 'Toys',
    subtitle: 'Coming soon',
    image: img('photo-1596461404969-9ae70f2830c1', 700),
    tint: 'bg-sand',
    className: 'md:col-span-2 aspect-[16/10] md:aspect-auto',
  },
  {
    key: 'Educational',
    title: 'Educational',
    subtitle: 'Coming soon',
    image: img('photo-1515488042361-ee00e0ddd4e4', 700),
    tint: 'bg-sand',
    className: 'md:col-span-2 aspect-[16/10] md:aspect-auto',
  },
]

export default function Categories({ onSelect }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <div className="mb-8 flex flex-col items-center text-center md:mb-12">
        <p className="text-xs font-medium tracking-[0.2em] text-sage-dark uppercase">Explore</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Shop by Category</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:h-[620px] md:grid-cols-6 md:grid-rows-2">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            onClick={() => onSelect(tile.key)}
            className={`group relative overflow-hidden rounded-[1.75rem] text-left ${tile.className}`}
          >
            <SmartImage src={tile.image} alt={tile.title} tint={tile.tint} className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/5 to-transparent transition-opacity duration-500 group-hover:from-ink/65" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 sm:p-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-white uppercase">
                  {tile.subtitle}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{tile.title}</h3>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-ink transition-all duration-300 group-hover:rotate-45 group-hover:bg-white sm:h-11 sm:w-11">
                <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
