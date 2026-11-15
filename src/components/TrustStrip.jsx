import { Leaf, MessageCircle, Truck } from 'lucide-react'

const ITEMS = [
  { icon: Leaf, title: 'Pure Cotton', text: 'Breathable & gentle on delicate skin' },
  { icon: MessageCircle, title: 'Order on WhatsApp', text: 'Friendly, personal service' },
  { icon: Truck, title: 'Island-wide Delivery', text: 'Charges confirmed before dispatch' },
]

export default function TrustStrip() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="flex items-center gap-4 rounded-[1.5rem] bg-white/70 p-5 ring-1 ring-sand transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-ink/5"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage-light text-sage-dark">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-ink-soft">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
