import { test as base, expect, request as pwRequest } from '@playwright/test'
import { MongoClient } from 'mongodb'
import zlib from 'node:zlib'
import { TEST_ENV } from '../playwright.config.js'

export { expect }
export const BASE = 'http://localhost:4173'
export const PASSWORD = TEST_ENV.ADMIN_PASSWORD

// Pages never hit third-party hosts during tests (fast + deterministic).
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.route(/unsplash|googleapis|gstatic|facebook|wa\.me/, (r) =>
      r.request().url().includes('wa.me') ? r.fulfill({ body: 'whatsapp' }) : r.abort(),
    )
    await provide(context)
  },
})

let client
export async function db() {
  client ??= await new MongoClient(TEST_ENV.MONGODB_URI).connect()
  return client.db(TEST_ENV.MONGODB_DB)
}
export async function resetDb() {
  const d = await db()
  for (const c of await d.listCollections().toArray()) await d.collection(c.name).deleteMany({})
}
export const product = async (id) => (await db()).collection('products').findOne({ _id: id })

let ipCounter = 0
/** A fresh fake client IP, so per-IP rate limits don't interfere between tests. */
export const freshIp = () => `10.${Math.floor(Math.random() * 200)}.${++ipCounter % 250}.${Math.floor(Math.random() * 250)}`

/** API client that behaves like our own site (Origin header), optionally signed in. */
export async function api({ admin = false, ip = freshIp() } = {}) {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE, 'x-forwarded-for': ip } })
  if (admin) {
    const r = await ctx.post('/api/login', { data: { password: PASSWORD } })
    expect(r.status(), 'admin login').toBe(200)
  }
  return ctx
}

export async function seed() {
  await resetDb()
  const a = await api({ admin: true })
  expect((await a.post('/api/admin/seed', { data: {} })).status()).toBe(201)
  return a
}

export const customer = (name = 'Test Parent') => ({ name, address: '12 Lake Road, Kandy', district: 'Kandy', payment: 'cod' })

export const placeOrder = async (ctx, items, cust = customer()) => ctx.post('/api/orders', { data: { customer: cust, items } })

export async function setStock(id, size, n) {
  await (await db()).collection('products').updateOne({ _id: id }, { $set: { [`stock.${size}`]: n }, $inc: { version: 1 } })
}

/** Emails captured by the mock Resend server. */
export const emails = async () => (await fetch('http://127.0.0.1:4999/emails')).json()
export const clearEmails = () => fetch('http://127.0.0.1:4999/emails', { method: 'DELETE' })

/** Build a minimal .xlsx-shaped zip. `lie` forges the size headers to claim 1 KB per entry. */
export function zipOf(files, { lie = false } = {}) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content)
    const comp = zlib.deflateRawSync(data, { level: 9 })
    const n = Buffer.from(name)
    const size = lie ? 1024 : data.length
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8)
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(n.length, 26)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10)
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(size, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42)
    locals.push(lh, n, comp)
    centrals.push(ch, n)
    offset += lh.length + n.length + comp.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, end])
}
