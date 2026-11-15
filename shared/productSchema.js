// Product rules, shared by the server (/api) and the admin editor, so the browser shows exactly
// the errors the server would return. Built with zod (https://zod.dev).
import { z } from 'zod'

// Never use eval/new Function: the site's Content-Security-Policy forbids it (zod would fall back
// anyway, but every attempt files a CSP violation report).
z.config({ jitless: true })
import { CLOTHING_SIZES } from '../src/data/sizeGuide.js'

export const CATEGORIES = ['Clothing', 'Toys', 'Educational']
export const GENDERS = ['Girls', 'Boys']
export const BADGES = ['', 'New', 'Bestseller']
export const ONE_SIZE = 'One Size'
// archived = removed from the shop and hidden in the admin list, but kept so old orders still resolve.
export const PRODUCT_STATUSES = ['active', 'coming_soon', 'hidden', 'archived']
export const MAX_IMAGES = 8

/** Image URLs must come from hosts the site's Content-Security-Policy allows. */
export const IMAGE_HOSTS = ['res.cloudinary.com', 'images.unsplash.com']
export const isAllowedImageUrl = (u) => {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && IMAGE_HOSTS.includes(url.hostname)
  } catch {
    return false
  }
}

export { slugify } from './slug.js'


const text = (min, max, label) =>
  z.string({ error: `${label} is required` }).trim().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be at most ${max} characters`)

const color = z.object({
  name: text(1, 30, 'Colour name'),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a hex value like #E8C4C0'),
})

export const productSchema = z
  .object({
    title: text(3, 80, 'Title'),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Link name may only use a–z, 0–9 and dashes').max(60),
    description: text(10, 600, 'Description'),
    category: z.enum(CATEGORIES, { error: 'Choose a category' }),
    gender: z.enum(GENDERS).nullable().optional(),
    material: text(2, 60, 'Material'),
    price: z.coerce
      .number({ error: (i) => (i.code === 'invalid_type' ? 'Price must be a number' : undefined) })
      .int('Price must be a whole number')
      .min(0, 'Price can’t be negative')
      .max(1_000_000, 'Price is too high'),
    status: z.enum(PRODUCT_STATUSES),
    badge: z.enum(BADGES).optional().default(''),
    sizes: z.array(z.string(), { error: 'Choose at least one size' }).min(1, 'Choose at least one size'),
    colors: z
      .array(color, { error: 'Add at least one colour' })
      .min(1, 'Add at least one colour')
      .max(8, 'At most 8 colours')
      .refine((cs) => new Set(cs.map((c) => c.name.toLowerCase())).size === cs.length, 'Colour names must be different'),
    images: z
      .array(z.string().refine(isAllowedImageUrl, 'Images must be uploaded here (Cloudinary) or Unsplash links'))
      .min(1, 'Add at least one photo')
      .max(MAX_IMAGES, `At most ${MAX_IMAGES} photos`),
    stock: z.record(z.string(), z.coerce.number().int('Stock must be a whole number').min(0).max(100_000)).default({}),
  })
  .superRefine((p, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (p.category === 'Clothing') {
      if (!p.gender) issue('gender', 'Choose Girls or Boys')
      const bad = p.sizes.filter((s) => !CLOTHING_SIZES.includes(s))
      if (bad.length) issue('sizes', `Unknown size: ${bad.join(', ')}`)
      if (new Set(p.sizes).size !== p.sizes.length) issue('sizes', 'Sizes must be different')
      const extra = Object.keys(p.stock).filter((s) => !p.sizes.includes(s))
      if (extra.length) issue('stock', `Stock given for sizes not offered: ${extra.join(', ')}`)
    } else {
      // Business rule (for now): only clothing can be ordered. Toys & Educational are shown as Coming soon.
      if (p.gender) issue('gender', 'Only clothing has Girls/Boys')
      if (p.sizes.length !== 1 || p.sizes[0] !== ONE_SIZE) issue('sizes', `${p.category} items use "${ONE_SIZE}"`)
      if (p.status === 'active') issue('status', `${p.category} items can’t be ordered yet: use Coming soon`)
      if (Object.keys(p.stock).length) issue('stock', `${p.category} items have no stock yet`)
    }
  })

/** Fields an admin may send when creating or editing. Everything else (id, version, reserved…) is server-owned. */
export const EDITABLE_FIELDS = ['title', 'slug', 'description', 'category', 'gender', 'material', 'price', 'status', 'badge', 'sizes', 'colors', 'images', 'stock']

/** zod error → { field: message } for the form. */
export const fieldErrors = (error) => {
  const out = {}
  for (const i of error.issues) {
    const key = i.path[0] ?? '_form'
    out[key] ??= i.message
  }
  return out
}
