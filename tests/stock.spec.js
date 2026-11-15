// Stock holding, concurrency and the order lifecycle (audit H1 + H2).
import { api, customer, db, expect, freshIp, placeOrder, product, seed, setStock, test } from './helpers.js'

const TEE = { id: 'KD-B-001', size: '1-2Y', color: 'Sage' }

test.describe.configure({ mode: 'serial' })

test('20 customers buy the LAST unit at the same moment → exactly one order', async () => {
  await seed()
  await setStock(TEE.id, TEE.size, 1)
  const clients = await Promise.all(Array.from({ length: 20 }, () => api()))
  const results = await Promise.all(clients.map((c, i) => placeOrder(c, [{ ...TEE, qty: 1 }], customer(`Racer ${i}`))))
  const codes = results.map((r) => r.status()).sort()
  expect(codes.filter((c) => c === 201)).toHaveLength(1)
  expect(codes.filter((c) => c === 409)).toHaveLength(19)

  const loser = await results.find((r) => r.status() === 409).json()
  expect(loser.problems[0]).toMatchObject({ id: TEE.id, size: TEE.size, reason: 'just sold out' })

  const p = await product(TEE.id)
  expect(p.stock[TEE.size]).toBe(0) // available
  expect(p.reserved[TEE.size]).toBe(1) // held for the winner
  expect(await (await db()).collection('orders').countDocuments()).toBe(1)
  // Rolled-back attempts don't burn order numbers.
  const counter = await (await db()).collection('counters').findOne({})
  expect(counter.seq).toBe(1)
})

test('confirm a held order: stock stays sold, hold is cleared', async () => {
  const admin = await seed()
  await setStock(TEE.id, TEE.size, 3)
  const r = await placeOrder(await api(), [{ ...TEE, qty: 2 }])
  expect(r.status()).toBe(201)
  const { orderId, holdHours } = await r.json()
  expect(holdHours).toBe(24)
  expect((await product(TEE.id)).stock[TEE.size]).toBe(1)

  expect((await admin.patch('/api/admin/orders', { data: { id: orderId, status: 'confirmed' } })).status()).toBe(200)
  const p = await product(TEE.id)
  expect(p.stock[TEE.size]).toBe(1)
  expect(p.reserved[TEE.size]).toBe(0)
  // Double confirm is refused.
  expect((await admin.patch('/api/admin/orders', { data: { id: orderId, status: 'confirmed' } })).status()).toBe(409)
  // Cancelling a confirmed order returns the items.
  expect((await (await admin.patch('/api/admin/orders', { data: { id: orderId, status: 'cancelled' } })).json()).restocked).toBe(true)
  expect((await product(TEE.id)).stock[TEE.size]).toBe(3)
})

test('cancel a pending order releases its held stock', async () => {
  const admin = await seed()
  await setStock(TEE.id, TEE.size, 2)
  const { orderId } = await (await placeOrder(await api(), [{ ...TEE, qty: 2 }])).json()
  expect((await product(TEE.id)).stock[TEE.size]).toBe(0)
  await admin.patch('/api/admin/orders', { data: { id: orderId, status: 'cancelled' } })
  const p = await product(TEE.id)
  expect(p.stock[TEE.size]).toBe(2)
  expect(p.reserved[TEE.size]).toBe(0)
})

test('pending orders expire after the hold and give their stock back', async () => {
  const admin = await seed()
  await setStock(TEE.id, TEE.size, 1)
  const { orderId } = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }])).json()
  // The next customer is told it's sold out while it's held…
  expect((await placeOrder(await api(), [{ ...TEE, qty: 1 }])).status()).toBe(409)
  // …24 hours pass.
  await (await db()).collection('orders').updateOne({ _id: orderId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  // Expiry runs automatically at the next checkout, so this customer gets it.
  const second = await placeOrder(await api(), [{ ...TEE, qty: 1 }])
  expect(second.status()).toBe(201)
  expect((await (await db()).collection('orders').findOne({ _id: orderId })).status).toBe('expired')

  // Confirming the expired order now fails (no stock), with a clear message.
  const late = await admin.patch('/api/admin/orders', { data: { id: orderId, status: 'confirmed' } })
  expect(late.status()).toBe(409)
  expect((await late.json()).error).toMatch(/Not enough stock/)
})

test('an expired order can still be confirmed if stock allows', async () => {
  const admin = await seed()
  await setStock(TEE.id, TEE.size, 5)
  const { orderId } = await (await placeOrder(await api(), [{ ...TEE, qty: 2 }])).json()
  await (await db()).collection('orders').updateOne({ _id: orderId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  const list = await (await admin.get('/api/admin/orders?status=expired')).json() // admin view also runs expiry
  expect(list.orders.map((o) => o.id)).toContain(orderId)
  expect((await product(TEE.id)).stock[TEE.size]).toBe(5)
  expect((await admin.patch('/api/admin/orders', { data: { id: orderId, status: 'confirmed' } })).status()).toBe(200)
  expect((await product(TEE.id)).stock[TEE.size]).toBe(3)
})

test('daily cron requires its secret and releases expired holds', async ({ request }) => {
  await seed()
  await setStock(TEE.id, TEE.size, 1)
  const { orderId } = await (await placeOrder(await api(), [{ ...TEE, qty: 1 }])).json()
  await (await db()).collection('orders').updateOne({ _id: orderId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  expect((await request.get('/api/cron/expire-orders')).status()).toBe(401)
  expect((await request.get('/api/cron/expire-orders', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401)
  const ok = await request.get('/api/cron/expire-orders', { headers: { authorization: 'Bearer e2e-cron-secret' } })
  expect(await ok.json()).toEqual({ released: 1 })
  expect((await product(TEE.id)).stock[TEE.size]).toBe(1)
})

test('stale admin edit is refused after a checkout moved stock (H1)', async () => {
  const admin = await seed()
  const before = (await (await admin.get('/api/admin/products')).json()).products.find((p) => p.id === TEE.id)
  await placeOrder(await api(), [{ ...TEE, qty: 1 }]) // stock changes while the dialog is "open"
  const stale = await admin.patch('/api/admin/products', { data: { id: TEE.id, version: before.version, price: 2500 } })
  expect(stale.status()).toBe(409)
  const fresh = (await stale.json()).product
  expect((await admin.patch('/api/admin/products', { data: { id: TEE.id, version: fresh.version, price: 2500 } })).status()).toBe(200)
  expect((await product(TEE.id)).stock[TEE.size]).toBe(before.stock[TEE.size] - 1)
})

test('server prices win and bad input is rejected', async () => {
  await seed()
  const c = await api()
  const r = await placeOrder(c, [{ ...TEE, qty: 1, price: 1 }])
  expect((await r.json()).total).toBe(1950 + 400)
  expect((await placeOrder(c, [{ id: { $gt: '' }, size: '1-2Y', qty: 1 }])).status()).toBe(400)
  expect((await placeOrder(c, [{ id: 'KD-T-001', size: 'One Size', color: 'Earth Tones', qty: 1 }])).status()).toBe(409)
})

test('order rate limit: 10 per IP per 10 minutes, other IPs unaffected', async () => {
  await seed()
  await setStock(TEE.id, TEE.size, 100)
  const ip = freshIp()
  const same = await api({ ip })
  for (let i = 0; i < 10; i++) expect((await placeOrder(same, [{ ...TEE, qty: 1 }])).status()).toBe(201)
  const blocked = await placeOrder(same, [{ ...TEE, qty: 1 }])
  expect(blocked.status()).toBe(429)
  expect(blocked.headers()['retry-after']).toBeTruthy()
  expect((await placeOrder(await api(), [{ ...TEE, qty: 1 }])).status()).toBe(201)
})
