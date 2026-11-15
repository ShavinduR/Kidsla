import { useMemo, useState } from 'react'
import { Archive, ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Dialog, btn } from './ui'
import ImagesField from './ImagesField'
import { CLOTHING_SIZES } from '../../data/sizeGuide'
import { BADGES, CATEGORIES, GENDERS, ONE_SIZE, PRODUCT_STATUSES, fieldErrors, productSchema, slugify } from '../../../shared/productSchema.js'
import { createProduct, updateProduct } from '../../services/adminApi'

const STATUS_LABEL = { active: 'Active: can be ordered', coming_soon: 'Coming soon: shown, not orderable', hidden: 'Hidden from shop', archived: 'Archived' }
const EMPTY = {
  title: '', slug: '', description: '', category: 'Clothing', gender: 'Girls', material: '100% Cotton', price: '',
  status: 'hidden', badge: '', sizes: [...CLOTHING_SIZES], colors: [{ name: '', hex: '#E8C4C0' }], images: [], stock: {},
}
const formOf = (p) => ({
  ...EMPTY,
  ...p,
  price: String(p.price ?? ''),
  badge: p.badge ?? '',
  gender: p.gender ?? null,
  stock: Object.fromEntries(Object.entries(p.stock ?? {}).map(([k, v]) => [k, String(v)])),
})
// What we send: numbers as numbers, stock only for offered sizes.
const payloadOf = (f) => ({
  ...f,
  price: f.price === '' ? undefined : Number(f.price),
  stock: f.category === 'Clothing' ? Object.fromEntries(f.sizes.map((s) => [s, Number(f.stock[s] || 0)])) : {},
})

const Err = ({ msg }) => (msg ? <p role="alert" className="mt-1.5 text-sm font-medium text-rose">{msg}</p> : null)
const Label = ({ k, children }) => <label htmlFor={`pe-${k}`} className="mb-1.5 block text-sm font-medium">{children}</label>

/** Full product editor. `product` = null → create a new product. */
export default function ProductEditor({ product, onClose, onSaved }) {
  const isNew = !product
  const [base, setBase] = useState(product)
  const [form, setForm] = useState(() => (product ? formOf(product) : EMPTY))
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [saving, setSaving] = useState(false)
  const clothing = form.category === 'Clothing'

  const set = (k) => (v) => {
    setForm((f) => {
      const value = typeof v === 'function' ? v(f[k]) : v
      const next = { ...f, [k]: value }
      if (k === 'title' && !slugTouched) next.slug = slugify(value)
      return next
    })
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const onInput = (k) => (e) => set(k)(e.target.value)

  const changeCategory = (category) =>
    setForm((f) =>
      category === 'Clothing'
        ? { ...f, category, gender: f.gender ?? 'Girls', sizes: f.category === 'Clothing' ? f.sizes : [...CLOTHING_SIZES] }
        : { ...f, category, gender: null, sizes: [ONE_SIZE], stock: {}, status: f.status === 'active' ? 'coming_soon' : f.status },
    )

  const toggleSize = (s) =>
    set('sizes')((sizes) => (sizes.includes(s) ? sizes.filter((x) => x !== s) : CLOTHING_SIZES.filter((x) => x === s || sizes.includes(x))))

  const statuses = useMemo(() => PRODUCT_STATUSES.filter((s) => (clothing || s !== 'active') && (s !== 'archived' || form.status === 'archived')), [clothing, form.status])

  const submit = async (e, override) => {
    e?.preventDefault()
    const data = payloadOf(override ? { ...form, ...override } : form)
    const parsed = productSchema.safeParse(data)
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error)
      setErrors(errs)
      setBanner('Please fix the highlighted fields.')
      document.getElementById(`pe-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSaving(true)
    setBanner('')
    let res
    if (isNew) res = await createProduct(data)
    else {
      // Only send what changed, plus the version this form was based on.
      const start = payloadOf(formOf(base))
      const changed = Object.fromEntries(Object.entries(data).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(start[k])))
      if (!Object.keys(changed).length) {
        setSaving(false)
        return onClose()
      }
      res = await updateProduct({ id: base.id, version: base.version ?? 0, ...changed })
    }
    setSaving(false)
    if (res.status === 409 && res.product) {
      setBase(res.product)
      setForm(formOf(res.product))
      return setBanner(res.error)
    }
    if (!res.ok) {
      setErrors(res.fields ?? {})
      return setBanner(res.error ?? 'Couldn’t save. Try again.')
    }
    onSaved(res.product, isNew ? ['created'] : res.changed)
  }

  const archive = (e) => {
    if (window.confirm(`Archive "${base.title}"? It disappears from the shop. Past orders keep working, and you can restore it any time.`))
      submit(e, { status: 'archived' })
  }

  const field = (k) =>
    `w-full rounded-2xl bg-white px-4 text-base ring-1 outline-none focus:ring-2 ${errors[k] ? 'ring-rose focus:ring-rose' : 'ring-sand-dark focus:ring-sage-dark'}`

  return (
    <Dialog
      title={isNew ? 'Add product' : `Edit ${base.title}`}
      subtitle={isNew ? 'Saved as Hidden until you set it to Active.' : `${base.id} · version ${base.version ?? 0}`}
      onClose={onClose}
      labelId="pe-title-h"
      footer={
        <>
          {!isNew &&
            (base.status === 'archived' ? (
              <button type="button" onClick={(e) => submit(e, { status: 'hidden' })} className={btn.secondary} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> Restore
              </button>
            ) : (
              <button type="button" onClick={archive} className={`${btn.secondary} text-rose`} disabled={saving}>
                <Archive className="h-4 w-4" /> Archive
              </button>
            ))}
          <button type="button" onClick={onClose} className={`${btn.secondary} ml-auto`}>Cancel</button>
          <button type="submit" form="product-editor" disabled={saving} className={btn.primary}>{saving ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}</button>
        </>
      }
    >
      <form id="product-editor" onSubmit={submit} className="space-y-6" noValidate>
        {banner && <p role="alert" className="rounded-2xl bg-blush-light p-3 text-sm text-ink ring-1 ring-blush">{banner}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label k="title">Title</Label>
            <input id="pe-title" value={form.title} onChange={onInput('title')} className={`${field('title')} h-12`} maxLength={80} />
            <Err msg={errors.title} />
          </div>
          <div className="sm:col-span-2">
            <Label k="slug">Link name</Label>
            <div className="flex items-center rounded-2xl bg-sand/50 pl-4 text-sm text-ink-soft ring-1 ring-sand-dark focus-within:ring-2 focus-within:ring-sage-dark">
              /p/
              <input
                id="pe-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug')(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                }}
                className="h-12 flex-1 rounded-r-2xl bg-white px-2 text-base text-ink outline-none"
                maxLength={60}
              />
            </div>
            {!isNew && base.slug !== form.slug && <p className="mt-1.5 text-xs text-rose">Changing this breaks links people already shared.</p>}
            {!isNew && base.status !== 'hidden' && base.status !== 'archived' && (
              <a href={`/p/${base.slug}`} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-sage-dark underline">
                View in shop <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Err msg={errors.slug} />
          </div>
          <div className="sm:col-span-2">
            <Label k="description">Description</Label>
            <textarea id="pe-description" value={form.description} onChange={onInput('description')} rows={3} maxLength={600} className={`${field('description')} resize-none py-3`} />
            <Err msg={errors.description} />
          </div>
          <div>
            <Label k="category">Category</Label>
            <select id="pe-category" value={form.category} onChange={(e) => changeCategory(e.target.value)} className={`${field('category')} h-12`}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {clothing && (
            <div>
              <Label k="gender">For</Label>
              <select id="pe-gender" value={form.gender ?? ''} onChange={onInput('gender')} className={`${field('gender')} h-12`}>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
              <Err msg={errors.gender} />
            </div>
          )}
          <div>
            <Label k="material">Material</Label>
            <input id="pe-material" value={form.material} onChange={onInput('material')} className={`${field('material')} h-12`} maxLength={60} />
            <Err msg={errors.material} />
          </div>
          <div>
            <Label k="price">Price (LKR)</Label>
            <input id="pe-price" type="number" inputMode="numeric" min="0" step="1" value={form.price} onChange={onInput('price')} className={`${field('price')} h-12`} />
            <Err msg={errors.price} />
          </div>
          <div>
            <Label k="status">Status</Label>
            <select id="pe-status" value={form.status} onChange={onInput('status')} className={`${field('status')} h-12`}>
              {statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            {!clothing && <p className="mt-1.5 text-xs text-ink-soft">Toys and Educational items can’t be ordered yet, so they show as Coming soon.</p>}
            <Err msg={errors.status} />
          </div>
          <div>
            <Label k="badge">Badge</Label>
            <select id="pe-badge" value={form.badge} onChange={onInput('badge')} className={`${field('badge')} h-12`}>
              {BADGES.map((b) => <option key={b} value={b}>{b || 'None'}</option>)}
            </select>
          </div>
        </div>

        {clothing && (
          <fieldset id="pe-sizes">
            <legend className="mb-1.5 text-sm font-medium">Sizes &amp; stock available to sell</legend>
            <div className="grid grid-cols-3 gap-3">
              {CLOTHING_SIZES.map((s) => {
                const on = form.sizes.includes(s)
                const held = base?.reserved?.[s] ?? 0
                return (
                  <div key={s} className={`rounded-2xl p-3 ring-1 ${on ? 'bg-white ring-sage-dark' : 'bg-sand/40 ring-sand-dark'}`}>
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={on} onChange={() => toggleSize(s)} className="h-4 w-4 accent-[#55654B]" /> {s}
                    </label>
                    {on && (
                      <input
                        type="number" inputMode="numeric" min="0" step="1" aria-label={`Stock ${s}`}
                        value={form.stock[s] ?? '0'}
                        onChange={(e) => set('stock')((st) => ({ ...st, [s]: e.target.value }))}
                        className="mt-2 h-10 w-full rounded-xl bg-cream px-3 text-base ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark"
                      />
                    )}
                    {held > 0 && <p className="mt-1 text-xs text-ink-soft">+{held} held</p>}
                  </div>
                )
              })}
            </div>
            <Err msg={errors.sizes} />
            <Err msg={errors.stock} />
          </fieldset>
        )}

        <fieldset id="pe-colors">
          <legend className="mb-1.5 text-sm font-medium">Colours</legend>
          <ul className="space-y-2">
            {form.colors.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  type="color" value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#ffffff'} aria-label={`Colour ${i + 1} swatch`}
                  onChange={(e) => set('colors')((cs) => cs.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))}
                  className="h-11 w-11 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
                <input
                  value={c.name} placeholder="Colour name, e.g. Dusty Pink" aria-label={`Colour ${i + 1} name`} maxLength={30}
                  onChange={(e) => set('colors')((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="h-11 flex-1 rounded-2xl bg-white px-4 ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark"
                />
                <button type="button" aria-label={`Remove colour ${i + 1}`} onClick={() => set('colors')((cs) => cs.filter((_, j) => j !== i))} disabled={form.colors.length === 1}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-blush-light hover:text-rose disabled:opacity-30">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {form.colors.length < 8 && (
            <button type="button" onClick={() => set('colors')((cs) => [...cs, { name: '', hex: '#DDE3D5' }])} className={`${btn.ghost} mt-2`}>
              <Plus className="h-4 w-4" /> Add colour
            </button>
          )}
          <Err msg={errors.colors} />
        </fieldset>

        <div id="pe-images">
          <ImagesField images={form.images} onChange={set('images')} error={errors.images} />
        </div>
      </form>
    </Dialog>
  )
}
