// Analytics: Vercel Web Analytics + Meta Pixel.
import { track as vercelTrack } from '@vercel/analytics'

// Set VITE_META_PIXEL_ID in Vercel → Settings → Environment Variables to switch it on.
// With no ID, every call is a harmless no-op (so dev/preview don't pollute your data).
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID

export function initMetaPixel() {
  if (!PIXEL_ID || typeof window === 'undefined' || window.fbq) return
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
  window.fbq('init', PIXEL_ID)
  window.fbq('track', 'PageView')
}

/** Don't count the owner's /admin visits as shop traffic. */
export const excludeAdmin = (event) => (new URL(event.url).pathname.startsWith('/admin') ? null : event)

// Vercel custom events accept only flat string/number/boolean/null values.
const flat = (params) =>
  Object.fromEntries(
    Object.entries(params)
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v])
      .filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v)),
  )

/**
 * One call → both tools. Event names follow Meta's standard events:
 * ViewContent, AddToCart, InitiateCheckout, Lead.
 * Vercel custom events need a Pro/Enterprise plan; on Hobby they're simply ignored
 * (page views & visitors are still tracked).
 */
export function track(event, params = {}) {
  if (import.meta.env.DEV) console.debug('[analytics]', event, params)
  try {
    vercelTrack(event, flat(params))
  } catch {
    /* analytics must never break the shop */
  }
  if (PIXEL_ID && window.fbq) window.fbq('track', event, { currency: 'LKR', ...params })
}
