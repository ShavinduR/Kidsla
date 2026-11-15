# KIDSLA — Premium Kids' Essentials Storefront

React (Vite) + Tailwind CSS v4 + Lucide icons. Mobile-first storefront with a **WhatsApp checkout flow** (no payment gateway).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## Structure

```
src/
  data/products.js          Mock catalogue (Clothing · Toys · Educational)
  context/CartContext.jsx   Cart state (persisted to localStorage)
  utils/whatsapp.js         Order message builder + wa.me link (94742327807)
  utils/format.js           LKR price formatting
  utils/useLockBody.js      Scroll lock for modal/drawer
  components/
    Header.jsx              Logo, nav, cart badge, mobile menu
    Hero.jsx                Headline + "Shop the Collection" CTA
    Categories.jsx          Girls / Boys / Toys / Educational tiles
    ProductGrid.jsx         Filter chips + responsive grid
    ProductCard.jsx         Image, material, LKR price, Quick View / Add
    ProductModal.jsx        Size + colour + qty picker → Add to Cart
    CartDrawer.jsx          Items, subtotal, delivery note, form, WhatsApp checkout
    TrustStrip.jsx, Footer.jsx, SmartImage.jsx
```

## Customising

- **Products:** edit `src/data/products.js` (fields: `id, title, category, gender, material, price, sizes, colors, imageUrl`).
- **WhatsApp number:** `WHATSAPP_NUMBER` in `src/utils/whatsapp.js` (international format, no `+` or leading `0`).
- **Brand colours:** the `@theme` block in `src/index.css`.
