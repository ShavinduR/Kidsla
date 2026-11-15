import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Notice, Spinner, btn } from './ui'
import { fetchActivity } from '../../services/adminApi'

const LABEL = {
  'admin.login': 'Signed in',
  'admin.login_failed': 'Failed sign-in',
  'admin.signout_all': 'Signed out all devices',
  'product.create': 'Product created',
  'product.update': 'Product edited',
  'product.archive': 'Product archived',
  'inventory.import': 'Spreadsheet imported',
  'catalogue.seed': 'Starter catalogue loaded',
  'order.confirm': 'Order confirmed',
  'order.cancel': 'Order cancelled',
  'settings.update': 'Settings changed',
  'payment.paid': 'Paid online',
  'payment.processing': 'Payment processing',
  'payment.cancelled': 'Payment cancelled',
  'payment.failed': 'Payment failed',
  'payment.chargedback': 'Chargeback',
  'payment.bad_signature': '⚠️ Rejected fake payment message',
  'payment.amount_mismatch': '⚠️ Payment amount mismatch',
}
const when = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const summary = (d = {}) =>
  Object.entries(d)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ')

export default function ActivityTab() {
  const [data, setData] = useState(null)
  const load = () => fetchActivity().then(setData)
  useEffect(() => {
    load() // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Activity</h1>
          <p className="mt-1 text-ink-soft">Who changed what. Kept for one year.</p>
        </div>
        <button onClick={load} className={btn.ghost}><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>
      <div className="mt-6">
        {!data ? (
          <Spinner label="Loading activity" />
        ) : !data.ok ? (
          <Notice tone="error">{data.error ?? 'Couldn’t load activity.'}</Notice>
        ) : (
          <ol className="divide-y divide-sand rounded-2xl bg-white ring-1 ring-sand">
            {data.entries.map((e, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
                <span className="w-32 shrink-0 text-ink-soft">{when(e.at)}</span>
                <span className="font-medium">{LABEL[e.action] ?? e.action}</span>
                {e.target && <span className="font-mono text-xs text-ink-soft">{e.target}</span>}
                <span className="min-w-0 truncate text-xs text-ink-soft sm:ml-auto">{summary(e.details)}</span>
              </li>
            ))}
            {data.entries.length === 0 && <li className="px-4 py-10 text-center text-ink-soft">Nothing yet.</li>}
          </ol>
        )}
      </div>
    </>
  )
}
