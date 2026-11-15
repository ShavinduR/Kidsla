// MongoDB transactions: several writes that succeed or fail together (Atlas = replica set, so supported).
// withTransaction() automatically retries on transient conflicts, e.g. two checkouts for the same
// product at the same moment. Throwing inside `fn` aborts and rolls back everything.
import { getClient } from './db.js'

export async function withTransaction(fn) {
  const client = await getClient()
  const session = client.startSession()
  try {
    let result
    await session.withTransaction(
      async () => {
        result = await fn(session)
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' },
    )
    return result
  } finally {
    await session.endSession()
  }
}
