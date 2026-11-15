// Activity log: who changed what, and when (admin actions + payment events). Kept 1 year (TTL index).
// Never throws: logging must not break the action being logged.
import { getDb } from './db.js'

/**
 * @param actor   session document (admin), or a string like 'payhere' / 'system'
 * @param action  e.g. 'product.update', 'order.confirm', 'settings.update', 'payment.paid'
 * @param target  e.g. a product or order id
 * @param details small object (no personal data beyond what's needed)
 */
export async function audit(actor, action, target = null, details = {}) {
  try {
    const who = typeof actor === 'string' ? actor : actor?._id ? `admin:${String(actor._id).slice(0, 8)}` : 'admin'
    const device = typeof actor === 'object' && actor?.device ? actor.device.slice(0, 80) : undefined
    await (await getDb()).collection('audit_log').insertOne({ at: new Date(), actor: who, device, action, target, details })
  } catch (err) {
    console.error('[audit] failed', action, err?.message)
  }
}
