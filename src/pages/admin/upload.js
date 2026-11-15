// Photo upload: prepare in the browser, then send straight to Cloudinary with a server-made signature.

const MAX_INPUT = 30 * 1024 * 1024 // what we accept from the phone/computer
const MAX_EDGE = 2000 // px, longest side after resizing (plenty for zoom on any phone)

/**
 * Re-encode the photo as JPEG via a canvas. This:
 *  • removes ALL hidden metadata (EXIF), incl. the GPS location phones embed in photos,
 *  • applies the phone's rotation, so photos aren't sideways,
 *  • shrinks a 5 MB phone photo to ~300–600 KB (faster upload on mobile data).
 */
export async function prepareImage(file) {
  if (file.size > MAX_INPUT) throw new Error(`${file.name} is too large (max 30 MB).`)
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(
      `${file.name}: this photo format can’t be read here. Please use JPG or PNG (iPhone: Settings → Camera → Formats → Most Compatible).`,
    )
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // transparent PNGs → white background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new Error(`${file.name}: couldn’t process this photo.`)
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' })
}

/** Upload one prepared file. Resolves with Cloudinary's secure URL. */
export function uploadToCloudinary(file, ticket, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v)
    form.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', ticket.uploadUrl)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'))
    xhr.onload = () => {
      let data = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && /^https:\/\/res\.cloudinary\.com\//.test(data.secure_url ?? '')) resolve(data.secure_url)
      else reject(new Error(data.error?.message ?? `Upload failed (${xhr.status}).`))
    }
    xhr.send(form)
  })
}
