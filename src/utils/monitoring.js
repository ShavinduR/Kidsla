// Front-end error tracking with Sentry (https://sentry.io). Off until VITE_SENTRY_DSN is set in Vercel.
// The Sentry SDK is only downloaded when a DSN exists, so it costs shoppers nothing otherwise.
// Privacy: no IPs, cookies or form contents are sent (sendDefaultPii: false), no session replay.
const DSN = import.meta.env.VITE_SENTRY_DSN
let sentry = null
const queue = []

export function initMonitoring() {
  if (!DSN || typeof window === 'undefined') return
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: 0, // errors only (keeps you inside the free tier)
        // Ignore noise from browser extensions and in-app browser quirks.
        denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
        beforeSend(event) {
          if (event.request) delete event.request.cookies
          return event
        },
      })
      sentry = Sentry
      queue.splice(0).forEach(([e, ctx]) => Sentry.captureException(e, ctx))
    })
    .catch(() => {})
}

/** Report an error we caught ourselves (e.g. in the ErrorBoundary). */
export function captureError(error, context) {
  if (!DSN) return
  const ctx = context ? { extra: context } : undefined
  if (sentry) sentry.captureException(error, ctx)
  else queue.push([error, ctx])
}
