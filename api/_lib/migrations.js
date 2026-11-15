// Versioned database migrations. Each step runs ONCE per database (recorded in `_migrations`).
// They run automatically on the first request of a new server instance (cheap check afterwards),
// and can be run by hand:  npm run db:migrate
// Steps must be idempotent (safe if two instances start at the same moment).
import { slugify } from '../../shared/slug.js'

const ttl = (days) => ({ expireAfterSeconds: days * 24 * 3600 })

export const MIGRATIONS = [
  {
    id: '001-core-indexes',
    run: (db) =>
      Promise.all([
        db.collection('orders').createIndex({ createdAt: -1 }),
        db.collection('orders').createIndex({ status: 1, createdAt: -1 }),
        db.collection('orders').createIndex({ status: 1, expiresAt: 1 }), // expiry sweep
        db.collection('products').createIndex({ status: 1 }),
        db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('ratelimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]),
  },
  {
    id: '002-product-versions',
    run: (db) => db.collection('products').updateMany({ version: { $exists: false } }, { $set: { version: 0 } }),
  },
  {
    id: '003-product-slugs',
    async run(db) {
      const products = db.collection('products')
      const missing = await products.find({ slug: { $exists: false } }, { projection: { title: 1 } }).toArray()
      const taken = new Set((await products.distinct('slug')).filter(Boolean))
      for (const p of missing) {
        const base = slugify(p.title) || p._id.toLowerCase()
        let slug = base
        for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
        taken.add(slug)
        await products.updateOne({ _id: p._id, slug: { $exists: false } }, { $set: { slug } })
      }
      await products.createIndex({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } })
    },
  },
  {
    id: '004-phase3-indexes',
    run: (db) =>
      Promise.all([
        db.collection('products').createIndex({ status: 1, category: 1, position: 1 }), // shop listing
        db.collection('orders').createIndex({ 'customer.phone': 1, createdAt: -1 }), // a customer's history
        db.collection('orders').createIndex({ 'payment.paymentId': 1 }, { unique: true, partialFilterExpression: { 'payment.paymentId': { $type: 'string' } } }), // one payment → one order
        db.collection('payments').createIndex({ orderId: 1, receivedAt: -1 }),
        db.collection('audit_log').createIndex({ at: 1 }, ttl(365)),
        db.collection('audit_log').createIndex({ target: 1, at: -1 }),
      ]),
  },
]

export async function runMigrations(db, log = () => {}) {
  const done = new Set((await db.collection('_migrations').find({}, { projection: { _id: 1 } }).toArray()).map((m) => m._id))
  const ran = []
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue
    log(`running ${m.id}`)
    await m.run(db)
    await db.collection('_migrations').updateOne({ _id: m.id }, { $setOnInsert: { at: new Date() } }, { upsert: true })
    ran.push(m.id)
  }
  return ran
}
