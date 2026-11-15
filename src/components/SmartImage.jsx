import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { imageSrc, srcSet } from '../utils/images'

// Image with a soft pastel skeleton while loading, a graceful fallback on error, and responsive
// sizes (`sizes` tells the browser how wide it's displayed, so phones get small files).
export default function SmartImage({ src, alt, className = '', tint = 'bg-sand', sizes = '100vw', ratio = null, priority = false }) {
  const [status, setStatus] = useState('loading')

  return (
    <div className={`relative overflow-hidden ${tint} ${className}`}>
      {status !== 'loaded' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {status === 'error' ? (
            <div className="flex flex-col items-center gap-2 text-ink-soft/60">
              <ImageOff className="h-7 w-7" strokeWidth={1.5} />
              <span className="text-xs tracking-widest uppercase">KIDSLA</span>
            </div>
          ) : (
            <div className="h-full w-full animate-pulse bg-sand-dark/40" />
          )}
        </div>
      )}
      {status !== 'error' && (
        <img
          src={imageSrc(src, { w: 720, ratio })}
          srcSet={srcSet(src, { ratio })}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}
