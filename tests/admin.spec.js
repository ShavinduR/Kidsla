// Admin dashboard in a real browser.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { api, db, expect, PASSWORD, placeOrder, resetDb, test } from './helpers.js'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1300, height: 900 } })

const signIn = async (page, password = PASSWORD) => {
  await page.goto('/admin')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.beforeAll(resetDb)

test('sign in, first-run seeding, logout', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
  await signIn(page, 'wrong-password')
  await expect(page.getByText('Incorrect password')).toBeVisible()
  await signIn(page)
  await expect(page.getByText('Your database is connected and empty')).toBeVisible()
  await page.getByRole('button', { name: 'Load starter catalogue' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(14)
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
})

test('edit dialog: conflict when stock moved meanwhile, then saves', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Edit Everyday Pleated Skirt' }).click()
  await (await db()).collection('products').updateOne({ _id: 'KD-G-004' }, { $inc: { 'stock.3-4Y': -2, version: 1 } })
  await page.getByLabel('Price (LKR)').fill('2800')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Updated meanwhile.')).toBeVisible()
  await expect(page.getByLabel('Stock 3-4Y')).toHaveValue('6')
  await page.getByLabel('Price (LKR)').fill('2800')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/Saved: price 2750 → 2800/)).toBeVisible()
})

test('orders: new order appears with hold time, badge updates, confirm', async ({ page }) => {
  await signIn(page)
  await placeOrder(await api(), [{ id: 'KD-B-001', size: '3-4Y', color: 'Sage', qty: 2 }])
  await page.reload()
  await expect(page.getByRole('button', { name: /^Orders/ })).toContainText('1')
  await expect(page).toHaveTitle('(1) Admin · KIDSLA')
  await page.getByRole('button', { name: /^Orders/ }).click()
  await expect(page.getByText(/Held until/)).toBeVisible()
  await page.getByRole('button', { name: 'Inventory' }).click()
  await expect(page.getByRole('row', { name: /Essential Crew Tee/ })).toContainText('+2 held')
  await page.getByRole('button', { name: /^Orders/ }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText(/confirmed: stock updated/)).toBeVisible()
  await expect(page).toHaveTitle('Admin · KIDSLA')
})

test('expired orders show up under Expired', async ({ page }) => {
  const { orderId } = await (await placeOrder(await api(), [{ id: 'KD-G-001', size: '1-2Y', color: 'Oat', qty: 1 }])).json()
  await (await db()).collection('orders').updateOne({ _id: orderId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  await signIn(page)
  await page.getByRole('button', { name: /^Orders/ }).click()
  await page.getByRole('button', { name: /^Expired/ }).click()
  await expect(page.getByText(orderId)).toBeVisible()
  await expect(page.getByText(/Hold ended/)).toBeVisible()
})

test('export → edit in Excel → import with review', async ({ page }) => {
  await signIn(page)
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Export to Excel' }).click()
  const file = await (await download).path()
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.worksheets[0]
  const head = ws.getRow(1).values
  expect(head).toEqual(expect.arrayContaining(['version', 'stock_1-2Y', 'held_1-2Y']))
  ws.eachRow((r, n) => n > 1 && r.getCell(head.indexOf('id')).value === 'KD-E-002' && (r.getCell(head.indexOf('price')).value = 1999))
  // Plain ASCII temp path: Chromium's file upload ignores paths with characters like "→" (from the test title).
  const edited = join(tmpdir(), `kidsla-edited-${Date.now()}.xlsx`)
  await wb.xlsx.writeFile(edited)
  await page.locator('input[type=file]').setInputFiles(edited)
  await expect(page.getByText('price 1850 → 1999')).toBeVisible()
  await page.getByRole('button', { name: 'Apply 1 update' }).click()
  await expect(page.getByText('Updated 1 product.')).toBeVisible()
})

test('sign out all devices', async ({ page, browser }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()
  const other = await (await browser.newContext()).newPage()
  await signIn(other)
  await expect(other.getByRole('heading', { name: 'Inventory' })).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /All devices/ }).click()
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
  await other.getByRole('button', { name: 'Refresh' }).click()
  await expect(other.getByText('Your session ended. Please sign in again.')).toBeVisible()
})
