// The Content-Security-Policy in vercel.json, tested in ENFORCING mode before you switch it on.
// If you add a third-party service and this fails, add its domain to vercel.json first.
import fs from 'node:fs'
import { BASE, expect, PASSWORD, seed, test } from './helpers.js'

const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)))
const HEADERS = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]))
const CSP = HEADERS['Content-Security-Policy-Report-Only'] ?? HEADERS['Content-Security-Policy']

test.beforeEach(async ({ context }) => {
  await context.route((u) => u.href.startsWith(BASE), async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback()
    const resp = await route.fetch()
    await route.fulfill({ response: resp, headers: { ...resp.headers(), ...HEADERS, 'content-security-policy': CSP } })
  })
  await context.addInitScript(() => {
    window.__violations = []
    document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
})

test('shop + checkout + admin work under the enforced CSP', async ({ page }) => {
  await seed()
  await page.goto('/')
  await page.getByRole('link', { name: 'View Cloud Ruffle Dress' }).click()
  await page.getByRole('button', { name: /Size guide/ }).click()
  await page.getByRole('button', { name: /3-4Y/ }).click()
  await page.getByRole('button', { name: /^Add/ }).click()
  await page.locator('#co-name').fill('CSP Tester')
  await page.locator('#co-address').fill('12 Lake Road, Kandy')
  await page.locator('#co-district').selectOption('Kandy')
  await page.getByRole('button', { name: 'Place Order via WhatsApp' }).click()
  await expect(page.getByText('Thank you!')).toBeVisible()
  expect(await page.evaluate(() => window.__violations)).toEqual([])

  await page.goto('/admin')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Edit Cloud Ruffle Dress' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: /^Orders/ }).click()
  await expect(page.getByText(/Held until/)).toBeVisible()
  expect(await page.evaluate(() => window.__violations)).toEqual([])
})

test('injected inline scripts are blocked, and the site refuses to be framed', async ({ page }) => {
  await page.goto('/')
  const ran = await page.evaluate(
    () => new Promise((r) => { const s = document.createElement('script'); s.textContent = 'window.__pwned = 1'; document.body.append(s); setTimeout(() => r(!!window.__pwned), 100) }),
  )
  expect(ran).toBe(false)
  await page.setContent(`<iframe id="f" src="${BASE}/admin"></iframe>`)
  await page.waitForTimeout(800)
  const framed = await page.evaluate(() => { try { return !!document.getElementById('f').contentDocument?.body?.innerText } catch { return false } })
  expect(framed).toBe(false)
})
