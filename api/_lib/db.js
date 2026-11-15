// MongoDB connection, cached across invocations of a warm serverless instance.
//
// Env (Vercel → Settings → Environment Variables — server-only, never VITE_):
//   MONGODB_URI   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
//   MONGODB_DB    optional, defaults to "kidsla"
import { MongoClient } from 'mongodb'
import { runMigrations } from './migrations.js'

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
  // Versioned migrations (indexes, backfills): once per database, checked once per server instance.
  indexesReady ??= runMigrations(db).catch((err) => {
    indexesReady = null
    console.error('migrations failed', err)
  })
  await indexesReady
  return db
}

// Products are stored with the SKU as _id. The app works with `id`.
export const fromDoc = ({ _id, ...rest }) => ({ id: _id, ...rest })
export const toDoc = ({ id, ...rest }) => ({ _id: id, ...rest })
