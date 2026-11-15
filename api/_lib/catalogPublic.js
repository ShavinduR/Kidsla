// Public product lookups for server-rendered pages (product links, sitemap). Uses the database when
// connected, otherwise the catalogue bundled in the code, so links work before MongoDB is set up.
import { isDbConfigured } from './db.js'
import { loadProducts } from './catalog.js'
import { initialProducts } from '../../src/data/products.js'

const PUBLIC = { status: { $in: ['active', 'coming_soon'] } }

export async function publicProducts() {
  if (!isDbConfigured()) return initialProducts.filter((p) => ['active', 'coming_soon'].includes(p.status))
  return loadProducts(PUBLIC)
}

export async function productBySlug(slug) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug ?? '')) return null
  if (!isDbConfigured()) return initialProducts.find((p) => p.slug === slug && p.status !== 'hidden') ?? null
  const [p] = await loadProducts({ ...PUBLIC, slug })
  return p ?? null
}

/** Canonical site address, e.g. https://kidsla.vercel.app (no trailing slash). */
export const siteUrl = (req) =>
  (process.env.VITE_SITE_URL || `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers['x-forwarded-host'] ?? req.headers.host}`).replace(/\/$/, '')
