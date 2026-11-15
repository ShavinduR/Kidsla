import { useState } from 'react'
import { Dialog, btn } from './ui'
import { SIZES, STATUSES } from '../../../shared/inventory.js'
import { updateProduct } from '../../services/adminApi'

const STATUS_LABEL = { active: 'Active (can be ordered)', coming_soon: 'Coming soon', hidden: 'Hidden from shop' }

const formFrom = (p) => ({
  price: String(p.price),
  status: p.status,
  stock: Object.fromEntries(SIZES.map((s) => [s, String(p.stock?.[s] ?? 0)])),
})

export default function EditProductDialog({ product: initial, onClose, onSaved }) {
  // `base` = the server values this form started from (incl. version). Only fields the admin
  // actually changes are sent, together with base.version, so the server can refuse stale saves.
  const [base, setBase] = useState(initial)
  const [form, setForm] = useState(() => formFrom(initial))
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState('')
  const [saving, setSaving] = useState(false)
  const isClothing = base.category === 'Clothing'
  const { price, status, stock } = form
  const setPrice = (v) => setForm((f) => ({ ...f, price: v }))
  const setStatus = (v) => setForm((f) => ({ ...f, status: v }))
  const setStock = (fn) => setForm((f) => ({ ...f, stock: fn(f.stock) }))

  const save = async (e) => {
    e.preventDefault()
    const start = formFrom(base)
    const edit = { id: base.id, version: base.version ?? 0 }
    if (price !== start.price) edit.price = price
    if (status !== start.status) edit.status = status
    if (isClothing) {
      const changed = SIZES.filter((s) => stock[s] !== start.stock[s])
      if (changed.length) edit.stock = Object.fromEntries(changed.map((s) => [s, stock[s]]))
    }
    if (Object.keys(edit).length === 2) return onClose() // nothing changed

    setSaving(true)
    setError('')
    setConflict('')
    const res = await updateProduct(edit)
    setSaving(false)
    if (res.status === 409 && res.product) {
      // Someone/something changed it meanwhile → show the latest numbers; the admin re-applies their edit.
      setBase(res.product)
      setForm(formFrom(res.product))
      return setConflict(res.error)
    }
    if (!res.ok) return setError(res.error ?? 'Couldn’t save. Try again.')
    onSaved(res.product, res.changed)
  }

  const field = 'h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark'

  return (
    <Dialog
      title={`Edit ${base.title}`}
      subtitle={`${base.id} · version ${base.version ?? 0}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${btn.secondary} flex-1`}>Cancel</button>
          <button type="submit" form="edit-product" disabled={saving} className={`${btn.primary} flex-1`}>{saving ? 'Saving…' : 'Save changes'}</button>
        </>
      }
    >
      <form id="edit-product" onSubmit={save} className="space-y-5">
        {conflict && (
          <p role="alert" className="rounded-2xl bg-blush-light p-3 text-sm text-ink ring-1 ring-blush">
            <strong className="font-semibold">Updated meanwhile.</strong> {conflict}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Price (LKR)</span>
            <input type="number" inputMode="numeric" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} className={field} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
        {isClothing ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Available to sell, per size</legend>
            <div className="grid grid-cols-3 gap-3">
              {SIZES.map((s) => (
                <label key={s} className="block">
                  <span className="mb-1 block text-xs text-ink-soft">{s}</span>
                  <input
                    type="number" inputMode="numeric" min="0" step="1" value={stock[s]}
                    onChange={(e) => setStock((st) => ({ ...st, [s]: e.target.value }))}
                    className={field} aria-label={`Stock ${s}`}
                  />
                  {(base.reserved?.[s] ?? 0) > 0 && (
                    <span className="mt-1 block text-xs text-ink-soft">+{base.reserved[s]} held by pending orders</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-ink-soft">Toys and Educational items can’t be ordered yet, so they have no stock.</p>
        )}
        {error && <p role="alert" className="text-sm font-medium text-rose">{error}</p>}
      </form>
    </Dialog>
  )
}
