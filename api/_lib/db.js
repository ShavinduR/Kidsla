// MongoDB connection, cached across invocations of a warm serverless instance.
//
// Env (Vercel → Settings → Environment Variables — server-only, never VITE_):
//   MONGODB_URI   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
//   MONGODB_DB    optional, defaults to "kidsla"
import { MongoClient } from 'mongodb'
import { slugify } from '../../shared/slug.js'

let clientPromise = null
let indexesReady = null

export const isDbConfigured = () => Boolean(process.env.MONGODB_URI)

/** The connected MongoClient (needed to start transactions). */
export async function getClient() {
  await getDb()
  return clientPromise
}

export async function getDb() {
  if (!isDbConfigured()) {
    const err = new Error('Database not connected yet. Add MONGODB_URI in Vercel, then redeploy.')
    err.code = 'DB_NOT_CONFIGURED'
    throw err
  }
  clientPromise ??= new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 6000,
    appName: 'kidsla-web',
  })
    .connect()
    .catch((err) => {
      clientPromise = null // retry on the next request instead of caching the failure
      throw err
    })
  const db = (await clientPromise).db(process.env.MONGODB_DB || 'kidsla')
  indexesReady ??= backfillSlugs(db).then(() => Promise.all([
    db.collection('products').createIndex({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } }),
    db.collection('orders').createIndex({ createdAt: -1 }),
    db.collection('orders').createIndex({ status: 1, createdAt: -1 }),
    db.collection('products').createIndex({ status: 1 }),
    db.collection('orders').createIndex({ status: 1, expiresAt: 1 }), // expiry sweep
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // auto-delete old sessions
    db.collection('ratelimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }), // auto-delete old counters
    // One-time backfill: products created before version tracking start at version 0.
    db.collection('products').updateMany({ version: { $exists: false } }, { $set: { version: 0 } }),
  ])).catch((err) => {
    indexesReady = null
    console.error('index creation failed', err)
  })
  await indexesReady
  return db
}

// Products created before Phase 2 have no link name (slug). Give each a unique one from its title.
async function backfillSlugs(db) {
  const products = db.collection('products')
  const missing = await products.find({ slug: { $exists: false } }, { projection: { title: 1 } }).toArray()
  if (!missing.length) return
  const taken = new Set((await products.distinct('slug')).filter(Boolean))
  for (const p of missing) {
    const base = slugify(p.title) || p._id.toLowerCase()
    let slug = base
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
    taken.add(slug)
    await products.updateOne({ _id: p._id, slug: { $exists: false } }, { $set: { slug } })
  }
}

// Products are stored with the SKU as _id. The app works with `id`.
export const fromDoc = ({ _id, ...rest }) => ({ id: _id, ...rest })
export const toDoc = ({ id, ...rest }) => ({ _id: id, ...rest })
