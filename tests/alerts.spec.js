// Owner alerts by email (Resend API, mocked in tests/global-setup.js).
import { api, clearEmails, emails, expect, placeOrder, seed, test } from './helpers.js'
import { TEST_ENV } from '../playwright.config.js'

test.describe.configure({ mode: 'serial' })

test('a new order emails the owner, with customer text safely escaped', async () => {
  await seed()
  await clearEmails()
  const evil = { name: '<img src=x onerror=alert(1)>', address: '12 <b>Lake</b> Road, Kandy', district: 'Colombo', payment: 'bank' }
  const r = await placeOrder(await api(), [{ id: 'KD-G-001', size: '3-4Y', color: 'Oat', qty: 2 }], evil)
  const { orderId } = await r.json()
  await expect.poll(async () => (await emails()).length).toBe(1)
  const [mail] = await emails()
  expect(mail.auth).toBe('Bearer re_test_key')
  expect(mail.to).toEqual(['owner@example.com'])
  expect(mail.subject).toBe(`🛍️ New order ${orderId}: LKR 8,850`)
  expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  expect(mail.html).not.toContain('<img src=x')
  expect(mail.html).toContain('Bank transfer')
  expect(mail.html).toContain('http://localhost:4173/admin')
})

test('server-error emails are throttled to one per 10 minutes', async () => {
  await clearEmails()
  Object.assign(process.env, { ...TEST_ENV })
  const { alertServerError } = await import('../api/_lib/alerts.js')
  await Promise.all([alertServerError('POST /api/orders', new Error('boom 1')), alertServerError('POST /api/orders', new Error('boom 2'))])
  await alertServerError('GET /api/products', new Error('boom 3'))
  const sent = await emails()
  expect(sent).toHaveLength(1)
  expect(sent[0].subject).toBe('⚠️ KIDSLA: server error')
  expect(sent[0].html).toMatch(/boom [12]/)
})

test('alerts are skipped (not crashing) when email is not configured', async () => {
  const saved = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY
  const { alertNewOrder } = await import('../api/_lib/alerts.js')
  await expect(
    alertNewOrder({ orderId: 'KD-0000-001', customer: { name: 'x', address: 'y', district: 'Kandy', payment: 'cod' }, items: [], deliveryFee: 0, total: 0 }),
  ).resolves.toEqual({ skipped: true })
  process.env.RESEND_API_KEY = saved
})
