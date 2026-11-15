// /robots.txt (via a vercel.json rewrite), so it can point at the sitemap on the real domain.
import { handle } from './_lib/http.js'
import { siteUrl } from './_lib/catalogPublic.js'

export default handle(['GET', 'HEAD'], async (req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600')
  res.end(`User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl(req)}/sitemap.xml\n`)
})
