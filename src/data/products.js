// Mock catalogue. In production this comes from GET /api/products (MongoDB).
// Shape stays identical so swapping to the API is a one-line change.
import { CLOTHING_SIZES } from './sizeGuide'

const u = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`

const POOLS = {
  Girls: ['photo-1518831959646-742c3a14ebf7', 'photo-1503919545889-aef636e10ad4', 'photo-1622290291468-a28f7a7dc6a8', 'photo-1596870230751-ebdfce98ec42', 'photo-1519689680058-324335c77eba'],
  Boys: ['photo-1519238263530-99bdd11df2ea', 'photo-1503454537195-1dcabb73ffb9', 'photo-1471286174890-9c112ffca5b4', 'photo-1522771930-78848d9293e8', 'photo-1555009393-f20bdb245c4d'],
  Toys: ['photo-1596461404969-9ae70f2830c1', 'photo-1559454403-b8fb88521f11', 'photo-1587654780291-39c9404d746b', 'photo-1566454544259-f4b94c3d758c'],
  Educational: ['photo-1515488042361-ee00e0ddd4e4', 'photo-1503676260728-1c00da094a0b', 'photo-1558060370-d644479cb6f7', 'photo-1560859251-d563a49c5e4a'],
}
// 3–4 images per product, rotated so each product leads with a different shot.
const gallery = (pool, offset, count = 4) =>
  Array.from({ length: count }, (_, i) => u(POOLS[pool][(offset + i) % POOLS[pool].length]))

export const CATEGORIES = { CLOTHING: 'Clothing', TOYS: 'Toys', EDUCATIONAL: 'Educational' }
export const ONE_SIZE = 'One Size'

/** Only Clothing can be ordered right now. Toys & Educational are "coming_soon". */
export const isOrderable = (p) => p.status === 'active' && p.category === CATEGORIES.CLOTHING

export const stockFor = (p, size) => p.stock?.[size] ?? 0
export const totalStock = (p) => Object.values(p.stock ?? {}).reduce((a, b) => a + b, 0)

const clothing = (p) => ({ category: CATEGORIES.CLOTHING, status: 'active', sizes: CLOTHING_SIZES, ...p })
const comingSoon = (p) => ({ status: 'coming_soon', sizes: [ONE_SIZE], stock: {}, ...p })

export const initialProducts = [
  // ---------- Girls ----------
  clothing({
    id: 'KD-G-001', title: 'Cloud Ruffle Dress', gender: 'Girls', material: '100% Cotton', price: 4250,
    colors: [{ name: 'Dusty Pink', hex: '#E8C4C0' }, { name: 'Oat', hex: '#E9DFCF' }],
    images: gallery('Girls', 0), badge: 'Bestseller', stock: { '1-2Y': 6, '3-4Y': 9, '5-6Y': 4 },
    description: 'A twirl-ready everyday dress with soft ruffled sleeves and a relaxed fit that moves with them.',
  }),
  clothing({
    id: 'KD-G-002', title: 'Petal Knit Cardigan', gender: 'Girls', material: '100% Cotton Knit', price: 3890,
    colors: [{ name: 'Blush', hex: '#F1D3CE' }, { name: 'Cream', hex: '#F7F1E6' }],
    images: gallery('Girls', 1), stock: { '1-2Y': 5, '3-4Y': 0, '5-6Y': 7 },
    description: 'Breathable open-knit layer with wooden buttons — perfect for cool mornings.',
  }),
  clothing({
    id: 'KD-G-003', title: 'Muslin Romper', gender: 'Girls', material: '100% Cotton Muslin', price: 3450,
    colors: [{ name: 'Sage', hex: '#B5C0A8' }, { name: 'Sand', hex: '#E2D6C6' }],
    images: gallery('Girls', 2, 3), badge: 'New', stock: { '1-2Y': 10, '3-4Y': 6, '5-6Y': 0 },
    description: 'Airy double-gauze romper with snap closures for quick, fuss-free changes.',
  }),
  clothing({
    id: 'KD-G-004', title: 'Everyday Pleated Skirt', gender: 'Girls', material: '100% Cotton Twill', price: 2750,
    colors: [{ name: 'Beige', hex: '#D9C8B0' }, { name: 'Dusty Pink', hex: '#E8C4C0' }],
    images: gallery('Girls', 3), stock: { '1-2Y': 3, '3-4Y': 8, '5-6Y': 8 },
    description: 'Soft-pleated skirt with a comfy elastic waistband. Pairs with everything.',
  }),
  // ---------- Boys ----------
  clothing({
    id: 'KD-B-001', title: 'Essential Crew Tee', gender: 'Boys', material: '100% Combed Cotton', price: 1950,
    colors: [{ name: 'Sage', hex: '#8A9A7E' }, { name: 'Off-White', hex: '#F4EFE6' }, { name: 'Clay', hex: '#C9A88E' }],
    images: gallery('Boys', 0), badge: 'Bestseller', stock: { '1-2Y': 12, '3-4Y': 15, '5-6Y': 10 },
    description: 'The tee they will live in. Pre-washed for softness, tag-free for sensitive skin.',
  }),
  clothing({
    id: 'KD-B-002', title: 'Relaxed Jogger Pants', gender: 'Boys', material: '100% Cotton Terry', price: 2950,
    colors: [{ name: 'Oat', hex: '#E9DFCF' }, { name: 'Olive', hex: '#8E9A78' }],
    images: gallery('Boys', 1), stock: { '1-2Y': 7, '3-4Y': 7, '5-6Y': 2 },
    description: 'Cuffed joggers with a roomy seat — built for climbing, crawling and everything in between.',
  }),
  clothing({
    id: 'KD-B-003', title: 'Little Explorer Shirt', gender: 'Boys', material: '100% Cotton Poplin', price: 3250,
    colors: [{ name: 'Sky Mist', hex: '#C9D4D8' }, { name: 'Sand', hex: '#E2D6C6' }],
    images: gallery('Boys', 2, 3), badge: 'New', stock: { '1-2Y': 0, '3-4Y': 5, '5-6Y': 6 },
    description: 'A crisp, breathable button-up for family days and special occasions.',
  }),
  clothing({
    id: 'KD-B-004', title: 'Cozy Shorts Set', gender: 'Boys', material: '100% Brushed Cotton', price: 4450,
    colors: [{ name: 'Sage', hex: '#8A9A7E' }, { name: 'Stone', hex: '#BDB4A8' }],
    images: gallery('Boys', 3), stock: { '1-2Y': 4, '3-4Y': 4, '5-6Y': 4 },
    description: 'Matching tee and shorts in brushed-back cotton. Soft inside and out.',
  }),
  // ---------- Toys (coming soon) ----------
  comingSoon({
    id: 'KD-T-001', title: 'Wooden Stacking Rainbow', category: CATEGORIES.TOYS, material: 'Natural Beech Wood', price: 4650,
    colors: [{ name: 'Earth Tones', hex: '#C9A88E' }], images: gallery('Toys', 0),
    description: 'Open-ended play piece finished with non-toxic, water-based paints.',
  }),
  comingSoon({
    id: 'KD-T-002', title: 'Organic Plush Bunny', category: CATEGORIES.TOYS, material: '100% Cotton', price: 3250,
    colors: [{ name: 'Oat', hex: '#E9DFCF' }], images: gallery('Toys', 1, 3),
    description: 'A first friend with embroidered eyes — safe from day one.',
  }),
  comingSoon({
    id: 'KD-T-003', title: 'Soft Building Blocks', category: CATEGORIES.TOYS, material: 'BPA-Free Silicone', price: 3850,
    colors: [{ name: 'Muted Mix', hex: '#B5C0A8' }], images: gallery('Toys', 2),
    description: 'Squeezable, stackable, chewable. Twelve blocks in calming tones.',
  }),
  // ---------- Educational (coming soon) ----------
  comingSoon({
    id: 'KD-E-001', title: 'Montessori Shape Sorter', category: CATEGORIES.EDUCATIONAL, material: 'Sustainable Wood', price: 4950,
    colors: [{ name: 'Natural', hex: '#D9C8B0' }], images: gallery('Educational', 0),
    description: 'Builds early problem-solving and fine motor skills through calm, focused play.',
  }),
  comingSoon({
    id: 'KD-E-002', title: 'My First Words Flashcards', category: CATEGORIES.EDUCATIONAL, material: 'Recycled Thick Card', price: 1850,
    colors: [{ name: 'Natural', hex: '#DDE3D5' }], images: gallery('Educational', 1, 3),
    description: '40 illustrated, wipe-clean cards for little hands and big curiosity.',
  }),
  comingSoon({
    id: 'KD-E-003', title: 'Counting Bead Abacus', category: CATEGORIES.EDUCATIONAL, material: 'Beech Wood & Cotton Cord', price: 3650,
    colors: [{ name: 'Earth Tones', hex: '#C9A88E' }], images: gallery('Educational', 2),
    description: 'Tactile counting fun that makes numbers feel like play.',
  }),
]
