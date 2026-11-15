// Customer journey on a phone: browse → choose → cart → WhatsApp checkout.
import { devices } from '@playwright/test'
import { api, db, expect, placeOrder, seed, setStock, test } from './helpers.js'

test.use({ ...devices['Pixel 7'] }) // Android Chrome: most Sri Lankan shoppers
test.describe.configure({ mode: 'serial' })

const waUrls = (page) => {
  const urls = []
  page.context().on('request', (r) => r.url().startsWith('https://wa.me/') && urls.push(decodeURIComponent(r.url())))
  return urls
}
const fillCheckout = async (page, district = 'Kandy') => {
  await page.locator('#co-name').fill('Nimali Perera')
  await page.locator('#co-phone').fill('077 123 4567')
  await page.locator('#co-address').fill('12 Lake Road, Nugegoda')
  await page.locator('#co-district').selectOption(district)
}

test.beforeAll(async () => {
  await seed()
})

test('coming-soon items cannot be ordered; Notify Me opens WhatsApp', async ({ page }) => {
  const urls = waUrls(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'View Wooden Stacking Rainbow' }).click()
  await expect(page.getByRole('button', { name: /^Add/ })).toHaveCount(0)
  await page.getByText('Notify Me on WhatsApp').click()
  await expect.poll(() => urls.some((u) => u.includes('Please notify me'))).toBe(true)
})

test('product modal: carousel, size guide, sold-out sizes, stock cap', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'View Petal Knit Cardigan' }).click()
  await expect(page.getByRole('button', { name: /Show photo/ })).toHaveCount(4)
  await expect(page.getByRole('button', { name: /3-4Y/ })).toBeDisabled()
  await page.getByRole('button', { name: /Size guide/ }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('button', { name: /^Add/ }).click()
  await expect(page.getByText('Please select a size')).toBeVisible()
  await page.getByRole('button', { name: /1-2Y/ }).click()
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Increase quantity' }).click()
  await expect(page.getByRole('button', { name: 'Add · LKR 19,450' })).toBeVisible() // capped at 5 in stock
})

test('checkout: order saved, stock held, WhatsApp message, cart cleared', async ({ page }) => {
  const urls = waUrls(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'View Essential Crew Tee' }).click()
  await page.getByRole('button', { name: /1-2Y/ }).click()
  await page.getByRole('button', { name: 'Increase quantity' }).click()
  await page.getByRole('button', { name: /^Add/ }).click()
  await page.getByRole('button', { name: 'Place Order via WhatsApp' }).click()
  await expect(page.getByText('Please choose your district')).toBeVisible()
  await fillCheckout(page, 'Colombo')
  await expect(page.getByRole('dialog', { name: 'Shopping cart' }).locator('dd').getByText('LKR 4,250', { exact: true })).toBeVisible() // 2 × 1,950 + 350
  await page.getByText('Bank Transfer', { exact: true }).click()
  await page.getByRole('button', { name: 'Place Order via WhatsApp' }).click()
  await expect(page.getByText('Thank you!')).toBeVisible()
  await expect(page.getByText(/holding your items for/)).toBeVisible()
  await expect.poll(() => urls.find((u) => u.includes('New KIDSLA Order'))).toBeTruthy()
  const msg = urls.find((u) => u.includes('New KIDSLA Order'))
  expect(msg).toContain('https://wa.me/94742327807')
  expect(msg).toMatch(/KD-\d{4}-\d{3}/)
  expect(msg).toContain('*Total: LKR 4,250*')
  expect(msg).toContain('Please send me the bank details')
  expect(await page.evaluate(() => localStorage.getItem('kidsla-cart-v2'))).toBe('[]')
  const order = await (await db()).collection('orders').findOne({}, { sort: { createdAt: -1 } })
  expect(order).toMatchObject({ status: 'pending', stockHeld: true, total: 4250 })
})

test('item sold out while in the cart → clear message, nothing sent', async ({ page }) => {
  const urls = waUrls(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'View Relaxed Jogger Pants' }).click()
  await page.getByRole('button', { name: /5-6Y/ }).click()
  await page.getByRole('button', { name: /^Add/ }).click()
  await fillCheckout(page)
  await setStock('KD-B-002', '5-6Y', 0) // someone else bought it meanwhile
  await page.getByRole('button', { name: 'Place Order via WhatsApp' }).click()
  await expect(page.getByText('Some items in your cart changed')).toBeVisible()
  await expect(page.getByText(/Relaxed Jogger Pants \(5-6Y\): (just )?sold out/)).toBeVisible()
  expect(urls.some((u) => u.includes('New KIDSLA Order'))).toBe(false)
})

test('server down → order still sent with a KDX- fallback ID', async ({ page }) => {
  const urls = waUrls(page)
  await page.route('**/api/orders', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }))
  await page.goto('/')
  await page.getByRole('link', { name: 'View Cloud Ruffle Dress' }).click()
  await page.getByRole('button', { name: /3-4Y/ }).click()
  await page.getByRole('button', { name: /^Add/ }).click()
  await fillCheckout(page)
  await page.getByRole('button', { name: 'Place Order via WhatsApp' }).click()
  await expect(page.getByText('Thank you!')).toBeVisible()
  await expect(page.getByText(/holding your items/)).toHaveCount(0) // no hold without the server
  await expect.poll(() => urls.find((u) => /KDX-\d{4}-[0-9A-F]{4}/.test(u))).toBeTruthy()
})

test('a crash shows a friendly page, not a white screen', async ({ page }) => {
  await page.route(/AdminGate-.*\.js/, (r) => r.abort())
  await page.goto('/admin')
  await expect(page.getByText('Oops, something went wrong.')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Order on WhatsApp instead' })).toBeVisible()
})

test('sanity: API order count matches what customers did', async () => {
  const c = await api()
  expect((await placeOrder(c, [{ id: 'KD-G-002', size: '1-2Y', color: 'Blush', qty: 1 }])).status()).toBe(201)
  expect(await (await db()).collection('orders').countDocuments({ status: 'pending' })).toBe(2)
})
