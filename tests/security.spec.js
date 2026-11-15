// Sessions, login rate limiting, CSRF/origin checks, upload hardening.
import ExcelJS from 'exceljs'
import { request as pwRequest } from '@playwright/test'
import { BASE, PASSWORD, api, db, expect, freshIp, seed, test, zipOf } from './helpers.js'
import { TEST_ENV } from '../playwright.config.js'

test.describe.configure({ mode: 'serial' })

const cookieOf = async (ctx) => (await ctx.storageState()).cookies.find((c) => c.name === 'kidsla_admin')?.value
const sessionWith = async (token) => {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `kidsla_admin=${token}` } })
  return (await (await ctx.get('/api/session')).json()).authenticated
}

test('sessions live on the server: logout kills a copied cookie', async () => {
  await seed()
  const a = await api({ admin: true })
  const token = await cookieOf(a)
  expect(await sessionWith(token)).toBe(true)
  const stored = await (await db()).collection('sessions').findOne({})
  expect(stored._id).toMatch(/^[0-9a-f]{64}$/) // only a hash is stored
  expect(stored._id).not.toBe(token)
  expect((await a.post('/api/logout', { data: {} })).status()).toBe(200)
  expect(await sessionWith(token)).toBe(false) // stolen copy is now useless
})

test('"sign out all devices" ends every session', async () => {
  const a = await api({ admin: true })
  const b = await api({ admin: true })
  const tb = await cookieOf(b)
  const r = await a.post('/api/logout', { data: { all: true } })
  expect((await r.json()).ended).toBeGreaterThanOrEqual(2)
  expect(await sessionWith(tb)).toBe(false)
  expect((await (await a.get('/api/admin/products')).status())).toBe(401)
})

test('changing ADMIN_PASSWORD revokes existing sessions', async () => {
  Object.assign(process.env, { MONGODB_URI: TEST_ENV.MONGODB_URI, MONGODB_DB: TEST_ENV.MONGODB_DB, ADMIN_PASSWORD: 'old-Passw0rd-123', ADMIN_SESSION_SECRET: 's'.repeat(64) })
  const auth = await import('../api/_lib/auth.js')
  const req = { headers: { 'user-agent': 'test', host: 'localhost' } }
  const token = await auth.createSession(req)
  const withCookie = { headers: { cookie: `kidsla_admin=${token}` } }
  expect(await auth.isAuthenticated(withCookie)).toBe(true)
  process.env.ADMIN_PASSWORD = 'new-Passw0rd-456'
  expect(await auth.isAuthenticated(withCookie)).toBe(false)
})

test('login: 5 wrong passwords per IP → locked; other IPs unaffected; correct password still works elsewhere', async () => {
  const ip = freshIp()
  const attacker = await api({ ip })
  for (let i = 0; i < 5; i++) expect((await attacker.post('/api/login', { data: { password: `guess-${i}` } })).status()).toBe(401)
  const locked = await attacker.post('/api/login', { data: { password: PASSWORD } })
  expect(locked.status()).toBe(429) // even the right password: this IP must wait
  expect((await locked.json()).error).toMatch(/Try again in/)
  // Lockout is shared by all server instances (stored in MongoDB):
  expect(await (await db()).collection('ratelimits').countDocuments({ _id: /^loginFailIp:/ })).toBeGreaterThan(0)
  const owner = await api({ ip: freshIp() })
  expect((await owner.post('/api/login', { data: { password: PASSWORD } })).status()).toBe(200)
})

test('writes must be same-origin JSON (CSRF)', async () => {
  const a = await api({ admin: true })
  const foreign = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: 'https://evil.example', cookie: `kidsla_admin=${await cookieOf(a)}` } })
  expect((await foreign.patch('/api/admin/products', { data: { id: 'KD-G-001', version: 0, price: 1 } })).status()).toBe(403)
  const noOrigin = await pwRequest.newContext({ baseURL: BASE })
  expect((await noOrigin.post('/api/orders', { data: {} })).status()).toBe(403)
  expect((await a.post('/api/orders', { headers: { 'content-type': 'text/plain' }, data: '{}' })).status()).toBe(415)
  expect((await a.post('/api/logout', { headers: { 'sec-fetch-site': 'same-site' }, data: {} })).status()).toBe(403)
  for (const path of ['/api/admin/products', '/api/admin/orders', '/api/admin/export'])
    expect((await (await api()).get(path)).status()).toBe(401)
})

const xlsxParts = (sheetXml) => ({
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
  'xl/worksheets/sheet1.xml': sheetXml,
})

test('zip bombs are rejected instantly, including ones with forged size headers', async () => {
  const a = await api({ admin: true })
  const bomb = `<worksheet><sheetData><row><c><is><t>${'A'.repeat(200_000_000)}</t></is></c></row></sheetData></worksheet>`
  for (const lie of [false, true]) {
    const file = zipOf(xlsxParts(bomb), { lie })
    expect(file.length).toBeLessThan(2_000_000)
    const t = Date.now()
    const r = await a.post('/api/admin/import?dryRun=1&filename=bomb.xlsx', { headers: { 'content-type': 'application/octet-stream' }, data: file })
    expect(r.status()).toBe(400)
    expect((await r.json()).error).toMatch(/too large once unpacked/)
    expect(Date.now() - t).toBeLessThan(2000)
  }
})

test('stale spreadsheet rows are skipped, fresh ones apply', async () => {
  const a = await seed()
  const exported = await (await a.get('/api/admin/export?format=xlsx')).body()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(exported)
  const ws = wb.worksheets[0]
  const head = ws.getRow(1).values
  ws.eachRow((row, n) => {
    if (n === 1) return
    const id = row.getCell(head.indexOf('id')).value
    if (id === 'KD-G-001') row.getCell(head.indexOf('stock_1-2Y')).value = 99
    if (id === 'KD-G-004') row.getCell(head.indexOf('price')).value = 2999
  })
  const file = Buffer.from(await wb.xlsx.writeBuffer())
  // A sale happens after the export:
  await (await db()).collection('products').updateOne({ _id: 'KD-G-001' }, { $inc: { 'stock.1-2Y': -1, version: 1 } })
  const r = await (await a.post('/api/admin/import?filename=s.xlsx', { headers: { 'content-type': 'application/octet-stream' }, data: file })).json()
  expect(r.modified).toBe(1)
  expect(r.errors.join(' ')).toMatch(/KD-G-001.*changed after you exported/)
  expect((await (await db()).collection('products').findOne({ _id: 'KD-G-001' })).stock['1-2Y']).toBe(5)
})
