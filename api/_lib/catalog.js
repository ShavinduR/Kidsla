import { fromDoc, getDb } from './db.js'
import { SIZES } from '../../shared/inventory.js'

export async function loadProducts(filter = {}) {
  const db = await getDb()
  const docs = await db.collection('products').find(filter).sort({ position: 1, _id: 1 }).toArray()
  return docs.map(fromDoc)
}

/**
 * Apply product updates in ONE MongoDB round-trip, with optimistic concurrency (audit H1):
 * each update carries `expectedVersion`, and is only written if the product still has that version.
 * Every successful write increments `version`. Returns which ids lost the race (`conflicts`).
 */
export async function applyUpdates(updates) {
  if (!updates.length) return { matched: 0, modified: 0, conflicts: [] }
  const db = await getDb()
  const products = db.collection('products')
  const ops = updates.map(({ id, expectedVersion, stock, ...fields }) => {
    if (!Number.isInteger(expectedVersion)) throw new Error(`applyUpdates: missing expectedVersion for ${id}`)
    const $set = { ...fields, updatedAt: new Date() }
    for (const s of SIZES) if (stock && s in stock) $set[`stock.${s}`] = stock[s]
    return { updateOne: { filter: { _id: id, version: expectedVersion }, update: { $set, $inc: { version: 1 } } } }
  })
  const r = await products.bulkWrite(ops, { ordered: false })

  let conflicts = []
  if (r.matchedCount < updates.length) {
    // Something changed between validation and write. Work out which rows didn't apply.
    const now = await products
      .find({ _id: { $in: updates.map((u) => u.id) } }, { projection: { version: 1 } })
      .toArray()
    const v = new Map(now.map((d) => [d._id, d.version]))
    conflicts = updates.filter((u) => v.get(u.id) !== u.expectedVersion + 1).map((u) => u.id)
  }
  return { matched: r.matchedCount, modified: r.modifiedCount, conflicts }
}
