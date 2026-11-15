// /sitemap.xml (via a vercel.json rewrite): every public product page, for Google.
import { handle } from './_lib/http.js'
import { publicProducts, siteUrl } from './_lib/catalogPublic.js'
import { esc } from './_lib/alerts.js'

export default handle(['GET', 'HEAD'], async (req, res) => {
  const base = siteUrl(req)
  const products = await publicProducts()
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined)
  const urls = [
    { loc: `${base}/`, priority: '1.0' },
    ...products.map((p) => ({ loc: `${base}/p/${p.slug}`, lastmod: day(p.updatedAt), priority: p.status === 'active' ? '0.8' : '0.5' })),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.end(req.method === 'HEAD' ? undefined : xml)
})
