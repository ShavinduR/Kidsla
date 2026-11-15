import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Link2, Trash2 } from 'lucide-react'
import { IMAGE_HOSTS, MAX_IMAGES, isAllowedImageUrl } from '../../../shared/productSchema.js'
import { getUploadTicket } from '../../services/adminApi'
import { imageSrc } from '../../utils/images'
import { prepareImage, uploadToCloudinary } from './upload'

// Product photos: upload (Cloudinary) or paste a link, reorder by dragging or with the arrows
// (keyboard / phone friendly), remove. The first photo is the cover in the shop.
export default function ImagesField({ images, onChange, error }) {
  const [uploads, setUploads] = useState([]) // { name, progress }
  const [notice, setNotice] = useState('')
  const [link, setLink] = useState('')
  const [dragFrom, setDragFrom] = useState(null)
  const fileInput = useRef(null)
  const room = MAX_IMAGES - images.length

  const move = (from, to) => {
    if (to < 0 || to >= images.length) return
    const next = [...images]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    onChange(next)
  }

  const onFiles = async (e) => {
    const files = [...(e.target.files ?? [])].slice(0, room)
    e.target.value = ''
    if (!files.length) return
    setNotice('')
    const ticket = await getUploadTicket()
    if (!ticket.ok) return setNotice(ticket.error ?? 'Upload isn’t available right now.')
    const added = []
    for (const file of files) {
      setUploads((u) => [...u, { name: file.name, progress: 0 }])
      try {
        const prepared = await prepareImage(file)
        const url = await uploadToCloudinary(prepared, ticket, (p) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, progress: p } : x))),
        )
        added.push(url)
        onChange((prev) => [...prev, url])
      } catch (err) {
        setNotice(err.message)
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name))
      }
    }
    return added
  }

  const addLink = () => {
    const url = link.trim()
    if (!isAllowedImageUrl(url)) return setNotice(`Links must start with https:// and come from ${IMAGE_HOSTS.join(' or ')}.`)
    if (images.includes(url)) return setNotice('That photo is already added.')
    onChange((prev) => [...prev, url])
    setLink('')
    setNotice('')
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Photos <span className="font-normal text-ink-soft">({images.length}/{MAX_IMAGES}, first = cover)</span></legend>
      <ul className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))] sm:gap-3" aria-label="Product photos">
        {images.map((src, i) => (
          <li
            key={src}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom !== null) move(dragFrom, i)
              setDragFrom(null)
            }}
            className={`group relative min-w-0 overflow-hidden rounded-2xl bg-sand ring-1 ring-sand-dark ${dragFrom === i ? 'opacity-50' : ''}`}
          >
            <img src={imageSrc(src, { w: 240, ratio: '4:5' })} alt={`Photo ${i + 1}`} className="aspect-[4/5] w-full cursor-grab object-cover" />
            {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-cream">Cover</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-ink/60 to-transparent p-1.5">
              <div className="flex gap-1">
                <IconBtn label={`Move photo ${i + 1} left`} onClick={() => move(i, i - 1)} disabled={i === 0}><ArrowLeft className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn label={`Move photo ${i + 1} right`} onClick={() => move(i, i + 1)} disabled={i === images.length - 1}><ArrowRight className="h-3.5 w-3.5" /></IconBtn>
              </div>
              <IconBtn label={`Remove photo ${i + 1}`} onClick={() => onChange(images.filter((x) => x !== src))}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
            </div>
          </li>
        ))}
        {uploads.map((u) => (
          <li key={u.name} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl bg-sand/60 p-2 text-center text-xs text-ink-soft ring-1 ring-sand-dark">
            <span className="line-clamp-2 break-all">{u.name}</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-white"><span className="block h-full bg-sage-dark transition-all" style={{ width: `${Math.round(u.progress * 100)}%` }} /></span>
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-sand-dark text-sm font-medium text-ink-soft transition-colors hover:border-sage-dark hover:text-ink"
            >
              <ImagePlus className="h-6 w-6" /> Upload
            </button>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} aria-label="Upload photos" />
          </li>
        )}
      </ul>
      <div className="mt-3 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Photo link</span>
          <Link2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
            placeholder="…or paste a photo link (Unsplash / Cloudinary)"
            className="h-11 w-full rounded-full bg-white pr-3 pl-10 text-sm ring-1 ring-sand-dark outline-none focus:ring-2 focus:ring-sage-dark"
          />
        </label>
        <button type="button" onClick={addLink} disabled={!link.trim() || room <= 0} className="h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-sand-dark hover:bg-sand disabled:opacity-40">
          Add
        </button>
      </div>
      {(notice || error) && <p role="alert" className="mt-2 text-sm font-medium text-rose">{notice || error}</p>}
      <p className="mt-2 text-xs text-ink-soft">Photos are resized and their hidden location data is removed before upload. Drag to reorder.</p>
    </fieldset>
  )
}

const IconBtn = ({ label, children, ...props }) => (
  <button type="button" aria-label={label} title={label} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-white disabled:opacity-30" {...props}>
    {children}
  </button>
)
