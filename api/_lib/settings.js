// Shop settings stored in MongoDB (one document), edited in /admin → Settings.
// The server ALWAYS prices orders from these, never from what the browser sends.
import { getDb, isDbConfigured } from './db.js'
import { DEFAULT_SETTINGS } from '../../src/data/site.js'
import { settingsSchema } from '../../shared/settingsSchema.js'

let cache = null // { at, value } per server instance, 15 s

const merge = (doc) => ({
  ...DEFAULT_SETTINGS,
  ...doc,
  deliveryFees: { ...DEFAULT_SETTINGS.deliveryFees, ...doc?.deliveryFees },
  payments: { ...DEFAULT_SETTINGS.payments, ...doc?.payments },
})

export async function getSettings({ fresh = false } = {}) {
  if (!isDbConfigured()) return { ...merge({}), version: 0 }
  if (!fresh && cache && Date.now() - cache.at < 15_000) return cache.value
  const doc = await (await getDb()).collection('settings').findOne({ _id: 'shop' })
  const { _id, updatedAt: _u, ...rest } = doc ?? {}
  const value = { ...merge(rest), version: doc?.version ?? 0 }
  cache = { at: Date.now(), value }
  return value
}

/** Version-checked save. Returns { settings } or { conflict: latest } or { errors }. */
export async function saveSettings(patch, version) {
  const current = await getSettings({ fresh: true })
  if (version !== current.version) return { conflict: current }
  const { version: _v, ...base } = current
  const parsed = settingsSchema.safeParse({
    ...base,
    ...patch,
    deliveryFees: { ...base.deliveryFees, ...patch.deliveryFees },
    payments: { ...base.payments, ...patch.payments },
  })
  if (!parsed.success) return { errors: parsed.error }
  const db = await getDb()
  const r = await db.collection('settings').updateOne(
    { _id: 'shop', ...(version === 0 ? { $or: [{ version: 0 }, { version: { $exists: false } }] } : { version }) },
    { $set: { ...parsed.data, updatedAt: new Date() }, $inc: { version: 1 } },
    { upsert: version === 0 },
  ).catch((err) => (err?.code === 11000 ? { matchedCount: 0, upsertedCount: 0 } : Promise.reject(err)))
  cache = null
  if (!r.matchedCount && !r.upsertedCount) return { conflict: await getSettings({ fresh: true }) }
  return { settings: await getSettings({ fresh: true }), before: base, after: parsed.data }
}

/** What customers may see (no internal fields). `onlineReady` = PayHere keys are configured. */
export const publicSettings = (s, onlineReady) => ({
  deliveryFees: s.deliveryFees,
  freeDeliveryOver: s.freeDeliveryOver,
  payments: { cod: s.payments.cod, bank: s.payments.bank, online: s.payments.online && onlineReady },
  bankDetails: s.payments.bank ? s.bankDetails : '',
  holdHours: s.holdHours,
  onlineHoldMinutes: s.onlineHoldMinutes,
})
