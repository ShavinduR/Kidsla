// Zip-bomb guard for uploaded .xlsx files (audit M1).
//
// An .xlsx is a zip archive. A tiny zip can expand to gigabytes and crash the function, so before
// ExcelJS ever sees the file we:
//   1. read the zip's central directory (the table of contents at the end of the file),
//   2. reject encrypted / ZIP64 / unusual archives and too many entries,
//   3. ACTUALLY inflate every entry with a hard output cap (zlib maxOutputLength). The sizes
//      written in the zip headers are attacker-controlled and can lie, so we never trust them alone.
// Total uncompressed size is limited to MAX_UNCOMPRESSED (20 MB). Inflation stops the moment the
// budget is exceeded, so memory use stays around the cap no matter what the file claims.
import zlib from 'node:zlib'

export const MAX_UNCOMPRESSED = 20 * 1024 * 1024
const MAX_ENTRIES = 300
const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

export class UnsafeFileError extends Error {}

const fail = (msg) => {
  throw new UnsafeFileError(msg)
}

/** Throws UnsafeFileError if the archive is malformed or would expand beyond `limit` bytes. */
export function assertSafeZip(buf, limit = MAX_UNCOMPRESSED) {
  if (buf.length < 22) fail('This isn’t a valid .xlsx file.')

  // End-of-central-directory record: last 22 bytes + up to 64 KB comment.
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) fail('This isn’t a valid .xlsx file.')

  const entries = buf.readUInt16LE(eocd + 10)
  const cdSize = buf.readUInt32LE(eocd + 12)
  const cdOffset = buf.readUInt32LE(eocd + 16)
  if (entries === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) fail('Unsupported file (ZIP64).')
  if (entries === 0 || entries > MAX_ENTRIES) fail('This file has an unexpected structure.')
  if (cdOffset + cdSize > eocd) fail('This file is damaged.')

  let p = cdOffset
  let declared = 0
  let actual = 0
  for (let n = 0; n < entries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CENTRAL) fail('This file is damaged.')
    const flags = buf.readUInt16LE(p + 8)
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    if (flags & 0x1) fail('Password-protected files aren’t supported.')

    declared += size
    if (declared > limit) fail('This file is too large once unpacked (max 20 MB).')

    // Locate the entry's data through its local header and inflate it for real, with a cap.
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LOCAL) fail('This file is damaged.')
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28)
    const data = buf.subarray(start, start + compSize)
    if (data.length !== compSize) fail('This file is damaged.')

    const budget = limit - actual
    if (method === 0) actual += data.length
    else if (method === 8) {
      try {
        actual += zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, budget) }).length
      } catch (err) {
        if (err?.code === 'ERR_BUFFER_TOO_LARGE' || err instanceof RangeError) fail('This file is too large once unpacked (max 20 MB).')
        fail('This file is damaged.')
      }
    } else fail('This file uses an unsupported compression method.')
    if (actual > limit) fail('This file is too large once unpacked (max 20 MB).')

    p += 46 + nameLen + extraLen + commentLen
  }
  return { entries, uncompressed: actual }
}
