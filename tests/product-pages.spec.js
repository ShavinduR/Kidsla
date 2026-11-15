// Phase 2: shareable product links (/p/<slug>), link previews, sitemap, responsive images.
import { devices } from '@playwright/test'
import { api, expect, seed, test } from './helpers.js'

test.describe.configure({ mode: 'serial' })
test.use({ ...devices['Pixel 7'] })

test.beforeAll(seed)

test('cards are links: open the product, Back closes it and keeps the shop', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Boys', exact: true }).click() // pick a filter first
  const card = page.getByRole('link', { name: 'View Essential Crew Tee' })
  await expect(card).toHaveAttribute('href', '/p/essential-crew-tee')
  await card.click()
  await expect(page).toHaveURL(/\/p\/essential-crew-tee$/)
  await expect(page.getByRole('dialog', { name: 'Essential Crew Tee' })).toBeVisible()
  await expect(page).toHaveTitle('Essential Crew Tee · KIDSLA')
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Boys', exact: true })).toHaveAttribute('aria-pressed', 'true') // shop state kept
})

test('a shared link opens straight on the product; closing goes to the shop', async ({ page }) => {
  await page.goto('/p/cloud-ruffle-dress')
  await expect(page.getByRole('dialog', { name: 'Cloud Ruffle Dress' })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: /Soft on skin/ })).toBeVisible()
})

test('unknown or hidden product links show a friendly note', async ({ page }) => {
  await page.goto('/p/no-such-dress')
  await expect(page.getByText('Sorry, that product is no longer available')).toBeVisible()
})

test('Share copies the product link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => delete Navigator.prototype.share) // desktop-style fallback
  await page.goto('/p/muslin-romper')
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/p\/muslin-romper$/)
})

test('link previews: each product page has its own title, image and Google product data', async () => {
  const res = await (await api()).get('/p/petal-knit-cardigan')
  expect(res.status()).toBe(200)
  expect(res.headers()['cache-control']).toContain('s-maxage=300')
  const html = await res.text()
  expect(html).toContain('<title>Petal Knit Cardigan · KIDSLA</title>')
  expect(html).toMatch(/<meta property="og:type" content="product"/)
  expect(html).toMatch(/<meta property="og:url" content="http:\/\/localhost:4173\/p\/petal-knit-cardigan"/)
  expect(html).toMatch(/<meta property="og:image" content="https:\/\/images\.unsplash\.com\/[^"]*w=1200[^"]*h=630/)
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])
  expect(ld).toMatchObject({ '@type': 'Product', name: 'Petal Knit Cardigan', sku: 'KD-G-002', offers: { price: 3890, priceCurrency: 'LKR', availability: 'https://schema.org/InStock' } })
  expect(html).toContain('id="root"') // still the normal app
  // Toys are "coming soon" → PreOrder; unknown slugs → 404 + noindex.
  expect(await (await (await api()).get('/p/wooden-stacking-rainbow')).text()).toContain('https://schema.org/PreOrder')
  const missing = await (await api()).get('/p/nope')
  expect(missing.status()).toBe(404)
  expect(await missing.text()).toContain('<meta name="robots" content="noindex" />')
})

test('customer text in product data cannot break out of the page head', async () => {
  const admin = await api({ admin: true })
  const r = await admin.post('/api/admin/products', {
    data: {
      title: 'Evil "</script><script>alert(1)</script>',
      slug: 'evil-test',
      description: 'Tries to inject <script>alert(2)</script> into the head.',
      category: 'Clothing', gender: 'Girls', material: '"><img src=x onerror=alert(3)>', price: 100, status: 'active',
      sizes: ['1-2Y'], colors: [{ name: 'Red', hex: '#FF0000' }], images: ['https://images.unsplash.com/photo-1519238263530-99bdd11df2ea'], stock: { '1-2Y': 1 },
    },
  })
  expect(r.status()).toBe(201)
  const html = await (await (await api()).get('/p/evil-test')).text()
  expect(html).not.toContain('<script>alert')
  expect(html).not.toContain('<img src=x')
  expect(html).toContain('&lt;/script&gt;') // escaped in the title/meta
  expect(html).toContain('\\u003c/script') // escaped inside JSON-LD
})

test('sitemap + robots point Google at every public product', async () => {
  const c = await api()
  const xml = await (await c.get('/sitemap.xml')).text()
  expect(xml).toContain('<loc>http://localhost:4173/p/cloud-ruffle-dress</loc>')
  expect(xml).toContain('<loc>http://localhost:4173/p/wooden-stacking-rainbow</loc>')
  expect((xml.match(/<url>/g) ?? []).length).toBeGreaterThanOrEqual(15)
  const robots = await (await c.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /admin')
  expect(robots).toContain('Sitemap: http://localhost:4173/sitemap.xml')
})

test('images are responsive: phones get small files', async ({ page }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')
  const requested = []
  await page.route(/images\.unsplash\.com/, (r) => (requested.push(r.request().url()), r.fulfill({ contentType: 'image/png', body: png })))
  await page.goto('/')
  const img = page.getByRole('link', { name: 'View Cloud Ruffle Dress' }).locator('img')
  await expect(img).toHaveAttribute('srcset', /w=240[^,]* 240w, .*w=1280[^,]* 1280w/)
  await expect(img).toHaveAttribute('sizes', /48vw/)
  await expect(img).toHaveAttribute('loading', 'lazy')
  // A Pixel 7 (412px wide, 2.6× screen) shows cards at ~48vw → it should pick a ~480–720px file, never 1280.
  await expect.poll(() => requested.find((u) => u.includes('photo-1518831959646'))).toBeTruthy()
  const w = Number(new URL(requested.find((u) => u.includes('photo-1518831959646'))).searchParams.get('w'))
  expect(w).toBeLessThan(1280)
})

test('no sideways scrolling on phones: shop, product, admin and editor', async ({ page }) => {
  const width = () => page.evaluate(() => document.documentElement.scrollWidth)
  const screen = page.viewportSize().width
  await page.goto('/')
  expect(await width()).toBeLessThanOrEqual(screen)
  await page.goto('/p/cloud-ruffle-dress')
  await page.getByRole('button', { name: /Size guide/ }).click()
  expect(await width()).toBeLessThanOrEqual(screen)
  await page.goto('/admin')
  await page.getByLabel('Password', { exact: true }).fill((await import('./helpers.js')).PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('heading', { name: 'Inventory' }).waitFor()
  expect(await width()).toBeLessThanOrEqual(screen) // was 784px: a hidden table label escaped its scroll box
  await page.getByRole('button', { name: 'Details Cloud Ruffle Dress' }).click()
  const sheet = await page.getByRole('dialog').locator('> div').last().boundingBox()
  expect(sheet.x).toBeGreaterThanOrEqual(0)
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(screen + 1)
  await page.getByRole('button', { name: /^Orders/ }).count()
})
