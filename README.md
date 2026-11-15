# KIDSLA — Premium Kids' Essentials Storefront

React (Vite) · Tailwind CSS v4 · Lucide · React Router. Mobile-first storefront with a **WhatsApp checkout**, plus an inventory **Admin Dashboard** at `/admin`.

```bash
npm install
npm run dev      # http://localhost:5173   (admin: /admin)
npm run build
```

## What's inside
| Area | Where |
|---|---|
| Business settings: WhatsApp number, delivery fees, districts, policies | `src/data/site.js` |
| Size guide (reviewed measurements + notes) | `src/data/sizeGuide.js` |
| Products, stock per size, images | `src/data/products.js` |
| Checkout + WhatsApp message | `src/components/CartDrawer.jsx`, `src/utils/whatsapp.js` |
| Admin import/export (mock → Node backend) | `src/pages/AdminDashboard.jsx`, `src/services/inventoryApi.js`, `docs/BACKEND.md` |
| SEO / Open Graph | `index.html`, `public/og-image.png` |
| Meta Pixel + Vercel Analytics | `src/utils/analytics.js`, `src/App.jsx` |

## Ordering rules
- Only **Clothing** with `status: 'active'` can be ordered. Toys & Educational show **Coming Soon** + "Notify Me on WhatsApp".
- Sold-out sizes are disabled; quantities are capped to stock.
- Delivery: Colombo **LKR 350**, all other districts **LKR 400**.
- Checkout generates an order ID (`KD-YYMM-NNN`), opens WhatsApp, then clears the cart. A confirmation screen keeps a "re-open WhatsApp" link in case the app didn't launch.

## Vercel setup
1. **Environment variables** (Project → Settings → Environment Variables):
   - `VITE_SITE_URL` = your live URL, e.g. `https://kidsla.vercel.app` or `https://kidsla.lk` (no trailing slash). Needed for link previews.
   - `VITE_META_PIXEL_ID` = your Pixel ID (optional).
2. **Analytics**: Project → **Analytics** tab → **Enable** (Web Analytics). `@vercel/analytics` + `<Analytics />` are already in `src/App.jsx`; visitors and page views appear a few minutes after the next deploy. `/admin` visits are excluded. Shop events (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`) are also sent as custom events, which Vercel shows on Pro plans.
3. Redeploy. Test your link preview at https://developers.facebook.com/tools/debug/ (also refreshes WhatsApp's cache).

> ⚠️ `/admin` is a frontend demo with no login. Changes are in-memory only. Add backend auth before using it for real (see `docs/BACKEND.md`).
