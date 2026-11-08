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

## Known limits

- Firestore rules still allow browsers to create order documents directly. Moving all writes to the Firebase Admin SDK (so the rules can say "server only") needs a service-account key and is the next hardening step.
- Image files are stored as base64 inside Firestore documents (about 700 KB each). Firebase Storage is the better home as volume grows.
- Rate limiting and duplicate-order protection are held in memory, so they are per instance. Use one instance, or move them to Redis/Firestore before scaling out.
- First-order coupons (`FIRSTMEMO15`, `WELCOME50`) are not yet limited to one use per customer.
