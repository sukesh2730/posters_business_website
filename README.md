# MemoPrint

Personalised photo prints, posters and gifts for India. React 19 + Vite + Tailwind on the front end, an Express API (`server.ts`) and Cloud Firestore for orders and media. Cash on delivery only.

## What you can sell

- **Photo products:** Polaroid-style prints, photo strips, retro prints (10 photos), mini pocket photos (5), photobooth strips (3), frames, gifts.
- **Build your wall:** six layouts (17 to 40 posters). Fill each spot with a design or your own photo.
- **Mix and match:** buy 4/5/6/10 A4 posters and get 3/5/12/26 free.
- **Split posters:** one image across 3, 4, 5 or 8 panels.

Prices for walls, split posters and packs live in `src/shared/printPricing.ts` and are used by both the cart and the server. The server recalculates every price at checkout, so the browser cannot change what an order costs. Lines marked `PLACEHOLDER` in that file are estimates: set them from your real print and shipping costs.

Poster designs in `src/shared/posterDesigns.ts` are original vector art. To use your own artwork, add an `imageUrl` to a design.

## Run it locally

```bash
npm install
cp .env.example .env      # then fill in the values
npm run dev               # http://localhost:3000
npm test                  # runs the test suites
```

## Deploy

```bash
npm install
npm run build
SESSION_SECRET=<32+ random characters> npm start
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Signs image links, guest sessions and order signatures. The server will not start in production without it (at least 24 characters). Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `SITE_URL` | recommended | Your public address, e.g. `https://memoprint.in`. Used for share-preview links. |
| `TRUST_PROXY_HOPS` | no | Reverse proxies in front of the app. Default 1 (Cloud Run and most hosts). Use 0 if there is none. |
| `MEDIA_CACHE_MAX_MB` | no | Memory cap for the image cache. Default 128. |
| `ORDER_WRITE_TIMEOUT_MS` | no | How long to wait for Firestore to save an order. Default 12000. |
| `NODE_ENV` | no | Anything other than `development` or `test` is treated as production. |

`npm run dev` passes `--dev`. Test logins (`x-test-auth` header) exist only under `npm test`, or locally if you start the server with `ALLOW_TEST_AUTH=true` and `--dev`. They can never be enabled in production.

## Security model, in short

- The server is the only source of prices, totals, order ids and order numbers.
- An order is only confirmed once it is saved to Firestore. If saving fails, the customer sees an error instead of a false success.
- Photo links must be durable (`/api/images/...` or `https://`). `blob:`, `data:` and `javascript:` links are rejected.
- Admin access requires a verified Firebase account listed in the admin check.

## Staying inside the free tiers

Cloud Firestore's free plan allows 50,000 reads and 20,000 writes per day and stores 1 GiB. Two things keep a store inside that:

- **Cached catalogue.** The server reads products and collections once every 5 minutes and serves everyone from memory (`GET /api/catalog`). A page load costs no database reads. Admin changes call `/api/admin/catalog/refresh`, so edits show up immediately. `/api/health` shows `catalog: {loads, hits}` so you can see it working.
- **Photos outside Firestore.** Firebase's own Cloud Storage is no longer free. Set the four `R2_*` variables (see `.env.example`) to keep photos in a private Cloudflare R2 bucket (10 GB free, free downloads). Photos are still served through your server, which checks who may see each one. `/api/health` shows `"imageProvider":"r2"` when it is working. If the bucket cannot be reached the server logs why and carries on with photos inside Firestore (700 KB limit).

## Print files for builder orders

In the admin orders table, every wall, mix-and-match pack and split poster has a **Print files** button. It builds a ZIP in the admin's browser (nothing is uploaded) containing:

- one JPEG per poster or panel at **300 dpi** at its printed size (A5, A4, A3, 13 x 19 in; landscape slots are rotated),
- `packing-sheet.txt` listing every file, its size, its design or customer photo, and where each panel goes.

Customer photos are centre-cropped to fit (split posters keep the position the customer chose). If a customer's photo is too small for the size they ordered, the sheet starts with a **WARNING** and the effective dpi. The built-in vector designs are redrawn at full resolution for every panel, so they stay sharp.

## Admin mode (recommended for production)

The server can talk to Firebase in two ways. **Admin mode** (Firebase Admin SDK) is what you want in production. The older **client mode** is a fallback.

| | Admin mode | Client mode (fallback) |
| --- | --- | --- |
| One-time first-order coupons (`FIRSTMEMO15`, `WELCOME50`) | enforced | not enforced |
| Max 5 orders per customer per hour | yes | no |
| Duplicate-order protection across instances/restarts | yes | per instance only |
| Rate limit on order creation shared across instances | yes | per instance only |
| Photos up to 10 MB (sharper A3 / wall prints) | yes, stored in Cloud Storage | 700 KB, stored inside Firestore |
| Browsers can be blocked from creating orders directly | yes (server-only rules) | no |

**How to turn it on**

1. On Google Cloud (Cloud Run, AI Studio deploys) the server's own service account is used automatically. Give that service account the roles **Cloud Datastore User** and **Storage Object Admin**.
   Anywhere else, create a service-account key (Firebase console > Project settings > Service accounts > Generate new private key) and set `FIREBASE_SERVICE_ACCOUNT_JSON` to the whole JSON.
2. Start the server and open `/api/health`. It must show `"store":"admin"`. If it shows `"client"`, read the server log for the reason.
3. Only then deploy `firestore.server-only.rules` as your Firestore rules. Deploying them while the server is still in client mode makes every order fail.
4. Optional: add a Firestore TTL policy on the `expiresAt` field of the `rate_limits` collection so old counters delete themselves.

## Tests

`npm test` runs every suite. The new suites need no network or credentials:

- `tests/print-builders.test.ts` wall, split and pack pricing and validation
- `tests/hardening.test.ts` order-write safety, photo links, caches
- `tests/store.test.ts` the database layer (memory and Admin backends, with a faithful stand-in for Firestore)
- `tests/blob.test.ts` and `tests/blob-integration.test.ts` free image storage (R2 / S3) and the catalogue cache
- `tests/store-integration.test.ts` the real server end to end: saving orders, retries, one-time coupons, order limits, 10 MB photos
- `tests/server-integration.test.ts` the server started the way a careless deploy would, with only `SESSION_SECRET`
- `tests/print-export.test.ts` print-file sizing (300 dpi panels for every set and size)
- `tests/browser/*.py` optional browser checks of the print export (Python Playwright; see the header of each file)

Older suites (`cod-security`, `comprehensive-security-and-gst`, `p0-p1-fixes`, `qa-audit`) talk to the live Firestore and need internet access.

## Known limits

- Client mode cannot enforce one-time coupons or shared limits (see Admin mode above).
- Image files uploaded before Admin mode was turned on stay inside Firestore documents. They keep working; only new uploads use Cloud Storage.
- Per-instance protections (the general 120 requests/minute limiter) are still in memory. Order creation is protected across instances in Admin mode.
