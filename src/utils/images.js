// Responsive image URLs. Product photos are stored as their ORIGINAL URL; this builds resized
// versions on the fly, so phones download ~40 KB instead of a full-size photo.
//  • Cloudinary: f_auto (WebP/AVIF), q_auto, smart crop, exact width; metadata (EXIF/GPS) stripped.
//  • Unsplash (imgix): w / fit=crop / auto=format.
export const WIDTHS = [240, 360, 480, 720, 960, 1280]

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/

/** ratio like "4:5"; crop=false keeps the whole photo (letterboxed by CSS instead). */
export function imageSrc(url, { w = 720, ratio = '4:5', crop = true } = {}) {
  if (!url) return ''
  const m = CLOUDINARY.exec(url)
  if (m) {
    const t = ['f_auto', 'q_auto', crop && ratio ? `c_fill,g_auto,ar_${ratio}` : 'c_limit', `w_${w}`].join(',')
    // Originals look like .../upload/v1700000000/kidsla/products/abc.jpg
    return `https://res.cloudinary.com/${m[1]}/image/upload/${t}/${m[2].replace(/^(?:[a-z]{1,3}_[^/]+\/)+(?=v\d+\/)/, '')}`
  }
  try {
    const u = new URL(url)
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('auto', 'format')
      u.searchParams.set('q', '75')
      u.searchParams.set('w', String(w))
      if (crop && ratio) {
        u.searchParams.set('fit', 'crop')
        u.searchParams.set('ar', ratio)
      }
      return u.toString()
    }
  } catch {
    /* not a URL */
  }
  return url
}

export const srcSet = (url, opts) => WIDTHS.map((w) => `${imageSrc(url, { ...opts, w })} ${w}w`).join(', ')

/** 1200×630 picture for WhatsApp / Facebook link previews. */
export function ogImage(url) {
  const m = CLOUDINARY.exec(url ?? '')
  if (m) return `https://res.cloudinary.com/${m[1]}/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/${m[2]}`
  try {
    const u = new URL(url)
    if (u.hostname === 'images.unsplash.com') {
      for (const [k, v] of Object.entries({ w: '1200', h: '630', fit: 'crop', fm: 'jpg', q: '80' })) u.searchParams.set(k, v)
      u.searchParams.delete('ar')
      u.searchParams.delete('auto')
      return u.toString()
    }
  } catch {
    /* fall through */
  }
  return url
}
