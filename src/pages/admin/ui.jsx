import { X } from 'lucide-react'

export function Dialog({ title, subtitle, onClose, children, footer, labelId = 'dlg-title' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={labelId}>
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-[min(42rem,100vw)] min-w-0 animate-rise flex-col rounded-t-[2rem] bg-cream shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-sand p-5 sm:p-6">
          <div>
            <h2 id={labelId} className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-sand" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <div className="flex flex-wrap gap-2 border-t border-sand p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-6">{footer}</div>}
      </div>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const btn = {
  primary:
    'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-cream transition-all hover:bg-sage-dark disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 font-semibold text-ink ring-1 ring-sand-dark transition-all hover:bg-sand disabled:opacity-50',
  ghost: 'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-soft hover:bg-sand',
}

export function Notice({ tone = 'info', icon: Icon, children }) {
  const tones = {
    info: 'bg-sand/70 ring-sand-dark',
    warn: 'bg-blush-light ring-blush',
    error: 'bg-rose/10 ring-rose/30',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'note'} className={`flex items-start gap-3 rounded-2xl p-4 text-sm text-ink ring-1 ${tones[tone]}`}>
      {Icon && <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'info' ? 'text-sage-dark' : 'text-rose'}`} />}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

export const Spinner = ({ label = 'Loading' }) => (
  <div className="flex justify-center py-16">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-sand-dark border-t-ink" role="status" aria-label={label} />
  </div>
)
