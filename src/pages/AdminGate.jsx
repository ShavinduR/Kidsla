import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, TriangleAlert } from 'lucide-react'
import { getSession, login, logout } from '../services/adminAuth'
import { SESSION_EXPIRED } from '../services/adminApi'

// The dashboard code is only downloaded AFTER the server confirms the session.
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

const Centered = ({ children }) => <div className="grid min-h-screen place-items-center bg-cream px-4">{children}</div>
const Spinner = () => (
  <Centered>
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-sand-dark border-t-ink" role="status" aria-label="Loading" />
  </Centered>
)

export default function AdminGate() {
  const [state, setState] = useState({ status: 'checking' }) // checking | out | in | error

  useEffect(() => {
    const prev = document.title
    document.title = 'Admin · KIDSLA'
    const meta = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex, nofollow' })
    document.head.appendChild(meta)

    getSession()
      .then((s) =>
        setState(s.ok ? { status: s.authenticated ? 'in' : 'out', configured: s.configured } : { status: 'error' }),
      )
      .catch(() => setState({ status: 'error' }))

    // Any admin request that gets 401 (session expired / password changed) → back to login.
    const expired = () => setState({ status: 'out', configured: true, expired: true })
    window.addEventListener(SESSION_EXPIRED, expired)

    return () => {
      document.title = prev
      meta.remove()
      window.removeEventListener(SESSION_EXPIRED, expired)
    }
  }, [])

  const handleLogout = async () => {
    await logout().catch(() => {})
    setState({ status: 'out', configured: true })
  }

  if (state.status === 'checking') return <Spinner />
  if (state.status === 'in')
    return (
      <Suspense fallback={<Spinner />}>
        <AdminDashboard onLogout={handleLogout} />
      </Suspense>
    )
  return <LoginForm configured={state.configured} expired={state.expired} unreachable={state.status === 'error'} onSuccess={() => setState({ status: 'in' })} />
}

function LoginForm({ configured, expired, unreachable, onSuccess }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!password) return setError('Please enter the password')
    setBusy(true)
    setError('')
    try {
      const res = await login(password)
      if (res.ok) return onSuccess()
      setError(res.error ?? 'Sign-in failed. Please try again.')
      setPassword('')
    } catch {
      setError('Can’t reach the server. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Centered>
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to store
        </Link>
        <form onSubmit={submit} className="rounded-[2rem] bg-white p-7 shadow-xl shadow-ink/5 ring-1 ring-sand sm:p-8" noValidate>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-light">
            <Lock className="h-5 w-5 text-sage-dark" />
          </div>
          <p className="mt-5 text-lg font-bold tracking-[0.2em]">KIDSLA</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Admin sign in</h1>

          {expired && !unreachable && (
            <p role="status" className="mt-4 rounded-2xl bg-sand p-3 text-sm text-ink">Your session ended. Please sign in again.</p>
          )}
          {(unreachable || configured === false) && (
            <p role="alert" className="mt-4 flex gap-2 rounded-2xl bg-blush-light p-3 text-sm text-ink">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
              {unreachable
                ? 'The login service isn’t responding. If you’re running locally, use npm run dev.'
                : 'Login isn’t set up yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel, then redeploy.'}
            </p>
          )}

          <label htmlFor="admin-password" className="mt-6 mb-1.5 block text-sm font-medium">Password</label>
          <div className="relative">
            <input
              id="admin-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              autoComplete="current-password"
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? 'admin-error' : undefined}
              className={`h-12 w-full rounded-2xl bg-cream px-4 pr-12 text-base ring-1 outline-none transition-all focus:ring-2 ${error ? 'ring-rose focus:ring-rose' : 'ring-sand-dark focus:ring-sage-dark'}`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-sand"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p id="admin-error" role="alert" className="mt-2 text-sm font-medium text-rose">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-cream transition-all hover:bg-sage-dark disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-4 text-center text-xs text-ink-soft">You’ll stay signed in for 8 hours on this device.</p>
        </form>
      </div>
    </Centered>
  )
}
