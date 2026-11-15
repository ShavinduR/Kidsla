// Cloudinary signed uploads (https://cloudinary.com). The browser uploads photos DIRECTLY to
// Cloudinary (no 4.5 MB Vercel limit, no image bytes through our server), using a short-lived
// signature only our server can create.
//
// Env (server-only): either CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
// (copy it from Cloudinary → Dashboard), or the three separate variables below.
import crypto from 'node:crypto'

export const UPLOAD_FOLDER = 'kidsla/products'
export const ALLOWED_FORMATS = 'jpg,png,webp'

export function cloudinaryConfig() {
  const url = process.env.CLOUDINARY_URL
  if (url) {
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(url)
    if (m) return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] }
  }
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null
}

/** Cloudinary's signature: SHA-1 of the sorted "key=value&…" params followed by the API secret. */
export function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex')
}

/** Parameters the browser sends with the file. Valid for 1 hour (Cloudinary checks the timestamp). */
export function uploadTicket() {
  const cfg = cloudinaryConfig()
  if (!cfg) return null
  const params = { allowed_formats: ALLOWED_FORMATS, folder: UPLOAD_FOLDER, timestamp: Math.floor(Date.now() / 1000) }
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`,
    fields: { ...params, api_key: cfg.apiKey, signature: signParams(params, cfg.apiSecret) },
    cloudName: cfg.cloudName,
  }
}

/** Only accept Cloudinary images from OUR account and upload folder. */
export function isOwnCloudinaryImage(url) {
  const cfg = cloudinaryConfig()
  if (!cfg) return false
  try {
    const u = new URL(url)
    return u.hostname === 'res.cloudinary.com' && u.pathname.startsWith(`/${cfg.cloudName}/image/upload/`) && u.pathname.includes(`/${UPLOAD_FOLDER}/`)
  } catch {
    return false
  }
}
