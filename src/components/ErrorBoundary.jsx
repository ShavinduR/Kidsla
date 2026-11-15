import { Component } from 'react'
import { waLink } from '../utils/whatsapp'
import { captureError } from '../utils/monitoring'

// After a new deploy, a visitor with the site already open may request a code chunk that no
// longer exists. That's not a real bug: one automatic reload fixes it.
const isChunkError = (e) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    String(e?.message ?? e),
  )

/**
 * Catches any rendering crash below it and shows a friendly page instead of a blank white screen.
 * React only supports this with a class component.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (isChunkError(error) && !sessionStorage.getItem('kidsla-reloaded')) {
      sessionStorage.setItem('kidsla-reloaded', '1')
      window.location.reload()
      return
    }
    console.error('[KIDSLA] crashed:', error, info?.componentStack)
    captureError(error, { componentStack: info?.componentStack })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-6 text-center">
        <div className="max-w-sm">
          <p className="text-2xl font-bold tracking-[0.25em] text-ink">KIDSLA</p>
          <h1 className="mt-6 text-xl font-semibold text-ink">Oops, something went wrong.</h1>
          <p className="mt-2 text-ink-soft">
            Sorry about that! Please reload the page. Your cart is saved on this device.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="h-12 rounded-full bg-ink font-semibold text-cream transition-colors hover:bg-sage-dark"
            >
              Reload page
            </button>
            <a
              href={waLink('Hi KIDSLA! The website showed an error while I was shopping.')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center rounded-full font-semibold text-ink ring-1 ring-sand-dark hover:bg-sand"
            >
              Order on WhatsApp instead
            </a>
          </div>
        </div>
      </div>
    )
  }
}
