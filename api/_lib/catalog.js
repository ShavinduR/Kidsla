import { fromDoc, getDb } from './db.js'
import { SIZES } from '../../shared/inventory.js'

export async function loadProducts(filter = {}) {
  const db = await getDb()
  const docs = await db.collection('products').find(filter).sort({ position: 1, _id: 1 }).toArray()
  return docs.map(fromDoc)
}

/** One MongoDB round-trip for any number of product updates (from import or the edit dialog). */
export async function applyUpdates(updates) {
  if (!updates.length) return { matched: 0, modified: 0 }
  const db = await getDb()
  const ops = updates.map(({ id, stock, ...fields }) => {
    const $set = { ...fields, updatedAt: new Date() }
    for (const s of SIZES) if (stock && s in stock) $set[`stock.${s}`] = stock[s]
    return { updateOne: { filter: { _id: id }, update: { $set } } }
  })
  const r = await db.collection('products').bulkWrite(ops, { ordered: false })
  return { matched: r.matchedCount, modified: r.modifiedCount }
}
