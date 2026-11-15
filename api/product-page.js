// /p/<slug> (via a vercel.json rewrite): the shop page with THIS product's title, description, price
// and photo in the <head>. WhatsApp / Facebook / Google read these tags without running JavaScript,
// so shared product links get a proper preview. The React app then opens the product as usual.
import fs from 'node:fs/promises'
import path from 'node:path'
import { handle, query } from './_lib/http.js'
import { productBySlug, siteUrl } from './_lib/catalogPublic.js'
import { esc } from './_lib/alerts.js'
import { formatLKR } from '../src/utils/format.js'
import { imageSrc, ogImage } from '../src/utils/images.js'
import { isOrderable, totalStock } from '../src/data/products.js'

let shell = null // the built index.html (cached per server instance)

async function loadShell(req) {
  if (shell) return shell
  try {
    shell = await fs.readFile(path.join(process.cwd(), 'dist', 'index.html'), 'utf8') // bundled via vercel.json includeFiles
  } catch {
    const base = `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers['x-forwarded-host'] ?? req.headers.host}`
    const res = await fetch(`${base}/index.html`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`)
    shell = await res.text()
  }
  return shell
}

const setMeta = (html, attr, key, value) =>
  html.replace(new RegExp(`(<meta\\s+${attr}="${key.replace(/[:.]/g, '\\$&')}"\\s+content=")[^"]*(")`), `$1${esc(value)}$2`)

export default handle(['GET', 'HEAD'], async (req, res) => {
  const slug = query(req).get('slug') ?? ''
  const [html, product] = await Promise.all([loadShell(req), productBySlug(slug)])
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (!product) {
    res.statusCode = 404
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    return res.end(html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>'))
  }

  const base = siteUrl(req)
  const url = `${base}/p/${product.slug}`
  const title = `${product.title} · KIDSLA`
  const desc = `${product.description.slice(0, 150)} ${formatLKR(product.price)} · ${product.material}.`
  const image = ogImage(product.images[0])
  const orderable = isOrderable(product)
  const availability = !orderable ? 'PreOrder' : totalStock(product) > 0 ? 'InStock' : 'OutOfStock'

  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  out = setMeta(out, 'name', 'description', desc)
  for (const [k, v] of [['og:type', 'product'], ['og:url', url], ['og:title', title], ['og:description', desc], ['og:image', image], ['og:image:secure_url', image], ['og:image:type', 'image/jpeg'], ['og:image:alt', product.title]])
    out = setMeta(out, 'property', k, v)
  for (const [k, v] of [['twitter:title', title], ['twitter:description', desc], ['twitter:image', image]]) out = setMeta(out, 'name', k, v)
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`)

  // Google "Product" rich result. A data block (type="application/ld+json") never executes, so the CSP allows it.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    sku: product.id,
    brand: { '@type': 'Brand', name: 'KIDSLA' },
    material: product.material,
    image: product.images.slice(0, 4).map((src) => imageSrc(src, { w: 1200, ratio: '4:5' })),
    offers: { '@type': 'Offer', url, price: product.price, priceCurrency: 'LKR', availability: `https://schema.org/${availability}` },
  }
  const json = JSON.stringify(ld).replace(/</g, '\\u003c')
  out = out.replace('</head>', `    <script type="application/ld+json">${json}</script>\n  </head>`)

  res.statusCode = 200
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.end(req.method === 'HEAD' ? undefined : out)
})
