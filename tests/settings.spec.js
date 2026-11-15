// Phase 3: shop settings (server-enforced), activity log, migrations.
import { BASE, PASSWORD, api, customer, db, expect, placeOrder, seed, setStock, test } from './helpers.js'

test.describe.configure({ mode: 'serial' })
const TEE = { id: 'KD-B-001', size: '3-4Y', color: 'Sage' }

// Put the defaults back (and refresh the server's settings cache) so other test files aren't affected.
test.afterAll(async () => {
  const admin = await api({ admin: true })
  const { settings } = await (await admin.get('/api/admin/settings')).json()
  const r = await admin.patch('/api/admin/settings', {
    data: { version: settings.version, deliveryFees: { colombo: 350, outstation: 400 }, freeDeliveryOver: 0, payments: { cod: true, bank: true, online: true }, bankDetails: '', holdHours: 24, onlineHoldMinutes: 60 },
  })
  expect(r.ok()).toBe(true)
})

test('settings: version-checked, validated, and used by the SERVER to price orders', async () => {
  const admin = await seed()
  const { settings, payhere } = await (await admin.get('/api/admin/settings')).json()
  expect(payhere).toEqual({ configured: true, mode: 'sandbox', merchantId: '1211149' })
  expect(settings.deliveryFees).toEqual({ colombo: 350, outstation: 400 })

  const bad = await admin.patch('/api/admin/settings', { data: { version: settings.version, deliveryFees: { colombo: -1 }, payments: { cod: false, bank: false, online: false } } })
  expect((await bad.json()).fields).toMatchObject({ deliveryFees: expect.stringMatching(/negative/), payments: expect.stringMatching(/at least one/) })

  const ok = await admin.patch('/api/admin/settings', { data: { version: settings.version, deliveryFees: { colombo: 300, outstation: 450 }, freeDeliveryOver: 5000, payments: { cod: false, bank: true, online: true }, bankDetails: 'Commercial Bank\nKIDSLA (Pvt) Ltd\n1234567890' } })
  expect(ok.status()).toBe(200)
  expect((await ok.json()).changed).toEqual(['deliveryFees', 'freeDeliveryOver', 'payments', 'bankDetails'])
  expect((await admin.patch('/api/admin/settings', { data: { version: settings.version, holdHours: 12 } })).status()).toBe(409) // stale

  const pub = await (await (await api()).get('/api/settings')).json()
  expect(pub).toMatchObject({ deliveryFees: { colombo: 300, outstation: 450 }, payments: { cod: false, bank: true, online: true }, freeDeliveryOver: 5000 })
  expect(pub).not.toHaveProperty('version')

  await setStock(TEE.id, TEE.size, 10)
  const c = await api()
  expect((await (await placeOrder(c, [{ ...TEE, qty: 1 }], customer('Anne Perera', { payment: 'cod' }))).json()).field).toBe('payment') // COD switched off
  const one = await (await placeOrder(c, [{ ...TEE, qty: 1 }], customer('Bimal Perera', { payment: 'bank' }))).json()
  expect(one).toMatchObject({ deliveryFee: 450, total: 1950 + 450, bankDetails: expect.stringContaining('1234567890') })
  const three = await (await placeOrder(c, [{ ...TEE, qty: 3 }], customer('Chathu Perera', { payment: 'bank' }))).json()
  expect(three).toMatchObject({ subtotal: 5850, deliveryFee: 0, total: 5850 }) // free delivery over 5,000
})

test('shop follows the settings: methods, fees, free-delivery hint, bank details', async ({ page }) => {
  await page.goto('/p/essential-crew-tee')
  await page.getByRole('button', { name: /3-4Y/ }).click()
  await page.getByRole('button', { name: /^Add/ }).click()
  const cart = page.getByRole('dialog', { name: 'Shopping cart' })
  await expect(cart.getByText('Cash on Delivery')).toHaveCount(0)
  await expect(cart.getByText('Add LKR 3,050 more for free delivery')).toBeVisible()
  await expect(cart.locator('optgroup[label^="Outstation — LKR 450"]')).toHaveCount(1)
  await page.locator('#co-name').fill('Bank Customer')
  await page.locator('#co-phone').fill('0712345678')
  await page.locator('#co-address').fill('7 Hill Street, Kandy')
  await page.locator('#co-district').selectOption('Kandy')
  await page.getByRole('button', { name: 'Place Order via WhatsApp' }).click()
  await expect(page.getByText('Bank transfer details')).toBeVisible()
  await expect(page.getByText('1234567890')).toBeVisible()
})

test('admin Settings screen saves; Activity shows who did what', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByText(/PayHere connected: merchant 1211149/)).toBeVisible()
  await page.getByLabel('Cash on Delivery').check()
  await page.getByLabel('Colombo delivery fee').fill('325')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText(/Settings saved: deliveryFees, payments/)).toBeVisible()

  await page.getByRole('button', { name: 'Activity' }).click()
  await expect(page.getByText('Settings changed').first()).toBeVisible()
  await expect(page.getByText('Signed in').first()).toBeVisible()
  await expect(page.getByText('Starter catalogue loaded')).toBeVisible()
})

test('every admin change is in the audit log', async () => {
  const admin = await api({ admin: true })
  const p = (await (await admin.get('/api/admin/products')).json()).products.find((x) => x.id === 'KD-G-002')
  await admin.patch('/api/admin/products', { data: { id: p.id, version: p.version, price: 3990 } })
  const { orderId } = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }], customer('Dilan Perera', { payment: 'cod' }))).json()
  await admin.patch('/api/admin/orders', { data: { id: orderId, status: 'confirmed' } })
  const log = await (await db()).collection('audit_log').find({}).sort({ at: 1 }).toArray()
  const actions = log.map((e) => `${e.action}:${e.target ?? ''}`)
  expect(actions).toEqual(expect.arrayContaining(['catalogue.seed:', 'settings.update:shop', 'product.update:KD-G-002', `order.confirm:${orderId}`, 'admin.login:']))
  expect(log.find((e) => e.action === 'product.update').details.changed).toEqual(['price 3890 → 3990'])
  const history = await (await admin.get(`/api/admin/activity?target=${orderId}`)).json()
  expect(history.entries.map((e) => e.action)).toEqual(['order.confirm'])
})

test('migrations ran once and created the indexes', async () => {
  const d = await db()
  expect((await d.collection('_migrations').find().toArray()).map((m) => m._id).sort()).toEqual(['001-core-indexes', '002-product-versions', '003-product-slugs', '004-phase3-indexes'])
  const orderIdx = (await d.collection('orders').indexes()).map((i) => Object.keys(i.key).join('+'))
  expect(orderIdx).toEqual(expect.arrayContaining(['customer.phone+createdAt', 'payment.paymentId', 'status+expiresAt']))
  const audit = (await d.collection('audit_log').indexes()).find((i) => i.key.at === 1)
  expect(audit.expireAfterSeconds).toBe(365 * 24 * 3600)
  expect(BASE).toBeTruthy()
})
