import { Clock, MessageCircle, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import { ABOUT_TEXT, DELIVERY_FEES, RETURN_POLICY, WHATSAPP_DISPLAY } from '../data/site'
import { formatLKR } from '../utils/format'
import { waLink } from '../utils/whatsapp'

const YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer id="about" className="border-t border-sand bg-sand/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr] lg:gap-14 lg:px-8">
        {/* About */}
        <section aria-labelledby="f-about">
          <p className="text-2xl font-bold tracking-[0.25em]">KIDSLA</p>
          <h2 id="f-about" className="mt-6 text-sm font-semibold tracking-wider text-sage-dark uppercase">About Us</h2>
          <p className="mt-3 max-w-md leading-relaxed text-ink-soft">{ABOUT_TEXT}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm text-ink">
            <ShieldCheck className="h-4 w-4 text-sage-dark" /> 100% cotton · Tag-free · Skin-friendly
          </p>
        </section>

        {/* Policy */}
        <section aria-labelledby="f-policy" id="returns">
          <h2 id="f-policy" className="flex items-center gap-2 text-sm font-semibold tracking-wider text-sage-dark uppercase">
            <RotateCcw className="h-4 w-4" /> Return &amp; Exchange
          </h2>
          <ul className="mt-3 space-y-2.5 text-ink-soft">
            {RETURN_POLICY.map((line) => (
              <li key={line} className="flex gap-2.5 leading-relaxed">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" /> {line}
              </li>
            ))}
          </ul>
          <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold tracking-wider text-sage-dark uppercase">
            <Truck className="h-4 w-4" /> Delivery
          </h2>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Colombo {formatLKR(DELIVERY_FEES.colombo)} · Outstation {formatLKR(DELIVERY_FEES.outstation)}
          </p>
        </section>

        {/* Contact */}
        <section aria-labelledby="f-contact">
          <h2 id="f-contact" className="text-sm font-semibold tracking-wider text-sage-dark uppercase">Contact Us</h2>
          <a
            href={waLink('Hi KIDSLA! I have a question.')}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-sand-dark transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wa text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs text-ink-soft">WhatsApp</span>
              <span className="block text-lg font-semibold tracking-wide group-hover:text-wa-dark">{WHATSAPP_DISPLAY}</span>
            </span>
          </a>
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
            <Clock className="h-4 w-4" /> We usually reply within a few hours.
          </p>
        </section>
      </div>
      <div className="border-t border-sand-dark/60 py-6 text-center text-sm text-ink-soft">
        © {YEAR} KIDSLA · Soft essentials for little adventures.
      </div>
    </footer>
  )
}
