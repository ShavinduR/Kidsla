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

## Environment variables (Vercel → Settings → Environment Variables)
| Name | Required | What it's for |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string (database) |
| `ADMIN_PASSWORD` | yes | Admin password (16+ random characters) |
| `ADMIN_SESSION_SECRET` | yes | 64 random characters. Changing it or the password signs everyone out |
| `VITE_SITE_URL` | yes | Live URL, e.g. `https://kidsla.vercel.app` (link previews, alert links) |
| `CRON_SECRET` | recommended | Random string; lets Vercel's daily job release expired order holds |
| `RESEND_API_KEY` + `ALERT_EMAIL_TO` | recommended | Email alerts: new orders, server errors, login attacks ([resend.com](https://resend.com), free tier) |
| `ALERT_EMAIL_FROM` | optional | Sender once you verify your domain in Resend (default: Resend's test sender) |
| `VITE_SENTRY_DSN` | optional | Front-end error tracking ([sentry.io](https://sentry.io), free tier) |
| `VITE_META_PIXEL_ID` | optional | Meta Pixel for ads |
| `MONGODB_DB` | optional | Database name (default `kidsla`) |

## Ordering rules
- Only **Clothing** with `status: 'active'` can be ordered. Toys & Educational show **Coming Soon** + "Notify Me on WhatsApp".
- Sold-out sizes are disabled; quantities are capped to stock.
- Delivery: Colombo **LKR 350**, all other districts **LKR 400**.
- Checkout saves the order (server-checked stock and prices, sequential `KD-YYMM-NNN`) and **holds the stock for 24 hours** in a database transaction, so the last unit can never be promised to two customers. Then it opens WhatsApp and clears the cart.
- Unconfirmed orders **expire** after 24 h and their items go back on sale (checked at every checkout, whenever the admin is open, and by a daily Vercel cron). A confirmation screen keeps a "re-open WhatsApp" link in case the app didn't launch.
- If the server is unreachable, the order still goes to WhatsApp with a fallback ID **`KDX-YYMM-XXXX`**. KDX orders are *not* in the admin; handle them from the chat.

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
- 5 wrong attempts per IP → 15-minute wait; 100 wrong attempts site-wide per hour → sign-in paused + email alert.
- Every write request must be JSON (import: raw file) **and** come from this site's own origin, so other websites can't forge admin actions or orders.
- The dashboard code isn't downloaded until the server confirms the session.

- Sessions are stored server-side (only a hash of the token). **Log out** and **All devices** end sessions instantly.
- Rate limits (login, orders, imports) are shared by all server instances (MongoDB `ratelimits` collection).

**Setup:** in Vercel → Settings → Environment Variables add (Production + Preview), then redeploy:
| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | a long password (12+ characters) |
| `ADMIN_SESSION_SECRET` | 64 random characters, e.g. from `openssl rand -hex 32` |

Changing **either** value signs everyone out (the cookie signing key is derived from both). Locally, put them in `.env.local`; `npm run dev` serves `/api` too.

## Database (MongoDB Atlas)
1. Create a free cluster at https://cloud.mongodb.com (M0 Free, region near Sri Lanka, e.g. Mumbai `ap-south-1`).
2. **Database Access** → add a database user with a strong password (role: *Read and write to any database*).
3. **Network Access** → add `0.0.0.0/0` (Vercel's servers have changing IPs; the user/password still protects the database).
4. **Connect → Drivers** → copy the connection string and put your DB user's password into it.
5. Vercel → Settings → Environment Variables: `MONGODB_URI` = that string (optional `MONGODB_DB`, default `kidsla`). Redeploy.
6. Open `/admin` → **Load starter catalogue**.

Locally: add `MONGODB_URI` to `.env.local`. Without it the shop runs on the catalogue bundled in `src/data/products.js`.

## Security headers (CSP)
`vercel.json` sends a **Content-Security-Policy-Report-Only** header plus `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS.
Report-Only blocks nothing; browsers report would-be violations to `/api/csp-report` (Vercel → Logs → search `csp-violation`).
After a week with no unexpected reports, rename the header key to `Content-Security-Policy` to enforce it.
If you add a new third-party service (e.g. Cloudinary images, Sentry), add its domain to the matching directive first.

## Inventory spreadsheets
Exports include a **`version`** column. Don't edit it. A row is only imported if that product hasn't changed since you exported
(sales, edits). Changed rows are skipped and listed, so old spreadsheets can never put sold stock back. Just export again.

## Tests
34 end-to-end tests (real browser, real API, real MongoDB) run on every push via GitHub Actions (`.github/workflows/ci.yml`).
Locally (needs Docker):
```bash
docker run -d --name kidsla-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec kidsla-mongo mongosh --eval 'rs.initiate()'
npm test
```
The tests use their own database (`kidsla_e2e`), delete it freely, and refuse to run against Atlas.
