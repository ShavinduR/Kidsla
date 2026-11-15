// Meta Pixel + event helpers.
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

/** Standard Meta events: ViewContent, AddToCart, InitiateCheckout, Lead */
export function track(event, params = {}) {
  if (import.meta.env.DEV) console.debug('[analytics]', event, params)
  if (PIXEL_ID && window.fbq) window.fbq('track', event, { currency: 'LKR', ...params })
}
