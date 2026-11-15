import { ArrowRight, Leaf, Sparkles, Wind } from 'lucide-react'
import SmartImage from './SmartImage'

const PERKS = [
  { icon: Leaf, label: '100% Cotton' },
  { icon: Wind, label: 'Breathable' },
  { icon: Sparkles, label: 'Ages 1–6' },
]

export default function Hero({ onShop }) {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* soft background shapes */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blush-light blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-sage-light/70 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-2 md:gap-12 md:pt-16 md:pb-24 lg:px-8">
        <div className="animate-rise text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-medium tracking-wider text-sage-dark uppercase ring-1 ring-sage-light">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            New Season Essentials
          </span>

          <h1 className="mt-6 text-4xl leading-[1.1] font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Soft on skin.
            <br />
            <span className="font-light text-sage-dark italic">Made for play.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink-soft md:mx-0 sm:text-lg">
            Thoughtfully made essentials for little ones aged 1–6 — crafted from pure, breathable cotton for
            all-day comfort.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
            <button
              onClick={onShop}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-8 py-4 text-sm font-medium tracking-wide text-cream shadow-lg shadow-ink/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-sage-dark hover:shadow-xl sm:w-auto"
            >
              Shop the Collection
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:justify-start">
            {PERKS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-ink-soft">
                <Icon className="h-4 w-4 text-sage" strokeWidth={1.75} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          <div className="grid grid-cols-5 gap-3 sm:gap-4">
            <SmartImage
              sizes="(min-width: 768px) 30vw, 60vw"
              priority
              src="https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&q=80"
              alt="Child in soft cotton outfit"
              className="col-span-3 aspect-[3/4] rounded-[2rem] shadow-xl shadow-ink/5"
              tint="bg-blush-light"
            />
            <div className="col-span-2 flex flex-col gap-3 pt-10 sm:gap-4 sm:pt-16">
              <SmartImage
                sizes="(min-width: 768px) 20vw, 40vw"
                priority
                src="https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=600&q=80"
                alt="Cotton baby essentials"
                className="aspect-square rounded-[1.5rem]"
                tint="bg-sage-light"
              />
              <div className="flex flex-1 flex-col justify-center rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-sand sm:p-5">
                <p className="text-2xl font-semibold text-ink sm:text-3xl">100%</p>
                <p className="mt-1 text-xs leading-snug text-ink-soft sm:text-sm">Pure cotton. Gentle on sensitive skin.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
