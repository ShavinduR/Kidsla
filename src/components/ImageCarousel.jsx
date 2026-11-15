import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SmartImage from './SmartImage'

// Native scroll-snap carousel: real finger-swipe on phones, arrows + dots + keyboard on desktop.
export default function ImageCarousel({ images, alt, tint, className = '' }) {
  const track = useRef(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const go = (i) => {
    const el = track.current
    const next = (i + images.length) % images.length
    el?.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div
      className={`group/carousel relative ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} photos`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1)
        if (e.key === 'ArrowLeft') go(index - 1)
      }}
    >
      <div ref={track} className="snap-carousel no-scrollbar flex h-full w-full overflow-x-auto" tabIndex={0}>
        {images.map((src, i) => (
          <div key={src + i} className="h-full w-full shrink-0" aria-label={`Photo ${i + 1} of ${images.length}`}>
            <SmartImage src={src} alt={`${alt} — photo ${i + 1}`} tint={tint} sizes="(min-width: 640px) 50vw, 100vw" ratio="4:5" priority={i === 0} className="h-full w-full" />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          {[
            { dir: -1, Icon: ChevronLeft, pos: 'left-3', label: 'Previous photo' },
            { dir: 1, Icon: ChevronRight, pos: 'right-3', label: 'Next photo' },
          ].map(({ dir, Icon, pos, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => go(index + dir)}
              aria-label={label}
              className={`absolute top-1/2 ${pos} hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition-all hover:bg-white sm:flex sm:opacity-0 sm:group-hover/carousel:opacity-100 focus-visible:opacity-100`}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full shadow-sm transition-all duration-300 ${i === index ? 'w-6 bg-ink' : 'w-2 bg-white/90 hover:bg-white'}`}
              />
            ))}
          </div>
          <span className="absolute top-4 left-4 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  )
}
