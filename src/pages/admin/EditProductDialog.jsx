import { useState } from 'react'
import { Dialog, btn } from './ui'
import { SIZES, STATUSES } from '../../../shared/inventory.js'
import { updateProduct } from '../../services/adminApi'

const STATUS_LABEL = { active: 'Active (can be ordered)', coming_soon: 'Coming soon', hidden: 'Hidden from shop' }

export default function EditProductDialog({ product, onClose, onSaved }) {
  const isClothing = product.category === 'Clothing'
  const [price, setPrice] = useState(String(product.price))
  const [status, setStatus] = useState(product.status)
  const [stock, setStock] = useState(Object.fromEntries(SIZES.map((s) => [s, String(product.stock?.[s] ?? 0)])))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await updateProduct({ id: product.id, price, status, ...(isClothing && { stock }) })
    setSaving(false)
    if (!res.ok) return setError(res.error ?? 'Couldn’t save. Try again.')
    onSaved(res.product, res.changed)
  }

  const field = 'h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark'

  return (
    <Dialog
      title={`Edit ${product.title}`}
      subtitle={product.id}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${btn.secondary} flex-1`}>Cancel</button>
          <button type="submit" form="edit-product" disabled={saving} className={`${btn.primary} flex-1`}>{saving ? 'Saving…' : 'Save changes'}</button>
        </>
      }
    >
      <form id="edit-product" onSubmit={save} className="space-y-5">
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
            <legend className="mb-1.5 text-sm font-medium">Stock per size</legend>
            <div className="grid grid-cols-3 gap-3">
              {SIZES.map((s) => (
                <label key={s} className="block">
                  <span className="mb-1 block text-xs text-ink-soft">{s}</span>
                  <input
                    type="number" inputMode="numeric" min="0" step="1" value={stock[s]}
                    onChange={(e) => setStock((st) => ({ ...st, [s]: e.target.value }))}
                    className={field} aria-label={`Stock ${s}`}
                  />
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
