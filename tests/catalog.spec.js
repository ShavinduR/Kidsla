// Phase 2: product management (create / edit / archive), validation and Cloudinary uploads.
import crypto from 'node:crypto'
import { api, db, expect, PASSWORD, placeOrder, seed, test } from './helpers.js'

test.describe.configure({ mode: 'serial' })

const UNSPLASH = 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea'
const OWN_CLOUD = 'https://res.cloudinary.com/kidsla-test/image/upload/v1731700000/kidsla/products/abc123.jpg'
const newProduct = (over = {}) => ({
  title: 'Linen Play Shorts',
  description: 'Breezy shorts for hot Colombo afternoons.',
  category: 'Clothing',
  gender: 'Boys',
  material: '100% Cotton',
  price: 2450,
  status: 'active',
  badge: 'New',
  sizes: ['1-2Y', '3-4Y'],
  colors: [{ name: 'Sand', hex: '#E2D6C6' }],
  images: [UNSPLASH],
  stock: { '1-2Y': 4, '3-4Y': 6 },
  ...over,
})

test('create: validated server-side, gets an SKU and link, appears in the shop first', async () => {
  const admin = await seed()
  const bad = await admin.post('/api/admin/products', { data: newProduct({ title: 'X', price: -5, colors: [], images: ['https://evil.example/x.jpg'] }) })
  expect(bad.status()).toBe(400)
  const { fields } = await bad.json()
  expect(fields).toMatchObject({ title: expect.stringMatching(/at least 3/), price: 'Price can’t be negative', colors: 'Add at least one colour' })

  const r = await admin.post('/api/admin/products', { data: newProduct() })
  expect(r.status()).toBe(201)
  const { product } = await r.json()
  expect(product).toMatchObject({ id: 'KD-B-005', slug: 'linen-play-shorts', version: 0, reserved: {} })

  const shop = await (await (await api()).get('/api/products')).json()
  expect(shop.products[0].id).toBe('KD-B-005') // new products first
  // It can be ordered right away.
  expect((await placeOrder(await api(), [{ id: 'KD-B-005', size: '3-4Y', color: 'Sand', qty: 1 }])).status()).toBe(201)

  const dup = await admin.post('/api/admin/products', { data: newProduct() })
  expect((await dup.json()).fields.slug).toMatch(/already uses/)
})

test('business rules: toys can’t be active; foreign Cloudinary accounts are refused', async () => {
  const admin = await api({ admin: true })
  const toy = await admin.post('/api/admin/products', { data: newProduct({ title: 'Wooden Train', category: 'Toys', gender: null, sizes: ['One Size'], stock: {} }) })
  expect((await toy.json()).fields.status).toMatch(/can’t be ordered yet/)
  const ok = await admin.post('/api/admin/products', { data: newProduct({ title: 'Wooden Train', category: 'Toys', gender: null, status: 'coming_soon', sizes: ['One Size'], stock: {} }) })
  expect((await ok.json()).product.id).toBe('KD-T-004')

  const foreign = await admin.post('/api/admin/products', { data: newProduct({ title: 'Other Cloud', images: ['https://res.cloudinary.com/someone-else/image/upload/v1/x.jpg'] }) })
  expect((await foreign.json()).fields.images).toMatch(/isn’t from this shop/)
  const own = await admin.post('/api/admin/products', { data: newProduct({ title: 'Own Cloud', images: [OWN_CLOUD] }) })
  expect(own.status()).toBe(201)
})

test('edit details: version-checked; held sizes can’t be removed', async () => {
  const admin = await api({ admin: true })
  const list = (await (await admin.get('/api/admin/products')).json()).products
  const shorts = list.find((p) => p.id === 'KD-B-005') // 1 unit of 3-4Y is held by the order above
  const r = await admin.patch('/api/admin/products', { data: { id: shorts.id, version: shorts.version, sizes: ['1-2Y'] } })
  expect((await r.json()).fields.sizes).toMatch(/3-4Y \(1 held by pending orders\)/)

  const ok = await admin.patch('/api/admin/products', { data: { id: shorts.id, version: shorts.version, title: 'Linen Play Shorts II', colors: [...shorts.colors, { name: 'Sage', hex: '#8A9A7E' }] } })
  expect(ok.status()).toBe(200)
  expect((await ok.json()).changed).toEqual(['title updated', 'colours updated'])
  // Link name stays the same when the title changes (shared links keep working).
  expect((await (await db()).collection('products').findOne({ _id: shorts.id })).slug).toBe('linen-play-shorts')
  // A stale editor (old version) is refused.
  expect((await admin.patch('/api/admin/products', { data: { id: shorts.id, version: shorts.version, price: 1 } })).status()).toBe(409)
})

test('archive hides from the shop but pending orders still work', async () => {
  const admin = await api({ admin: true })
  const p = (await (await admin.get('/api/admin/products')).json()).products.find((x) => x.id === 'KD-B-005')
  expect((await admin.patch('/api/admin/products', { data: { id: p.id, version: p.version, status: 'archived' } })).status()).toBe(200)
  const shop = await (await (await api()).get('/api/products')).json()
  expect(shop.products.map((x) => x.id)).not.toContain('KD-B-005')
  expect((await (await api()).get('/p/linen-play-shorts')).status()).toBe(404)
  // The order placed earlier for it can still be confirmed.
  const order = await (await db()).collection('orders').findOne({ 'items.productId': 'KD-B-005' })
  expect((await admin.patch('/api/admin/orders', { data: { id: order._id, status: 'confirmed' } })).status()).toBe(200)
})

test('upload signature is exactly what Cloudinary expects', async () => {
  const admin = await api({ admin: true })
  const r = await (await admin.post('/api/admin/upload-signature', { data: {} })).json()
  expect(r.uploadUrl).toBe('https://api.cloudinary.com/v1_1/kidsla-test/image/upload')
  const { signature, api_key, ...signed } = r.fields
  expect(api_key).toBe('123456789012345')
  const toSign = Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&')
  expect(signature).toBe(crypto.createHash('sha1').update(toSign + 'e2e-cloudinary-secret').digest('hex'))
  expect(signed).toMatchObject({ folder: 'kidsla/products', allowed_formats: 'jpg,png,webp' })
  expect(JSON.stringify(r)).not.toContain('e2e-cloudinary-secret') // the secret never leaves the server
  expect((await (await api()).post('/api/admin/upload-signature', { data: {} })).status()).toBe(401)
})

/** A real JPEG (made by the browser) with an EXIF block carrying a fake GPS marker. */
async function jpegWithSecretExif(page) {
  const b64 = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 800, height: 1000 })
    const g = c.getContext('2d')
    g.fillStyle = '#E8C4C0'
    g.fillRect(0, 0, 800, 1000)
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]
  })
  const jpeg = Buffer.from(b64, 'base64')
  const text = Buffer.from('SECRET-GPS-6.9271N-79.8612E\0')
  const tiff = Buffer.alloc(8 + 2 + 12 + 4)
  tiff.write('II', 0); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(1, 8) // one IFD entry: ImageDescription (0x010E), ASCII
  tiff.writeUInt16LE(0x010e, 10); tiff.writeUInt16LE(2, 12); tiff.writeUInt32LE(text.length, 14); tiff.writeUInt32LE(26, 18)
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), tiff, text])
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload])
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)])
}

test('admin UI: add a product with an uploaded photo (metadata stripped), then archive it', async ({ page }) => {
  await seed()
  await page.route('https://api.cloudinary.com/v1_1/kidsla-test/image/upload', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ secure_url: OWN_CLOUD }) }),
  )
  // Keep a copy of exactly what the browser uploads (Playwright can't read multipart file bodies).
  await page.addInitScript(() => {
    const send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.send = function (body) {
      if (body instanceof FormData) window.__upload = { fields: Object.fromEntries([...body].filter(([, v]) => typeof v === 'string')), file: body.get('file') }
      return send.call(this, body)
    }
  })
  await page.goto('/admin')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Add product' }).click()
  const editor = page.getByRole('dialog', { name: 'Add product' })

  await editor.getByRole('button', { name: 'Create product' }).click()
  await expect(editor.getByText('Please fix the highlighted fields.')).toBeVisible()
  await expect(editor.getByText('Add at least one photo')).toBeVisible()

  await editor.getByLabel('Title').fill('Rainbow Knit Beanie')
  await expect(editor.getByLabel('Link name')).toHaveValue('rainbow-knit-beanie')
  await editor.getByLabel('Description').fill('A soft knit beanie for cool hill-country mornings.')
  await editor.getByLabel('Price (LKR)').fill('1650')
  await editor.getByLabel('Stock 1-2Y').fill('3')
  await editor.getByLabel('Colour 1 name').fill('Blush')
  await editor.getByLabel('Upload photos').setInputFiles({ name: 'beanie.jpg', mimeType: 'image/jpeg', buffer: await jpegWithSecretExif(page) })
  await expect(editor.getByText('Cover', { exact: true })).toBeVisible()
  const sent = await page.evaluate(async () => {
    const bytes = new Uint8Array(await window.__upload.file.arrayBuffer())
    let latin1 = ''
    for (const b of bytes) latin1 += String.fromCharCode(b)
    return { fields: window.__upload.fields, name: window.__upload.file.name, type: window.__upload.file.type, latin1 }
  })
  expect(sent.fields).toMatchObject({ folder: 'kidsla/products', api_key: '123456789012345', signature: expect.stringMatching(/^[0-9a-f]{40}$/) })
  expect(sent).toMatchObject({ name: 'beanie.jpg', type: 'image/jpeg' })
  expect(sent.latin1.startsWith('\xff\xd8')).toBe(true) // still a JPEG
  expect(sent.latin1).not.toContain('Exif') // all metadata removed…
  expect(sent.latin1).not.toContain('SECRET-GPS') // …including the location

  await editor.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByText(/Created Rainbow Knit Beanie \(KD-G-005\)/)).toBeVisible()
  await expect(page.getByRole('row', { name: /Rainbow Knit Beanie/ })).toContainText('Hidden') // safe default

  await page.getByRole('button', { name: 'Details Rainbow Knit Beanie' }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByRole('row', { name: /Rainbow Knit Beanie/ })).toHaveCount(0)
  await page.getByRole('button', { name: /Archived \(1\)/ }).click()
  await expect(page.getByRole('row', { name: /Rainbow Knit Beanie/ })).toContainText('Archived')
})
