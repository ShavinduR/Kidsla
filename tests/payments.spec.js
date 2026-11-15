// Phase 3: PayHere online payments. The tests play PayHere: they sign notifications with the
// sandbox secret exactly as PayHere does and post them to /api/payhere/notify.
import crypto from 'node:crypto'
import { request as pwRequest } from '@playwright/test'
import { BASE, api, clearEmails, customer, db, emails, expect, placeOrder, product, seed, setStock, test } from './helpers.js'

test.describe.configure({ mode: 'serial' })

const SECRET = 'e2e-payhere-secret'
const MERCHANT = '1211149'
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase()
const TEE = { id: 'KD-B-001', size: '1-2Y', color: 'Sage' }
const onlineCustomer = (extra = {}) => customer('Kavindi Silva', { payment: 'online', email: 'kavindi@example.com', ...extra })

/** POST a notification like PayHere's server does (form-encoded, no Origin header). */
async function notify(orderId, amount, status_code, { paymentId = `32000${Math.floor(Math.random() * 1e6)}`, sig, merchant = MERCHANT } = {}) {
  const f = { merchant_id: merchant, order_id: orderId, payment_id: paymentId, payhere_amount: amount, payhere_currency: 'LKR', status_code: String(status_code), method: 'VISA', status_message: 'Test', card_no: '************1292' }
  f.md5sig = sig ?? md5(`${f.merchant_id}${f.order_id}${f.payhere_amount}${f.payhere_currency}${f.status_code}${md5(SECRET)}`)
  const ctx = await pwRequest.newContext({ baseURL: BASE })
  const r = await ctx.post('/api/payhere/notify', { form: f })
  return { status: r.status(), body: await r.json(), paymentId }
}
const order = async (id) => (await db()).collection('orders').findOne({ _id: id })

test('online checkout: needs email, holds stock for 60 min, returns a correctly signed PayHere request', async () => {
  await seed()
  await clearEmails()
  await setStock(TEE.id, TEE.size, 2)
  const c = await api()
  const noEmail = await placeOrder(c, [{ ...TEE, qty: 1 }], onlineCustomer({ email: '' }))
  expect((await noEmail.json()).field).toBe('email')

  const r = await placeOrder(c, [{ ...TEE, qty: 1 }], onlineCustomer())
  expect(r.status()).toBe(201)
  const body = await r.json()
  expect(body.holdMinutes).toBe(60)
  const { action, fields } = body.payhere
  expect(action).toBe('https://sandbox.payhere.lk/pay/checkout')
  expect(fields).toMatchObject({ merchant_id: MERCHANT, order_id: body.orderId, currency: 'LKR', amount: '2350.00', email: 'kavindi@example.com', phone: '+94771234567', first_name: 'Kavindi', last_name: 'Silva', notify_url: 'http://localhost:4173/api/payhere/notify' })
  expect(fields.hash).toBe(md5(`${MERCHANT}${body.orderId}2350.00LKR${md5(SECRET)}`))
  expect(JSON.stringify(body)).not.toContain(SECRET)
  const o = await order(body.orderId)
  expect(o.payment).toEqual({ method: 'online', status: 'awaiting' })
  expect(o.expiresAt.getTime() - o.createdAt.getTime()).toBe(60 * 60_000)
  expect((await product(TEE.id)).stock[TEE.size]).toBe(1)
  expect(await emails()).toHaveLength(0) // owner is emailed when the payment arrives, not before
})

test('only correctly signed notifications count; paid = confirmed; duplicates are ignored', async () => {
  await clearEmails()
  const id = (await (await db()).collection('orders').findOne({ 'payment.method': 'online' }))._id
  const forged = await notify(id, '2350.00', 2, { sig: 'A'.repeat(32) })
  expect(forged.status).toBe(400)
  expect((await notify(id, '2350.00', 2, { merchant: '999' })).status).toBe(400)
  expect((await order(id)).payment.status).toBe('awaiting')
  expect(await (await db()).collection('audit_log').countDocuments({ action: 'payment.bad_signature' })).toBeGreaterThan(0)

  const paid = await notify(id, '2350.00', 2, { paymentId: '320025071278' })
  expect(paid.body.outcome).toBe('paid')
  const o = await order(id)
  expect(o).toMatchObject({ status: 'confirmed', stockHeld: false, payment: { status: 'paid', paymentId: '320025071278', via: 'VISA' } })
  expect(o.expiresAt).toBeUndefined()
  const p = await product(TEE.id)
  expect(p.stock[TEE.size]).toBe(1)
  expect(p.reserved[TEE.size]).toBe(0)
  expect(JSON.stringify(await (await db()).collection('payments').findOne({}))).not.toContain('1292') // no card data stored

  expect((await notify(id, '2350.00', 2, { paymentId: '320025071278' })).body.duplicate).toBe(true)
  // A late "failed" can't undo a successful payment.
  expect((await notify(id, '2350.00', -2, { paymentId: '320025071278' })).body.outcome).toBe('ignored')
  await expect.poll(async () => (await emails()).map((e) => e.subject)).toEqual([expect.stringMatching(/^💳 Paid order KD-\d{4}-\d{3}: LKR 2,350$/)])
})

test('wrong amount is never marked paid', async () => {
  await setStock(TEE.id, TEE.size, 5)
  const { orderId } = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }], onlineCustomer())).json()
  const r = await notify(orderId, '1.00', 2)
  expect(r.body.amountMismatch).toBe(true)
  const o = await order(orderId)
  expect(o.payment.status).toBe('awaiting')
  expect(o.needsAttention).toMatch(/amount mismatch/)
})

test('payment after the 60-minute hold: re-takes stock if available, else flags for refund', async () => {
  const admin = await api({ admin: true })
  await setStock(TEE.id, TEE.size, 1)
  const late = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }], onlineCustomer())).json()
  await (await db()).collection('orders').updateOne({ _id: late.orderId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  await admin.get('/api/admin/orders') // runs expiry
  expect((await order(late.orderId)).status).toBe('expired')
  expect((await product(TEE.id)).stock[TEE.size]).toBe(1)
  expect((await notify(late.orderId, '2350.00', 2)).body.outcome).toBe('paid')
  expect((await order(late.orderId)).status).toBe('confirmed')
  expect((await product(TEE.id)).stock[TEE.size]).toBe(0)

  await clearEmails()
  await setStock(TEE.id, TEE.size, 1)
  const soldOut = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }], onlineCustomer())).json()
  await (await db()).collection('orders').updateOne({ _id: soldOut.orderId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  await admin.get('/api/admin/orders')
  await setStock(TEE.id, TEE.size, 0) // someone else bought it meanwhile
  expect((await notify(soldOut.orderId, '2350.00', 2)).body.outcome).toBe('paid-needs-attention')
  const o = await order(soldOut.orderId)
  expect(o).toMatchObject({ status: 'expired', payment: { status: 'paid' } })
  expect(o.needsAttention).toMatch(/refund in PayHere/)
  await expect.poll(async () => (await emails()).some((e) => e.subject.includes('payment needs attention'))).toBe(true)
})

test('cancel → retry → paid; chargeback is flagged', async () => {
  await setStock(TEE.id, TEE.size, 3)
  const { orderId, accessToken } = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }], onlineCustomer())).json()
  expect((await notify(orderId, '2350.00', -1)).body.outcome).toBe('status-updated')
  expect((await order(orderId)).payment.status).toBe('cancelled')
  const c = await api()
  expect((await c.post('/api/orders/pay', { data: { id: orderId, t: 'wrong-token-xxxxxxxxxxxxxxx' } })).status()).toBe(404)
  const again = await (await c.post('/api/orders/pay', { data: { id: orderId, t: accessToken } })).json()
  expect(again.payhere.fields.order_id).toBe(orderId)
  expect((await notify(orderId, '2350.00', 2)).body.outcome).toBe('paid')
  expect((await c.post('/api/orders/pay', { data: { id: orderId, t: accessToken } })).status()).toBe(409)
  expect((await notify(orderId, '2350.00', -3)).body.outcome).toBe('status-updated')
  expect((await order(orderId)).needsAttention).toMatch(/Chargeback/)
})

test('order status page API needs the private token and reveals no personal data', async () => {
  const { orderId, accessToken } = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }], onlineCustomer())).json()
  const c = await api()
  expect((await c.get(`/api/orders/status?id=${orderId}&t=nope-nope-nope-nope-nope`)).status()).toBe(404)
  const s = await (await c.get(`/api/orders/status?id=${orderId}&t=${accessToken}`)).json()
  expect(s).toMatchObject({ id: orderId, status: 'pending', payment: { method: 'online', status: 'awaiting' }, total: 2350 })
  expect(JSON.stringify(s)).not.toMatch(/Kavindi|kavindi@|Lake Road|\+9477/)
})

test('browser: pay online → PayHere → back to a confirmed order', async ({ page }) => {
  await setStock(TEE.id, TEE.size, 5)
  const posts = []
  await page.route('https://sandbox.payhere.lk/pay/checkout', (route) => {
    posts.push(Object.fromEntries(new URLSearchParams(route.request().postData())))
    route.fulfill({ contentType: 'text/html', body: '<h1>PayHere sandbox (test)</h1>' })
  })
  await page.goto('/p/essential-crew-tee')
  await page.getByRole('button', { name: /1-2Y/ }).click()
  await page.getByRole('button', { name: /^Add/ }).click()
  await page.locator('#co-name').fill('Kavindi Silva')
  await page.locator('#co-phone').fill('0771234567')
  await page.locator('#co-address').fill('45 Temple Road, Galle')
  await page.locator('#co-district').selectOption('Galle')
  await page.getByText('Pay Online', { exact: true }).click()
  await page.getByRole('button', { name: /Pay LKR 2,350 securely/ }).click()
  await expect(page.getByText('Needed for your payment receipt')).toBeVisible()
  await page.locator('#co-email').fill('kavindi@example.com')
  await page.getByRole('button', { name: /Pay LKR 2,350 securely/ }).click()
  await expect(page.getByRole('heading', { name: 'PayHere sandbox (test)' })).toBeVisible()
  const f = posts[0]
  expect(f.hash).toBe(md5(`${MERCHANT}${f.order_id}${f.amount}LKR${md5(SECRET)}`))
  expect(f).toMatchObject({ amount: '2350.00', city: 'Galle', email: 'kavindi@example.com' })

  // Customer cancels on PayHere → comes back → tries again.
  await page.goto(f.cancel_url)
  await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible()
  await page.getByRole('button', { name: 'Try paying again' }).click()
  await expect(page.getByRole('heading', { name: 'PayHere sandbox (test)' })).toBeVisible()
  expect(posts).toHaveLength(2)

  // Pays; PayHere notifies our server, then sends the customer to the return URL.
  await notify(f.order_id, f.amount, 2)
  await page.goto(f.return_url)
  await expect(page.getByRole('heading', { name: 'Payment received. Thank you!' })).toBeVisible()
  await expect(page.getByText(f.order_id)).toBeVisible()
})

test('return page waits for PayHere’s confirmation (no fake “paid” from the URL)', async ({ page }) => {
  const { orderId, accessToken } = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }], onlineCustomer())).json()
  await page.goto(`/order/${orderId}?t=${accessToken}`)
  await expect(page.getByRole('heading', { name: 'Confirming your payment…' })).toBeVisible()
  await notify(orderId, '2350.00', 2) // arrives a moment later
  await expect(page.getByRole('heading', { name: 'Payment received. Thank you!' })).toBeVisible({ timeout: 10_000 })
})
