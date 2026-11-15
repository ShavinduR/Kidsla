# Backend: MongoDB + Vercel Functions

Everything server-side lives in `/api` (Vercel deploys each file as a function) and `/shared` (code used by both server and browser).

| Endpoint | Who | What |
|---|---|---|
| `GET /api/products` | public | Live catalogue (hidden products excluded). CDN-cached 30 s. |
| `POST /api/orders` | public | Saves a checkout as **pending**. Server re-checks stock and recomputes all prices, then issues `KD-YYMM-NNN` (sequential per month, Sri Lanka time). |
| `GET/PATCH /api/admin/products` | admin | List all products / edit one (price, status, stock per size). |
| `POST /api/admin/seed` | admin | Load the starter catalogue into an **empty** database. |
| `GET /api/admin/export?format=xlsx\|csv` | admin | Inventory spreadsheet. |
| `POST /api/admin/import?dryRun=1` | admin | Upload .xlsx/.csv → change report; without `dryRun` → one `bulkWrite`. |
| `GET/PATCH /api/admin/orders` | admin | List orders; confirm (takes stock) / cancel (restocks if confirmed). |
| `POST /api/login`, `/api/logout`, `GET /api/session` | — | Admin auth (see README). |

## Collections (database `kidsla`)
- **products** `{ _id: "KD-G-001", title, category, gender, material, price, status, sizes, colors, images, stock: { "1-2Y": 6, … }, position }`
- **orders** `{ _id: "KD-2611-001", status: pending|confirmed|cancelled, customer, items[], subtotal, deliveryFee, total, createdAt, history[] }`
- **counters** `{ _id: "order-2611", seq }`: monthly order number

## Order & stock rules
- **Pending** orders don't touch stock (customers may never press Send in WhatsApp).
- **Confirm** takes stock only if enough is left for every line, otherwise nothing changes and you're told which item is short.
- **Cancel** a confirmed order → items go back into stock.
- If the API/database is down at checkout, the order still goes to WhatsApp with a **fallback ID `KDX-YYMM-XXXX`** (random, different prefix). KDX orders are not in the admin: handle them from the WhatsApp chat.
- Every product has a `version` that increments on every write (edit, import, confirm, cancel). Edits and import rows only apply if the version they were based on is still current; otherwise they're refused (409 / skipped) instead of overwriting newer stock.

## Excel library
Uses **ExcelJS**. The npm `xlsx` package is stuck at 0.18.5 with known security issues when parsing uploaded files; newer SheetJS builds are only on their own CDN.

## Request security
- Every state-changing request must be `application/json` (import: `application/octet-stream`) **and** carry an `Origin` equal to the site's own host (`guardWrite` in `api/_lib/http.js`). Other websites can't forge requests even if the admin cookie were sent.
- Excel uploads are checked by `api/_lib/zipguard.js` (max 20 MB unpacked, verified by actually inflating with a cap) before ExcelJS parses them; only the first 5,000 rows and 200 characters per cell are read.
- Security headers + CSP (Report-Only) are in `vercel.json`; violation reports are logged by `/api/csp-report`.

## Known limits / next steps
- Confirm/cancel use step-by-step updates with undo, not a MongoDB transaction. A crash mid-confirm could leave stock slightly off; fix in the Inventory tab.
- Login lockout and order spam limits are per server instance. Add Upstash Redis if abuse appears.
- No "add new product" form yet: new products need adding to the database (or ask for the feature).
