// Run database migrations by hand:  MONGODB_URI=... npm run db:migrate
// (They also run automatically on the first request after a deploy.)
import { MongoClient } from 'mongodb'
import { runMigrations } from '../api/_lib/migrations.js'

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Set MONGODB_URI first.')
  process.exit(1)
}
const client = await new MongoClient(uri).connect()
try {
  const ran = await runMigrations(client.db(process.env.MONGODB_DB || 'kidsla'), (m) => console.log('→', m))
  console.log(ran.length ? `Done: ${ran.join(', ')}` : 'Database is up to date.')
} finally {
  await client.close()
}
