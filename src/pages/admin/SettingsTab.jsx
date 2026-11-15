import { useEffect, useState } from 'react'
import { CircleCheck, CreditCard, TriangleAlert } from 'lucide-react'
import { Notice, Spinner, btn } from './ui'
import { fetchSettings, saveSettings } from '../../services/adminApi'
import { fieldErrors } from '../../../shared/productSchema.js'
import { settingsSchema } from '../../../shared/settingsSchema.js'

const toForm = (s) => ({
  colombo: String(s.deliveryFees.colombo),
  outstation: String(s.deliveryFees.outstation),
  freeDeliveryOver: String(s.freeDeliveryOver),
  cod: s.payments.cod,
  bank: s.payments.bank,
  online: s.payments.online,
  bankDetails: s.bankDetails,
  holdHours: String(s.holdHours),
  onlineHoldMinutes: String(s.onlineHoldMinutes),
})
const toSettings = (f) => ({
  deliveryFees: { colombo: f.colombo, outstation: f.outstation },
  freeDeliveryOver: f.freeDeliveryOver || 0,
  payments: { cod: f.cod, bank: f.bank, online: f.online },
  bankDetails: f.bankDetails,
  holdHours: f.holdHours,
  onlineHoldMinutes: f.onlineHoldMinutes,
})

export default function SettingsTab({ toast }) {
  const [data, setData] = useState(null) // { settings, payhere }
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = (r) => {
    setData({ settings: r.settings, payhere: r.payhere })
    setForm(toForm(r.settings))
  }
  useEffect(() => {
    fetchSettings().then((r) => (r.ok ? apply(r) : setBanner(r.error ?? 'Couldn’t load settings.'))) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  if (!form) return banner ? <Notice tone="error">{banner}</Notice> : <Spinner label="Loading settings" />
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
    setErrors({})
  }

  const save = async (e) => {
    e.preventDefault()
    const settings = toSettings(form)
    const parsed = settingsSchema.safeParse(settings)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setSaving(true)
    const r = await saveSettings({ ...settings, version: data.settings.version })
    setSaving(false)
    if (r.status === 409 && r.settings) {
      apply(r)
      return setBanner(r.error)
    }
    if (!r.ok) return setErrors(r.fields ?? { _form: r.error })
    apply(r)
    setBanner('')
    toast(r.changed?.length ? `Settings saved: ${r.changed.join(', ')}. The shop updates within a minute.` : 'No changes.')
  }

  const input = 'h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark'
  const err = (k) => errors[k] && <p role="alert" className="mt-1.5 text-sm font-medium text-rose">{errors[k]}</p>
  const ph = data.payhere

  return (
    <form onSubmit={save} className="max-w-3xl space-y-8" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-ink-soft">Used by the shop and by the server when it prices each order.</p>
      </div>
      {banner && <Notice tone="warn">{banner}</Notice>}
      {errors._form && <Notice tone="error">{errors._form}</Notice>}

      <section className="rounded-2xl bg-white p-5 ring-1 ring-sand sm:p-6">
        <h2 className="font-semibold">Delivery</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Colombo (LKR)</span>
            <input type="number" inputMode="numeric" min="0" value={form.colombo} onChange={set('colombo')} className={input} aria-label="Colombo delivery fee" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Outstation (LKR)</span>
            <input type="number" inputMode="numeric" min="0" value={form.outstation} onChange={set('outstation')} className={input} aria-label="Outstation delivery fee" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Free delivery over (LKR)</span>
            <input type="number" inputMode="numeric" min="0" value={form.freeDeliveryOver} onChange={set('freeDeliveryOver')} className={input} aria-label="Free delivery threshold" />
            <span className="mt-1 block text-xs text-ink-soft">0 = never free</span></label>
        </div>
        {err('deliveryFees')}{err('freeDeliveryOver')}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-sand sm:p-6">
        <h2 className="font-semibold">Payment methods</h2>
        <div className="mt-4 space-y-3">
          {[
            ['cod', 'Cash on Delivery'],
            ['bank', 'Bank Transfer'],
            ['online', 'Pay Online (PayHere: cards, eZcash, Genie…)'],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={form[k]} onChange={set(k)} className="h-5 w-5 accent-[#55654B]" aria-label={label} /> {label}
            </label>
          ))}
        </div>
        {err('payments')}
        <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${ph.configured ? 'bg-sage-light/60 text-sage-dark' : 'bg-blush-light text-ink'}`}>
          {ph.configured ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose" />}
          <span>
            {ph.configured ? (
              <>PayHere connected: merchant {ph.merchantId}, <strong>{ph.mode === 'live' ? 'LIVE payments' : 'SANDBOX (test cards only)'}</strong>.</>
            ) : (
              <>PayHere isn’t connected, so Pay Online stays hidden. Add PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET in Vercel.</>
            )}
          </span>
        </div>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium">Bank details (shown to customers who choose Bank Transfer)</span>
          <textarea rows={4} value={form.bankDetails} onChange={set('bankDetails')} placeholder={'Commercial Bank · Colombo 03 branch\nKIDSLA (Pvt) Ltd\nAccount 1234567890'} className={`${input} h-auto resize-none py-3`} aria-label="Bank details" />
        </label>
        {form.bank && !form.bankDetails.trim() && (
          <p className="mt-1.5 text-xs text-ink-soft">Empty = customers are asked to get the details from you on WhatsApp.</p>
        )}
        {err('bankDetails')}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-sand sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4 text-sage-dark" /> Holding stock for unpaid orders</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Cash / bank orders (hours)</span>
            <input type="number" inputMode="numeric" min="1" max="168" value={form.holdHours} onChange={set('holdHours')} className={input} aria-label="Hold hours" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Online payments (minutes)</span>
            <input type="number" inputMode="numeric" min="15" max="1440" value={form.onlineHoldMinutes} onChange={set('onlineHoldMinutes')} className={input} aria-label="Online hold minutes" /></label>
        </div>
        {err('holdHours')}{err('onlineHoldMinutes')}
      </section>

      <button type="submit" disabled={saving} className={btn.primary}>{saving ? 'Saving…' : 'Save settings'}</button>
    </form>
  )
}
