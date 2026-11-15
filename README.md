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
| Admin (inventory, orders, Excel import/export) | `src/pages/admin/`, `src/services/adminApi.js` |
| Server API (Vercel Functions) + MongoDB | `api/`, `shared/`, `docs/BACKEND.md` |
| SEO / Open Graph | `index.html`, `public/og-image.png` |
| Meta Pixel + Vercel Analytics | `src/utils/analytics.js`, `src/App.jsx` |

## Ordering rules
- Only **Clothing** with `status: 'active'` can be ordered. Toys & Educational show **Coming Soon** + "Notify Me on WhatsApp".
- Sold-out sizes are disabled; quantities are capped to stock.
- Delivery: Colombo **LKR 350**, all other districts **LKR 400**.
- Checkout saves the order (server-checked stock and prices, sequential `KD-YYMM-NNN`), opens WhatsApp, then clears the cart. A confirmation screen keeps a "re-open WhatsApp" link in case the app didn't launch.

## Vercel setup
1. **Environment variables** (Project → Settings → Environment Variables):
   - `VITE_SITE_URL` = your live URL, e.g. `https://kidsla.vercel.app` or `https://kidsla.lk` (no trailing slash). Needed for link previews.
   - `VITE_META_PIXEL_ID` = your Pixel ID (optional).
2. **Analytics**: Project → **Analytics** tab → **Enable** (Web Analytics). `@vercel/analytics` + `<Analytics />` are already in `src/App.jsx`; visitors and page views appear a few minutes after the next deploy. `/admin` visits are excluded. Shop events (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Lead`) are also sent as custom events, which Vercel shows on Pro plans.
3. Redeploy. Test your link preview at https://developers.facebook.com/tools/debug/ (also refreshes WhatsApp's cache).

## Admin login (`/admin`)
Password-protected by Vercel Functions in `/api` (`login`, `logout`, `session`):
- The password is checked **on the server** against `ADMIN_PASSWORD`. It is never in the website's code.
- Success sets a signed, **HttpOnly, Secure, SameSite=Strict** cookie (8 hours). Tampered/forged cookies are rejected.
- 5 wrong attempts → 15-minute lockout (per IP, best-effort), plus a delay on every wrong attempt.
- The dashboard code isn't downloaded until the server confirms the session.

**Setup:** in Vercel → Settings → Environment Variables add (Production + Preview), then redeploy:
| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | a long password (12+ characters) |
| `ADMIN_SESSION_SECRET` | 64 random characters, e.g. from `openssl rand -hex 32` |

Changing either value signs everyone out. Locally, put them in `.env.local`; `npm run dev` serves `/api` too.

## Database (MongoDB Atlas)
1. Create a free cluster at https://cloud.mongodb.com (M0 Free, region near Sri Lanka, e.g. Mumbai `ap-south-1`).
2. **Database Access** → add a database user with a strong password (role: *Read and write to any database*).
3. **Network Access** → add `0.0.0.0/0` (Vercel's servers have changing IPs; the user/password still protects the database).
4. **Connect → Drivers** → copy the connection string and put your DB user's password into it.
5. Vercel → Settings → Environment Variables: `MONGODB_URI` = that string (optional `MONGODB_DB`, default `kidsla`). Redeploy.
6. Open `/admin` → **Load starter catalogue**.

Locally: add `MONGODB_URI` to `.env.local`. Without it the shop runs on the catalogue bundled in `src/data/products.js`.
