import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { priceBuilder, sanitizeBuilder } from './src/shared/printPricing';
import {
  BoundedMap,
  BoundedMediaCache,
  normalizeCatalogPrice,
  orderIdFromIdempotencyKey,
  sanitizeClientPhotoUrls,
  stripUndefined,
  withTimeout,
} from './server/hardening';
import { AdminStore, ClientStore, DataStore, MemoryStore, createAdminStore } from './server/store';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

// ----------------------------------------------------
// Firebase App Initialization on Server
// ----------------------------------------------------
function getFirebaseConfig(): any {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {}
  return null;
}

const firebaseConfig = getFirebaseConfig();
const fbApp = firebaseConfig
  ? !getApps().length
    ? initializeApp(firebaseConfig, 'server-app')
    : getApp('server-app')
  : null;

const db = fbApp && firebaseConfig?.firestoreDatabaseId
  ? getFirestore(fbApp, firebaseConfig.firestoreDatabaseId)
  : null;

// ----------------------------------------------------
// Data store (Admin SDK in production, see server/store.ts)
// ----------------------------------------------------
const MAX_FIRESTORE_DOC_IMAGE_BYTES = 700 * 1024; // image bytes that fit inside a Firestore document
const MAX_BLOB_IMAGE_BYTES = 10 * 1024 * 1024; // allowed when files live in Cloud Storage
const MAX_ORDERS_PER_CONTACT_PER_HOUR = 5;
let store: DataStore = new ClientStore({ db, doc, getDoc, setDoc, updateDoc, getDocs, collection });
export function setDataStore(next: DataStore) {
  store = next;
}
export function getDataStore() {
  return store;
}

// A background failure inside a library (for example a network blip in the database client) must
// not take the whole store offline. Log it with the audit logger instead of crashing.
process.on('unhandledRejection', (reason: any) => {
  logSecurityEvent('UNHANDLED_REJECTION', { error: String(reason?.message || reason).slice(0, 300) });
});

async function initDataStore() {
  if (process.env.DATA_STORE === 'memory' && !isProduction) {
    store = new MemoryStore();
    console.warn('Data store: IN-MEMORY (development/testing only; nothing is saved to disk).');
    return;
  }
  if (process.env.DATA_STORE === 'client') {
    console.warn('Data store: browser-style Firebase SDK (DATA_STORE=client).');
    return;
  }
  try {
    store = await createAdminStore({
      projectId: firebaseConfig?.projectId,
      databaseId: firebaseConfig?.firestoreDatabaseId,
      storageBucket: firebaseConfig?.storageBucket,
      serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    });
    console.log(`Data store: Firebase Admin SDK (file storage ${store.supportsBlobs ? 'enabled' : 'unavailable, images stay in Firestore'}).`);
  } catch (err: any) {
    console.warn(
      `Data store: Admin SDK unavailable (${String(err?.message || err).slice(0, 140)}). ` +
        'Using the browser-style SDK. One-time coupons, shared rate limits and large image storage are OFF, ' +
        'and the server-only Firestore rules must NOT be deployed. See README "Admin mode".'
    );
  }
}

// ----------------------------------------------------
// ----------------------------------------------------
// Environment mode: secure by default
// ----------------------------------------------------
// Anything that is not explicitly development or test is treated as production, so a
// deployment that forgets to set NODE_ENV can no longer expose the test-auth header or
// fall back to a known secret. Local dev: `npm run dev` passes --dev.
const isTestEnv = process.env.NODE_ENV === 'test';
const isDevMode = isTestEnv || process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const isProduction = !isDevMode;
// x-test-auth headers and unsigned guest ids are accepted ONLY under automated tests,
// or locally when ALLOW_TEST_AUTH=true is set with --dev. Never in production.
// Test logins exist only on development/test servers AND only for requests that come from this very
// machine (loopback, not through a proxy). A dev server reached from the internet (for example an
// AI Studio preview that shares your real database) can therefore never be taken over with a header.
const testAuthMode = !isProduction;
function isLoopbackRequest(req: express.Request): boolean {
  const addr = req.socket?.remoteAddress || '';
  const loopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
  return loopback && !req.headers['x-forwarded-for'] && !req.headers['forwarded'] && !req.headers['x-real-ip'];
}
const testAuthAllowed = (req: express.Request): boolean => testAuthMode && isLoopbackRequest(req);

// Cache & Local Storage Directory Setup
// ----------------------------------------------------
const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  if (!isProduction) {
    console.warn('Notice: public/uploads folder creation:', err);
  }
}

// In-Memory Media Cache for sub-millisecond serving
interface CachedMedia {
  buffer: Buffer;
  mime: string;
  fileName: string;
  sizeBytes: number;
  visibility: 'public' | 'private';
  uploadedBy: string;
}
// Bounded so uploads can never exhaust memory; images are always stored durably first,
// so evicting an entry only means the next request reloads it from storage.
const MEDIA_CACHE_MAX_BYTES = Math.max(8, Number(process.env.MEDIA_CACHE_MAX_MB) || 128) * 1024 * 1024;
const mediaMemoryCache = new BoundedMediaCache<CachedMedia>(MEDIA_CACHE_MAX_BYTES);
const mediaHashCache = new BoundedMap<string, string>(5000);
const ORDER_WRITE_TIMEOUT_MS = Number(process.env.ORDER_WRITE_TIMEOUT_MS) || 12000;

// ----------------------------------------------------
// Cryptographic Secrets & Signed URL Engine
// ----------------------------------------------------
const SERVER_SECRET: string = (() => {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 24) return configured;
  if (isProduction) {
    throw new Error(
      'SESSION_SECRET is missing or shorter than 24 characters. Set it in your hosting environment. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  console.warn('SESSION_SECRET not set: using a random secret for this run (signed links reset on restart).');
  return crypto.randomBytes(32).toString('hex');
})();

export function generateSignedImageToken(mediaId: string, uploadedBy: string, expiresInMs = 7 * 24 * 60 * 60 * 1000): { token: string; expires: number } {
  const expires = Date.now() + expiresInMs;
  const payload = `${mediaId}:${uploadedBy}:${expires}`;
  const hmac = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return { token: `${expires}.${hmac}`, expires };
}

export function verifySignedImageToken(mediaId: string, uploadedBy: string, tokenStr: string): boolean {
  if (!tokenStr || typeof tokenStr !== 'string') return false;
  const parts = tokenStr.split('.');
  if (parts.length !== 2) return false;
  const expires = Number(parts[0]);
  const providedHmac = parts[1];
  if (!expires || isNaN(expires) || Date.now() > expires) return false;
  const expectedPayload = `${mediaId}:${uploadedBy}:${expires}`;
  const expectedHmac = crypto.createHmac('sha256', SERVER_SECRET).update(expectedPayload).digest('hex');
  try {
    const providedBuf = Buffer.from(providedHmac, 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    if (providedBuf.length !== expectedBuf.length || providedBuf.length === 0) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function generateSignedGuestSession(expiresInMs = 30 * 24 * 60 * 60 * 1000): { sessionId: string; sessionToken: string; expires: number } {
  const sessionId = `guest_${crypto.randomBytes(24).toString('hex')}`;
  const expires = Date.now() + expiresInMs;
  const payload = `${sessionId}:${expires}`;
  const hmac = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return { sessionId, sessionToken: `${sessionId}.${expires}.${hmac}`, expires };
}

export function verifyGuestSessionToken(tokenStr: string): string | null {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  const parts = tokenStr.split('.');
  
  // Format with explicit expiry timestamp: sessionId.expires.hmac
  if (parts.length === 3) {
    const sessionId = parts[0];
    const expires = Number(parts[1]);
    const providedHmac = parts[2];
    if (!sessionId.startsWith('guest_') || !expires || isNaN(expires) || Date.now() > expires) return null;
    const payload = `${sessionId}:${expires}`;
    const expectedHmac = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
    try {
      const pBuf = Buffer.from(providedHmac, 'hex');
      const eBuf = Buffer.from(expectedHmac, 'hex');
      if (pBuf.length === eBuf.length && pBuf.length > 0 && crypto.timingSafeEqual(pBuf, eBuf)) {
        return sessionId;
      }
    } catch {}
    return null;
  }

  // Backwards compatibility for 2-part tokens: sessionId.hmac
  if (parts.length === 2) {
    const sessionId = parts[0];
    const providedHmac = parts[1];
    if (!sessionId.startsWith('guest_')) return null;
    const expectedHmac = crypto.createHmac('sha256', SERVER_SECRET).update(sessionId).digest('hex');
    try {
      const pBuf = Buffer.from(providedHmac, 'hex');
      const eBuf = Buffer.from(expectedHmac, 'hex');
      if (pBuf.length === eBuf.length && pBuf.length > 0 && crypto.timingSafeEqual(pBuf, eBuf)) {
        return sessionId;
      }
    } catch {}
    return null;
  }

  return null;
}

export function generateOrderSignature(orderId: string, total: number, userId: string, paymentMethod: string): string {
  const payload = `${orderId}:${Math.round(total)}:${userId}:${paymentMethod}`;
  return crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
}

export function verifyOrderSignature(order: { id: string; total: number; userId: string; paymentMethod: string; orderSignature?: string }): boolean {
  if (!order.orderSignature || typeof order.orderSignature !== 'string') return false;
  const expected = generateOrderSignature(order.id, order.total, order.userId, order.paymentMethod);
  try {
    const pBuf = Buffer.from(order.orderSignature, 'hex');
    const eBuf = Buffer.from(expected, 'hex');
    return pBuf.length === eBuf.length && pBuf.length > 0 && crypto.timingSafeEqual(pBuf, eBuf);
  } catch {
    return false;
  }
}

export function setMediaCacheHeaders(res: express.Response, visibility: 'public' | 'private', mime: string) {
  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (visibility === 'public') {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Vary', 'Cookie, Authorization, Origin');
  }
}

export function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

export interface AuthoritativeMediaMetadata {
  id: string;
  mime: string;
  visibility: 'public' | 'private';
  uploadedBy: string;
  fileName: string;
  sizeBytes: number;
}

export /** Image bytes from wherever they are durably kept: a Storage file, or base64 inside the document. */
async function loadMediaBytes(mediaId: string): Promise<Buffer | null> {
  try {
    const d = await store.getDoc('media_assets', mediaId);
    if (!d) return null;
    if (d.storagePath) return await store.getBlob(d.storagePath);
    if (d.data) return Buffer.from(d.data, 'base64');
  } catch {}
  return null;
}

async function getAuthoritativeMediaMetadata(mediaId: string): Promise<AuthoritativeMediaMetadata | null> {
  const cached = mediaMemoryCache.get(mediaId);
  if (cached) {
    return {
      id: mediaId,
      mime: cached.mime,
      visibility: cached.visibility || 'public',
      uploadedBy: cached.uploadedBy || '',
      fileName: cached.fileName || mediaId,
      sizeBytes: cached.sizeBytes || 0,
    };
  }

  try {
    const d = await store.getDoc('media_assets', mediaId);
    if (d) {
      const meta: AuthoritativeMediaMetadata = {
        id: mediaId,
        mime: d.contentType || 'image/jpeg',
        visibility: d.visibility || 'public',
        uploadedBy: d.uploadedBy || '',
        fileName: d.fileName || mediaId,
        sizeBytes: d.sizeBytes || 0,
      };
      if (d.data) {
        mediaMemoryCache.set(mediaId, {
          buffer: Buffer.from(d.data, 'base64'),
          mime: meta.mime,
          fileName: meta.fileName,
          sizeBytes: meta.sizeBytes,
          visibility: meta.visibility,
          uploadedBy: meta.uploadedBy,
        });
      }
      return meta;
    }
  } catch (err: any) {
    logSecurityEvent('MEDIA_METADATA_FETCH_ERROR', { mediaId, error: err.message });
  }

  return null;
}

// ----------------------------------------------------
// Sliding-Window In-Memory Rate Limiter
// ----------------------------------------------------
interface RateLimitEntry {
  timestamps: number[];
}
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { timestamps: [] };
  // Filter out timestamps older than the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  entry.timestamps.push(now);
  rateLimitMap.set(ip, entry);
  return { allowed: true, retryAfter: 0 };
}


export function createRateLimiter(limit: number, windowMs = 60000, label = 'general') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip rate limiting ONLY for local automated tests
    if (testAuthAllowed(req)) {
      return next();
    }

    // req.ip honours only the trusted proxy hops (see trust proxy), so a client cannot
    // dodge the limit by sending its own X-Forwarded-For header.
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${label}:${clientIp}`;
    const result = checkRateLimit(key, limit, windowMs);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        error: `Too many requests to ${label}. Please wait ${result.retryAfter} seconds before retrying.`,
        retryAfterSeconds: result.retryAfter,
      });
    }

    next();
  };
}

/**
 * Same idea as createRateLimiter, but the counter lives in the shared data store so it holds
 * across several server instances. Needs Admin mode; otherwise it does nothing (the per-instance
 * limiter still applies). If the store is down it lets the request through.
 */
export function createSharedRateLimiter(limit: number, windowMs = 60000, label = 'shared') {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (testAuthAllowed(req) || !store.supportsSharedState) return next();
    try {
      const r = await store.hit(`${label}:${req.ip || req.socket.remoteAddress || 'unknown'}`, windowMs, limit);
      if (!r.allowed) {
        res.setHeader('Retry-After', r.retryAfter);
        return res.status(429).json({
          error: `Too many requests to ${label}. Please wait ${r.retryAfter} seconds before retrying.`,
          retryAfterSeconds: r.retryAfter,
        });
      }
    } catch (err: any) {
      logSecurityEvent('SHARED_RATE_LIMIT_ERROR', { label, error: err.message });
    }
    next();
  };
}

// ----------------------------------------------------
// Security & Audit Logger
// ----------------------------------------------------
export function logSecurityEvent(type: string, meta: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY-AUDIT] [${timestamp}] [${type}] ${JSON.stringify(meta)}`);
}

// ----------------------------------------------------
// Trusted Catalog & Promotional Constants
// ----------------------------------------------------
export const TRUSTED_CATALOG: Record<string, { id: string; name: string; price: number; isActive: boolean }> = {
  'prod-polaroid-classic': { id: 'prod-polaroid-classic', name: 'Retro Polaroid-Style Prints (Pack of 20)', price: 349, isActive: true },
  'prod-polaroid-mini-magnets': { id: 'prod-polaroid-mini-magnets', name: 'Magnetic Mini Polaroid Fridge Snaps (Set of 12)', price: 399, isActive: true },
  'prod-polaroid-fairylight-kit': { id: 'prod-polaroid-fairylight-kit', name: 'Fairy Light & Pegs Polaroid Wall Display Kit', price: 499, isActive: true },
  'prod-photo-strip-classic': { id: 'prod-photo-strip-classic', name: 'Vintage 3-Shot Photobooth Film Strips (Set of 6)', price: 249, isActive: true },
  'prod-photo-strip-monochrome': { id: 'prod-photo-strip-monochrome', name: 'Noir Monochrome Black & White Photo Strips (Set of 4)', price: 279, isActive: true },
  'prod-photo-strip-holographic': { id: 'prod-photo-strip-holographic', name: 'Holographic Glitter Film Strips (Set of 4)', price: 299, isActive: true },
  'prod-vintage-film-roll': { id: 'prod-vintage-film-roll', name: 'Vintage 35mm Film Canister Keychain with Pull-Out Photos', price: 449, isActive: true },
  'prod-frame-minimalist-wood': { id: 'prod-frame-minimalist-wood', name: 'Handcrafted Pine Wood Tabletop Frame with Mat Border', price: 649, isActive: true },
  'prod-vintage-scrapbook-album': { id: 'prod-vintage-scrapbook-album', name: 'Hardbound Linen Memory Scrapbook & Print Bundle', price: 899, isActive: true },
  'prod-pastel-border-polaroids': { id: 'prod-pastel-border-polaroids', name: 'Pastel Dreamscape Polaroid Prints (Pack of 15)', price: 329, isActive: true },
  'prod-pastel-acrylic-standee': { id: 'prod-pastel-acrylic-standee', name: 'Custom Mini Acrylic Heart Photo Standee', price: 379, isActive: true },
  'prod-pastel-doodle-strips': { id: 'prod-pastel-doodle-strips', name: 'Y2K Pastel Doodle Photobooth Strips (Set of 6)', price: 269, isActive: true },
  'prod-gift-ceramic-mug': { id: 'prod-gift-ceramic-mug', name: 'Two-Tone Ceramic Photo Coffee Mug (350ml)', price: 349, isActive: true },
  'prod-poster-music-album': { id: 'prod-poster-music-album', name: 'Custom Scannable Song & Soundwave Acrylic Plaque', price: 499, isActive: true },
  'prod-collage-heart-mosaic': { id: 'prod-collage-heart-mosaic', name: 'Heart Shape Multi-Photo Canvas Wall Art', price: 799, isActive: true },
  'prod-gift-acrylic-keychain': { id: 'prod-gift-acrylic-keychain', name: 'Double-Sided Crystal Acrylic Memory Keychain', price: 199, isActive: true },
  'prod-poster-grid-collage': { id: 'prod-poster-grid-collage', name: 'Museum Matte Multi-Photo Grid Gallery Poster', price: 399, isActive: true },
  'prod-poster-film-strip': { id: 'prod-poster-film-strip', name: '35mm Vintage Analog Film Strip Wall Poster', price: 379, isActive: true },
  'prod-poster-starmap-constellation': { id: 'prod-poster-starmap-constellation', name: 'Custom Night Sky & Constellation Star Map Poster', price: 549, isActive: true },
  'prod-bundle-fairylight-kit': { id: 'prod-bundle-fairylight-kit', name: 'Cozy Room Fairy Light & Polaroid Wall Hanging Bundle', price: 499, isActive: true },
  'prod-bundle-ultimate-magnets': { id: 'prod-bundle-ultimate-magnets', name: 'Fridge Magic Set: 12 Polaroid Magnets + 4 Photostrips', price: 549, isActive: true },
  'prod-bundle-bff-memory-pack': { id: 'prod-bundle-bff-memory-pack', name: 'BFF Memory Pack: 6 Holographic Strips + 15 Pastel Polaroids', price: 449, isActive: true },
  'prod-custom-retro-prints': { id: 'prod-custom-retro-prints', name: 'Custom Retro Prints (10 photos)', price: 179, isActive: true },
  'prod-custom-pocket-prints': { id: 'prod-custom-pocket-prints', name: 'Mini Pocket Photos (5 photos)', price: 99, isActive: true },
  'prod-custom-photobooth-strip': { id: 'prod-custom-photobooth-strip', name: 'Custom Photobooth Strips (3 strips)', price: 149, isActive: true }
};

export const TRUSTED_COUPONS = [
  { code: 'FIRSTMEMO15', firstOrderOnly: true, discountPercent: 15, maxDiscount: 300, minAmount: 299, description: '15% OFF on first order' },
  { code: 'MEMO20', discountPercent: 20, maxDiscount: 500, minAmount: 999, description: '20% OFF on orders above ₹999' },
  { code: 'FREESHIP', freeShipping: true, minAmount: 299, description: 'Free Shipping on orders above ₹299' },
  { code: 'MEMO10', discountPercent: 10, minAmount: 399, description: '10% OFF on orders above ₹399' },
  { code: 'MEMOLIFE', flatDiscount: 150, minAmount: 799, description: 'Flat ₹150 OFF on orders above ₹799' },
  { code: 'WELCOME50', firstOrderOnly: true, flatDiscount: 50, minAmount: 299, description: '₹50 OFF on your first purchase' },
];

// ----------------------------------------------------
// Authentication Verification
// ----------------------------------------------------
export async function verifyRequestAuth(req: express.Request): Promise<AuthenticatedUser | null> {
  // Test authentication headers are accepted only from this machine on dev/test servers
  if (testAuthAllowed(req)) {
    const testHeader = req.headers['x-test-auth'];
    const testAuth = Array.isArray(testHeader) ? testHeader[0] : testHeader;
    if (testAuth) {
      if (testAuth === 'admin') {
        return { uid: 'test-admin-uid', email: 'sukeshkavin@gmail.com', emailVerified: true };
      }
      if (testAuth === 'unverified-admin') {
        return { uid: 'test-unverified-admin', email: 'sukeshkavin@gmail.com', emailVerified: false };
      }
      if (testAuth === 'customer') {
        return { uid: 'test-cust-123', email: 'customer@example.com', emailVerified: true };
      }
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (idToken && firebaseConfig?.apiKey) {
      try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data.users && data.users.length > 0) {
            const userRecord = data.users[0];
            return {
              uid: userRecord.localId,
              email: userRecord.email || null,
              emailVerified: Boolean(userRecord.emailVerified),
            };
          }
        }
      } catch (err) {
        if (!isProduction) {
          console.warn('ID token verification error:', err);
        }
      }
    }
  }

  // Check cryptographically signed guest session header or cookie
  const guestHeader = req.headers['x-guest-session'];
  const cookies = parseCookies(req);
  const rawGuest = (Array.isArray(guestHeader) ? guestHeader[0] : guestHeader) || cookies['memo_guest_session'];

  if (rawGuest && typeof rawGuest === 'string' && rawGuest.trim().length >= 6) {
    const verifiedSessionId = verifyGuestSessionToken(rawGuest.trim());
    if (verifiedSessionId) {
      return {
        uid: verifiedSessionId,
        email: null,
        emailVerified: false,
      };
    }
    // In local automated tests, allow unsigned test guest sessions
    if (testAuthAllowed(req)) {
      return {
        uid: `guest_${rawGuest.trim().slice(0, 36)}`,
        email: null,
        emailVerified: false,
      };
    }
    logSecurityEvent('UNVERIFIED_GUEST_SESSION_REJECTED', { ip: req.ip, rawGuest: rawGuest.slice(0, 15) });
  }

  return null;
}

export function isAuthorizedAdmin(user: AuthenticatedUser | null): boolean {
  if (!user || !user.email) return false;
  return (
    user.email.toLowerCase() === 'sukeshkavin@gmail.com' &&
    user.emailVerified === true
  );
}

// ----------------------------------------------------
// Image Validation & Persistent Media Engine
// ----------------------------------------------------
function inspectImageBuffer(buf: Buffer): { ext: string; mime: string } {
  if (buf.length < 12) {
    throw new Error('Invalid file format: file too small or corrupted.');
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }

  // WebP: RIFF ... WEBP
  const isRiff = buf.toString('ascii', 0, 4) === 'RIFF';
  const isWebp = buf.toString('ascii', 8, 12) === 'WEBP';
  if (isRiff && isWebp) {
    return { ext: '.webp', mime: 'image/webp' };
  }

  throw new Error('Invalid image format. Allowed formats: JPG, PNG, WebP.');
}

export const DYNAMIC_CATALOG: Record<string, { id: string; name: string; price: number; isActive: boolean }> = {};

export async function resolveCatalogProduct(productId: string): Promise<{ id: string; name: string; price: number; isActive: boolean } | null> {
  const cleanId = String(productId || '').trim();
  if (!cleanId) return null;

  if (TRUSTED_CATALOG[cleanId]) {
    return TRUSTED_CATALOG[cleanId];
  }
  if (DYNAMIC_CATALOG[cleanId]) {
    return DYNAMIC_CATALOG[cleanId];
  }
  try {
    const data = await store.getDoc('products', cleanId);
    if (data) {
      const goodPrice = normalizeCatalogPrice(data.price);
      if (goodPrice === null) {
        // A product without a valid price cannot be sold; never guess one.
        logSecurityEvent('CATALOG_PRODUCT_INVALID_PRICE', { productId: cleanId });
        return null;
      }
      const resolved = {
        id: cleanId,
        name: data.name || 'Custom Photo Print',
        price: goodPrice,
        isActive: data.isActive !== false,
      };
      DYNAMIC_CATALOG[cleanId] = resolved;
      return resolved;
    }
  } catch (err: any) {
    if (!isProduction) {
      console.warn(`Catalog lookup error for product ${cleanId}:`, err.message);
    }
  }
  return null;
}

// Background sync of Firestore products into dynamic catalog cache
async function syncFirestoreCatalog() {
  try {
    const all = await store.listDocs('products');
    all.forEach((data) => {
      const goodPrice = normalizeCatalogPrice(data.price);
      if (goodPrice === null) return;
      DYNAMIC_CATALOG[data.id] = {
        id: data.id,
        name: data.name || 'Custom Photo Print',
        price: goodPrice,
        isActive: data.isActive !== false,
      };
    });
  } catch {}
}
syncFirestoreCatalog();

async function saveToPersistentMediaStore(
  fileData: string,
  fileName?: string,
  userUid?: string,
  visibility: 'public' | 'private' = 'public',
  clientHash?: string
): Promise<{ 
  id: string; 
  url: string; 
  canonicalUrl: string; 
  fileName: string; 
  sizeBytes: number; 
  mime: string; 
  visibility: 'public' | 'private';
  isDuplicate?: boolean;
}> {
  const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let base64Buffer: Buffer;
  let base64String: string;

  if (matches && matches.length === 3) {
    base64String = matches[2];
    base64Buffer = Buffer.from(matches[2], 'base64');
  } else {
    base64String = fileData;
    base64Buffer = Buffer.from(fileData, 'base64');
  }

  // Enforce durable storage boundary: Firestore document limit is 1 MiB (1,048,576 bytes).
  // A 700 KB raw binary expands to ~933 KB Base64. Combined with metadata, this guarantees
  // the document will safely fit in Firestore without corruption or truncation.
  // With file storage (Admin mode) photos can be much larger, which keeps prints sharp.
  const MAX_STORAGE_BYTES = store.supportsBlobs ? MAX_BLOB_IMAGE_BYTES : MAX_FIRESTORE_DOC_IMAGE_BYTES;
  if (base64Buffer.length > MAX_STORAGE_BYTES) {
    throw new Error(`File size (${(base64Buffer.length / 1024).toFixed(1)} KB) exceeds the ${Math.round(MAX_STORAGE_BYTES / 1024)} KB storage limit. Please optimize or compress before uploading.`);
  }

  if (!store.supportsBlobs && base64String.length > 950000) {
    throw new Error('Image base64 payload exceeds durable document persistence threshold.');
  }

  const meta = inspectImageBuffer(base64Buffer);

  // Deduplication check: compute SHA-256 fingerprint
  const computedHash = clientHash || crypto.createHash('sha256').update(base64Buffer).digest('hex');
  const dedupKey = visibility === 'public' ? `public_${computedHash}` : `${userUid || 'guest'}_${computedHash}`;

  // Check persistent hash deduplication in Firestore if not in memory cache
  if (!mediaHashCache.has(dedupKey)) {
    try {
      const hashDoc = await store.getDoc('media_hashes', dedupKey);
      if (hashDoc?.mediaId) {
        mediaHashCache.set(dedupKey, hashDoc.mediaId);
      }
    } catch {}
  }

  if (mediaHashCache.has(dedupKey)) {
    const existingId = mediaHashCache.get(dedupKey)!;
    const existingMeta = await getAuthoritativeMediaMetadata(existingId);
    if (existingMeta) {
      const signedToken = existingMeta.visibility === 'private'
        ? generateSignedImageToken(existingId, existingMeta.uploadedBy)
        : null;
      return {
        id: existingId,
        url: signedToken ? `/uploads/${existingId}${meta.ext}?token=${signedToken.token}` : `/uploads/${existingId}${meta.ext}`,
        canonicalUrl: signedToken ? `/api/images/${existingId}?token=${signedToken.token}` : `/api/images/${existingId}`,
        fileName: existingMeta.fileName,
        sizeBytes: existingMeta.sizeBytes,
        mime: existingMeta.mime,
        visibility: existingMeta.visibility,
        isDuplicate: true,
      };
    }
  }

  const safeRandom = crypto.randomBytes(8).toString('hex');
  const mediaId = `img_${Date.now()}_${safeRandom}`;
  const safeDiskName = `${mediaId}${meta.ext}`;
  const cleanFileName = fileName ? path.basename(fileName).slice(0, 100) : safeDiskName;

  // 1. DURABLE PERSISTENCE FIRST:
  // An upload must ONLY return success after it has been safely written to durable Firestore storage.
  // We NEVER return success if the image only exists in RAM, in-memory cache, or ephemeral container disk.
  try {
    const record: Record<string, any> = {
      id: mediaId,
      fileName: cleanFileName,
      contentType: meta.mime,
      sizeBytes: base64Buffer.length,
      hash: computedHash,
      uploadedBy: userUid || 'guest',
      visibility,
      createdAt: new Date().toISOString(),
    };
    let storedAsFile = false;
    if (store.supportsBlobs) {
      try {
        const storagePath = `media/${mediaId}${meta.ext}`;
        await store.putBlob(storagePath, base64Buffer, meta.mime);
        record.storagePath = storagePath;
        storedAsFile = true;
      } catch (blobErr: any) {
        logSecurityEvent('MEDIA_BLOB_WRITE_FAILED', { mediaId, error: blobErr.message });
        if (base64Buffer.length > MAX_FIRESTORE_DOC_IMAGE_BYTES) throw blobErr;
      }
    }
    if (!storedAsFile) record.data = base64String;
    await store.setDoc('media_assets', mediaId, record);

    // Save deduplication index
    try {
      await store.setDoc('media_hashes', dedupKey, {
        mediaId,
        visibility,
        uploadedBy: userUid || 'guest',
        createdAt: new Date().toISOString(),
      });
    } catch {}
  } catch (e: any) {
    logSecurityEvent('MEDIA_STORAGE_PERSISTENCE_FAILED', { mediaId, error: e.message });
    throw new Error(`Failed to save image to durable storage: ${e.message}`);
  }

  // 2. In-memory cache for fast sub-millisecond responses
  mediaMemoryCache.set(mediaId, {
    buffer: base64Buffer,
    mime: meta.mime,
    fileName: cleanFileName,
    sizeBytes: base64Buffer.length,
    visibility,
    uploadedBy: userUid || 'guest',
  });
  mediaHashCache.set(dedupKey, mediaId);

  // 3. Local disk cache for filesystem acceleration (non-authoritative)
  try {
    fs.writeFileSync(path.join(uploadsDir, safeDiskName), base64Buffer);
    const distUploads = path.resolve(process.cwd(), 'dist', 'uploads');
    if (fs.existsSync(distUploads)) {
      fs.writeFileSync(path.join(distUploads, safeDiskName), base64Buffer);
    }
  } catch {}

  const signedToken = visibility === 'private' ? generateSignedImageToken(mediaId, userUid || 'guest') : null;

  return {
    id: mediaId,
    url: signedToken ? `/uploads/${safeDiskName}?token=${signedToken.token}` : `/uploads/${safeDiskName}`,
    canonicalUrl: signedToken ? `/api/images/${mediaId}?token=${signedToken.token}` : `/api/images/${mediaId}`,
    fileName: cleanFileName,
    sizeBytes: base64Buffer.length,
    mime: meta.mime,
    visibility,
    isDuplicate: false,
  };
}

// ----------------------------------------------------
// Express API Router Setup
// ----------------------------------------------------
export const apiRouter = express.Router();

// Apply general API rate limiting (120 req / minute)
apiRouter.use(createRateLimiter(120, 60000, 'api'));

// ----------------------------------------------------
// Idempotency Store for Order Creation
// ----------------------------------------------------
interface IdempotentOrderRecord {
  order: any;
  createdAt: number;
}
const idempotencyOrderMap = new Map<string, IdempotentOrderRecord>();

// Clean up expired idempotency records older than 24 hours
const idempotencyCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, val] of idempotencyOrderMap.entries()) {
    if (val.createdAt < cutoff) {
      idempotencyOrderMap.delete(key);
    }
  }
}, 60 * 60 * 1000);
if (typeof idempotencyCleanupTimer.unref === 'function') {
  idempotencyCleanupTimer.unref();
}

export function calculateAuthoritativeTotals(items: any[], couponCode?: string) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order must contain at least one item.');
  }

  let subtotalPaise = 0;
  const validatedItems: any[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('Malformed order item.');
    }

    // Wall builder, split posters and mix & match packs are priced from their own
    // configuration by the shared pricing module. The client-sent price and productId
    // are ignored for these items.
    if (item.builder) {
      const priced = priceBuilder(item.builder);
      const builderQty = parseInt(item.quantity, 10);
      if (isNaN(builderQty) || builderQty < 1 || builderQty > 10) {
        throw new Error(`Invalid quantity for "${priced.name}". Quantity must be between 1 and 10.`);
      }
      const builderUnitPaise = priced.unitPrice * 100;
      subtotalPaise += builderUnitPaise * builderQty;
      validatedItems.push({
        productId: priced.productId,
        productName: priced.name,
        size: priced.summary,
        finish: 'Matte, 300 GSM',
        quantity: builderQty,
        unitPrice: priced.unitPrice,
        unitPricePaise: builderUnitPaise,
        totalPrice: priced.unitPrice * builderQty,
        totalPricePaise: builderUnitPaise * builderQty,
        photoUrls: priced.photoUrls,
        builder: sanitizeBuilder(item.builder),
      });
      continue;
    }

    const productId = String(item.productId || '');
    const catalogProduct = TRUSTED_CATALOG[productId] || DYNAMIC_CATALOG[productId];

    if (!catalogProduct) {
      throw new Error(`Product "${productId}" was not found in the verified store catalog.`);
    }

    if (catalogProduct.isActive === false) {
      throw new Error(`Product "${catalogProduct.name}" is currently discontinued or out of stock.`);
    }

    const unitPriceRupees = catalogProduct.price;
    const productName = catalogProduct.name;

    const qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      throw new Error(`Invalid quantity for "${productName}". Quantity must be an integer between 1 and 100.`);
    }

    const unitPricePaise = unitPriceRupees * 100;
    const itemTotalPaise = unitPricePaise * qty;
    subtotalPaise += itemTotalPaise;

    validatedItems.push({
      productId: catalogProduct ? catalogProduct.id : productId,
      productName,
      size: typeof item.size === 'string' && item.size.trim() ? item.size.trim() : 'Standard',
      finish: typeof item.finish === 'string' && item.finish.trim() ? item.finish.trim() : 'Glossy',
      quantity: qty,
      unitPrice: unitPriceRupees,
      unitPricePaise,
      totalPrice: unitPriceRupees * qty,
      totalPricePaise: itemTotalPaise,
      photoUrls: Array.isArray(item.photoUrls) && item.photoUrls.length > 0 ? item.photoUrls : undefined,
      caption: typeof item.caption === 'string' ? item.caption.slice(0, 150) : undefined,
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 300) : undefined,
    });
  }

  // Shipping policy: Free shipping above ₹499 (49900 paise), else ₹60 (6000 paise)
  let shippingChargesPaise = subtotalPaise >= 49900 ? 0 : 6000;
  let discountPaise = 0;
  let appliedCoupon: string | null = null;

  if (typeof couponCode === 'string' && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    const matched = TRUSTED_COUPONS.find((c) => c.code === cleanCode);

    if (matched) {
      const minAmountPaise = matched.minAmount * 100;
      if (subtotalPaise >= minAmountPaise) {
        if ('freeShipping' in matched && matched.freeShipping) {
          shippingChargesPaise = 0;
        } else if ('flatDiscount' in matched && matched.flatDiscount) {
          discountPaise = matched.flatDiscount * 100;
        } else if ('discountPercent' in matched && matched.discountPercent) {
          discountPaise = Math.round(subtotalPaise * (matched.discountPercent / 100));
          if ('maxDiscount' in matched && matched.maxDiscount) {
            discountPaise = Math.min(discountPaise, matched.maxDiscount * 100);
          }
        }
        discountPaise = Math.min(subtotalPaise, Math.max(0, discountPaise));
        appliedCoupon = matched.code;
      }
    }
  }

  // 18% GST (SAC 9989 Printing Services) itemized calculation
  // Business Model: Option B - GST INCLUSIVE
  // Customer catalog prices include 18% GST.
  // Formula:
  // inclusiveGoodsPaise = max(0, subtotalPaise - discountPaise)
  // taxableAmountPaise = Math.round(inclusiveGoodsPaise / 1.18)
  // gstPaise = inclusiveGoodsPaise - taxableAmountPaise
  // totalPaise = inclusiveGoodsPaise + shippingChargesPaise
  // Mathematical Identity: taxableAmountPaise + gstPaise + shippingChargesPaise === totalPaise
  const inclusiveGoodsPaise = Math.max(0, subtotalPaise - discountPaise);
  const taxableAmountPaise = Math.round(inclusiveGoodsPaise / 1.18);
  const gstPaise = inclusiveGoodsPaise - taxableAmountPaise;
  const totalPaise = inclusiveGoodsPaise + shippingChargesPaise;

  const total = Math.round(totalPaise / 100);
  const shippingCharges = Math.round(shippingChargesPaise / 100);
  const subtotal = Math.round(subtotalPaise / 100);
  const discount = Math.round(discountPaise / 100);
  const taxableAmount = Math.round(taxableAmountPaise / 100);
  // Guarantee strict mathematical identity: taxableAmount + gst + shippingCharges === total
  const gst = total - shippingCharges - taxableAmount;

  return {
    valid: true,
    subtotal,
    subtotalPaise,
    taxableAmount,
    taxableAmountPaise,
    gst,
    gstPaise,
    gstRate: 0.18,
    gstModel: 'inclusive',
    shippingCharges,
    shippingChargesPaise,
    discount,
    discountPaise,
    couponCode: appliedCoupon,
    total,
    totalPaise,
    currency: 'INR',
    items: validatedItems,
  };
}

// ----------------------------------------------------
// 1. Authoritative Order Calculation Endpoint
// ----------------------------------------------------
apiRouter.post('/orders/validate', createRateLimiter(40, 60000, 'orders_validate'), async (req, res) => {
  try {
    const { items, couponCode } = req.body;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item?.productId && !item?.builder) {
          await resolveCatalogProduct(String(item.productId));
        }
      }
    }
    const result = calculateAuthoritativeTotals(items, couponCode);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Order validation failed.' });
  }
});

// Coupon verification helper
apiRouter.post('/coupons/validate', createRateLimiter(40, 60000, 'coupons_validate'), (req, res) => {
  try {
    const { couponCode, subtotal } = req.body;
    if (!couponCode || typeof couponCode !== 'string') {
      return res.status(400).json({ error: 'Coupon code required.' });
    }
    const cleanCode = couponCode.trim().toUpperCase();
    const coupon = TRUSTED_COUPONS.find((c) => c.code === cleanCode);
    if (!coupon) {
      return res.status(404).json({ valid: false, error: 'Invalid coupon code.' });
    }

    const subtotalNum = Number(subtotal) || 0;
    if (subtotalNum < coupon.minAmount) {
      return res.status(400).json({
        valid: false,
        error: `Coupon ${coupon.code} requires a minimum order value of ₹${coupon.minAmount}.`,
      });
    }

    return res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        minAmount: coupon.minAmount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 1b. Authoritative COD Order Placement (Idempotent)
// ----------------------------------------------------
apiRouter.post('/orders', createRateLimiter(30, 60000, 'orders_create'), createSharedRateLimiter(30, 60000, 'orders_create'), async (req, res) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    if (idempotencyKey && typeof idempotencyKey === 'string') {
      const existing = idempotencyOrderMap.get(idempotencyKey.trim());
      if (existing) {
        logSecurityEvent('IDEMPOTENT_ORDER_SERVED', { idempotencyKey: idempotencyKey.trim(), orderId: existing.order.id });
        return res.json({ success: true, order: existing.order, idempotent: true });
      }
      // Another server instance (or a restart) may already have saved this order. Only trusted
      // when reads reflect the real database: the fallback client SDK can answer from its own
      // unsent local writes, which would wrongly report an unsaved order as saved.
      if (store.supportsSharedState) {
        try {
          const saved = await store.getDoc('orders', orderIdFromIdempotencyKey(idempotencyKey));
          if (saved) {
            logSecurityEvent('IDEMPOTENT_ORDER_SERVED', { idempotencyKey: idempotencyKey.trim(), orderId: saved.id });
            return res.json({ success: true, order: saved, idempotent: true });
          }
        } catch {}
      }
    }

    const {
      customerName,
      customerPhone,
      userEmail,
      shippingAddress,
      items,
      couponCode,
      paymentMethod,
    } = req.body;

    // Strict COD Enforcement on Server: Reject all unsupported payment methods
    if (paymentMethod && paymentMethod !== 'cod') {
      logSecurityEvent('REJECTED_UNSUPPORTED_PAYMENT_METHOD', { paymentMethod, ip: req.ip });
      return res.status(400).json({
        error: 'Unsupported payment method. MemoPrint currently operates on Cash on Delivery (COD) only.',
      });
    }

    // Customer Name Validation
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid recipient full name.' });
    }

    // Customer Phone Validation (10-digit Indian Mobile)
    const cleanPhone = String(customerPhone || '').replace(/[^0-9]/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    // Email Validation
    const cleanEmail = String(userEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length > 200) {
      return res.status(400).json({ error: 'Please provide a valid email address for order updates.' });
    }

    // Shipping Address Validation
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return res.status(400).json({ error: 'Shipping address is required.' });
    }
    const { addressLine1, city, state, pincode } = shippingAddress;
    if (!addressLine1 || typeof addressLine1 !== 'string' || addressLine1.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide complete street/house address details.' });
    }
    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide delivery city.' });
    }
    if (!state || typeof state !== 'string' || state.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide delivery state.' });
    }
    const cleanPin = String(pincode || '').replace(/[^0-9]/g, '');
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      return res.status(400).json({ error: 'Please provide a valid 6-digit Indian PIN code.' });
    }

    // Pre-resolve all products authoritatively from catalog / Firestore
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item?.productId && !item?.builder) {
          const resolved = await resolveCatalogProduct(String(item.productId));
          if (!resolved) {
            return res.status(400).json({
              error: `Product "${item.productId}" was not found in the verified store catalog.`,
            });
          }
        }
      }
    }

    // Customer history: one-time coupons and a cap on orders per customer per hour.
    // Needs Admin mode (see README); in fallback mode these checks are skipped and logged.
    const requestedCoupon = String(couponCode || '').trim().toUpperCase();
    const couponDef: any = TRUSTED_COUPONS.find((c) => c.code === requestedCoupon);
    if (store.supportsSharedState) {
      try {
        const prior = await store.findOrdersByContact({ email: cleanEmail || undefined, phone: cleanPhone }, 20);
        const live = prior.filter((o) => o.orderStatus !== 'cancelled');
        if (couponDef?.firstOrderOnly && live.length > 0) {
          logSecurityEvent('FIRST_ORDER_COUPON_REJECTED', { coupon: requestedCoupon, phoneLast4: cleanPhone.slice(-4) });
          return res.status(400).json({ error: `The code ${requestedCoupon} is only valid on your first order.` });
        }
        const recent = prior.filter((o) => Date.parse(o.createdAt) > Date.now() - 60 * 60 * 1000);
        if (recent.length >= MAX_ORDERS_PER_CONTACT_PER_HOUR) {
          logSecurityEvent('ORDER_VELOCITY_LIMIT', { phoneLast4: cleanPhone.slice(-4), recent: recent.length });
          return res.status(429).json({ error: 'You have placed several orders in the last hour. Please wait a little before placing another.' });
        }
      } catch (err: any) {
        logSecurityEvent('ORDER_HISTORY_LOOKUP_FAILED', { error: err.message });
      }
    } else if (couponDef?.firstOrderOnly) {
      logSecurityEvent('FIRST_ORDER_COUPON_NOT_ENFORCED', { coupon: requestedCoupon, reason: `store mode ${store.mode}` });
    }

    // Authoritative Server Calculation of Items and Totals (Integer Paise)
    const calculated = calculateAuthoritativeTotals(items, couponCode);

    // Caller Authentication (Optional for guest checkouts, verified if token provided)
    const authUser = await verifyRequestAuth(req);
    // Never trust a user id sent by the browser: it is either the verified account, or a fresh guest id.
    const userId = authUser ? authUser.uid : `guest_${cleanPhone.slice(-6)}_${Date.now()}`;

    // Order ids are generated here. With an Idempotency-Key the id is derived from it, so a
    // retry after a timeout rewrites the same order instead of creating a duplicate. Ids sent
    // by the browser are ignored (they could be used to overwrite someone else's order).
    const orderId =
      idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()
        ? orderIdFromIdempotencyKey(idempotencyKey)
        : `mp_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    // Order numbers are always generated here (never taken from the client, so nobody can
    // pick or collide with another customer's number): MP-YYMMDD + 4 random digits.
    const now = new Date();
    const yymmdd = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const orderNumber = `MP-${yymmdd}${crypto.randomInt(1000, 10000)}`;

    // Build the Authoritative Order Entity:
    // - paymentMethod: 'cod' ONLY
    // - paymentStatus: 'pending' (Cash collection pending doorstep arrival)
    // - orderStatus: 'pending_confirmation'
    const finalOrder = {
      id: orderId,
      orderNumber,
      userId,
      userEmail: cleanEmail,
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      shippingAddress: {
        fullName: customerName.trim(),
        phone: cleanPhone,
        addressLine1: addressLine1.trim(),
        addressLine2: shippingAddress.addressLine2 ? String(shippingAddress.addressLine2).trim() : undefined,
        city: city.trim(),
        state: state.trim(),
        pincode: cleanPin,
        country: 'India',
        deliveryNotes: shippingAddress.deliveryNotes ? String(shippingAddress.deliveryNotes).trim().slice(0, 300) : undefined,
      },
      items: calculated.items.map((it, idx) => {
        const isBuilder = !!(it as any).builder;
        const clientPhotos = sanitizeClientPhotoUrls(items[idx]?.photoUrls || items[idx]?.photos);
        const photoUrls = isBuilder
          ? ((it as any).photoUrls as string[])
          : clientPhotos.length > 0
            ? clientPhotos
            : ['https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800'];
        return {
          productId: it.productId,
          productName: it.productName,
          size: it.size,
          finish: it.finish,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          photoUrls,
          caption: it.caption,
          notes: it.notes,
          ...(isBuilder ? { builder: (it as any).builder } : {}),
        };
      }),
      itemsCount: calculated.items.reduce((sum, it) => sum + it.quantity, 0),
      subtotal: calculated.subtotal,
      taxableAmount: calculated.taxableAmount,
      gst: calculated.gst,
      gstRate: calculated.gstRate,
      gstModel: calculated.gstModel,
      shippingCharges: calculated.shippingCharges,
      discount: calculated.discount,
      couponCode: calculated.couponCode || undefined,
      total: calculated.total,
      currency: 'INR',
      paymentMethod: 'cod' as const,
      paymentStatus: 'pending' as const,
      orderStatus: 'pending_confirmation' as const,
      orderSignature: generateOrderSignature(orderId, calculated.total, userId, 'cod'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist to Cloud Firestore. The order is only confirmed to the customer once it is
    // really saved: a failed or timed-out save returns an error (and is never cached as done).
    let created = true;
    try {
      created = await withTimeout(
        store.createDoc('orders', orderId, stripUndefined(finalOrder)),
        ORDER_WRITE_TIMEOUT_MS,
        'Saving the order timed out.'
      );
    } catch (dbErr: any) {
      logSecurityEvent('ORDER_FIRESTORE_WRITE_ERROR', { orderId, error: dbErr.message });
      return res.status(503).json({
        error: 'We could not save your order just now. You have not been charged. Please try again.',
      });
    }
    if (!created) {
      // Same Idempotency-Key arrived twice at once and the other request won: serve its order.
      const winner = await store.getDoc('orders', orderId).catch(() => null);
      if (winner) {
        return res.json({ success: true, order: winner, idempotent: true });
      }
    }

    // Cache in idempotency store (only after a successful save)
    if (idempotencyKey && typeof idempotencyKey === 'string') {
      idempotencyOrderMap.set(idempotencyKey.trim(), {
        order: finalOrder,
        createdAt: Date.now(),
      });
    }

    logSecurityEvent('COD_ORDER_CREATED_SUCCESS', {
      orderId,
      orderNumber,
      userId,
      total: finalOrder.total,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
    });

    return res.status(201).json({
      success: true,
      order: finalOrder,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Order creation failed.' });
  }
});

// ----------------------------------------------------
// Cryptographic Guest Session Minting
// ----------------------------------------------------
apiRouter.post('/session/guest', (req, res) => {
  const { sessionId, sessionToken } = generateSignedGuestSession();
  res.setHeader(
    'Set-Cookie',
    `memo_guest_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}; Max-Age=${30 * 24 * 3600}`
  );
  return res.json({
    success: true,
    sessionId,
    sessionToken,
  });
});

// ----------------------------------------------------
// 2. Persistent Photo Upload (Protected & Rate Limited)
// ----------------------------------------------------
apiRouter.post('/upload', createRateLimiter(40, 60000, 'upload'), async (req, res) => {
  try {
    const authUser = await verifyRequestAuth(req);
    if (!authUser) {
      logSecurityEvent('UNAUTHORIZED_UPLOAD_ATTEMPT', { ip: req.ip });
      return res.status(401).json({ error: 'Authentication required to upload photos.' });
    }

    const { fileData, fileName, isPublic: requestedPublic, hash } = req.body;
    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'No image data received.' });
    }

    // Distinguish public catalog media vs private customer uploads:
    // Only authorized admins can mark uploaded media as public catalog assets.
    // Customer uploads are strictly private by default.
    const isPublic = isAuthorizedAdmin(authUser) && requestedPublic === true;
    const visibility: 'public' | 'private' = isPublic ? 'public' : 'private';

    const result = await saveToPersistentMediaStore(fileData, fileName, authUser.uid, visibility, hash);

    return res.json({
      success: true,
      id: result.id,
      url: result.url,
      canonicalUrl: result.canonicalUrl,
      fileName: result.fileName,
      sizeBytes: result.sizeBytes,
      mime: result.mime,
      visibility: result.visibility,
      isDuplicate: result.isDuplicate || false,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to process uploaded photo.' });
  }
});

// ----------------------------------------------------
// 3. Bulk Upload: Requires Administrator Authorization
// ----------------------------------------------------
apiRouter.post('/upload-bulk', createRateLimiter(20, 60000, 'upload_bulk'), async (req, res) => {
  try {
    const authUser = await verifyRequestAuth(req);
    if (!authUser) {
      logSecurityEvent('UNAUTHENTICATED_BULK_UPLOAD', { ip: req.ip });
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!isAuthorizedAdmin(authUser)) {
      logSecurityEvent('FORBIDDEN_BULK_UPLOAD_ATTEMPT', { ip: req.ip, email: authUser.email });
      return res.status(403).json({ 
        error: 'Forbidden: Administrator privileges required for bulk product uploads.' 
      });
    }

    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for bulk upload.' });
    }

    if (files.length > 30) {
      return res.status(400).json({ error: 'Bulk upload batch cannot exceed 30 files at once.' });
    }

    const uploadedResults: Array<{ id: string; url: string; canonicalUrl: string; fileName: string; sizeBytes: number; visibility: string; isDuplicate?: boolean }> = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const item = await saveToPersistentMediaStore(f.fileData, f.fileName, authUser.uid, 'public', f.hash);
        uploadedResults.push({
          id: item.id,
          url: item.url,
          canonicalUrl: item.canonicalUrl,
          fileName: item.fileName,
          sizeBytes: item.sizeBytes,
          visibility: item.visibility,
          isDuplicate: item.isDuplicate || false,
        });
      } catch (err: any) {
        errors.push(`File ${i + 1}: ${err.message}`);
      }
    }

    return res.json({
      success: uploadedResults.length > 0,
      uploadedCount: uploadedResults.length,
      files: uploadedResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process bulk upload batch: ' + err.message });
  }
});

// ----------------------------------------------------
// 4. Admin Security Verification & Protected Operations
// ----------------------------------------------------
apiRouter.get('/admin/verify', async (req, res) => {
  const authUser = await verifyRequestAuth(req);
  if (!authUser || !isAuthorizedAdmin(authUser)) {
    return res.status(403).json({ 
      authorized: false, 
      error: 'Forbidden: Restricted to authorized administrator sukeshkavin@gmail.com' 
    });
  }
  return res.json({ 
    authorized: true, 
    email: authUser.email, 
    uid: authUser.uid 
  });
});

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, store: store.mode, fileStorage: store.supportsBlobs, sharedState: store.supportsSharedState });
});

// Lets the browser know how large an upload the server will accept.
apiRouter.get('/config', (_req, res) => {
  res.json({ maxImageBytes: store.supportsBlobs ? MAX_BLOB_IMAGE_BYTES : MAX_FIRESTORE_DOC_IMAGE_BYTES });
});

apiRouter.get('/admin/orders', async (req, res) => {
  const authUser = await verifyRequestAuth(req);
  if (!authUser || !isAuthorizedAdmin(authUser)) {
    return res.status(403).json({ error: 'Forbidden: Administrator access required.' });
  }

  try {
    const orders = await store.listDocs('orders');
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ success: true, count: orders.length, orders });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve orders: ' + err.message });
  }
});

// Valid Order & Payment Status State Transitions
export const VALID_ORDER_STATUSES = ['pending_confirmation', 'confirmed', 'printing', 'shipped', 'delivered', 'cancelled'];
export const VALID_ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['printing', 'cancelled'],
  printing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
export const VALID_PAYMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'failed'],
  paid: ['refunded'],
  failed: ['pending'],
  refunded: [],
};

apiRouter.post('/admin/orders/:id/status', async (req, res) => {
  const authUser = await verifyRequestAuth(req);
  if (!authUser || !isAuthorizedAdmin(authUser)) {
    logSecurityEvent('UNAUTHORIZED_ADMIN_STATUS_CHANGE', { ip: req.ip, email: authUser?.email });
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }

  const { id } = req.params;
  const { status, paymentStatus, trackingNumber, trackingCourier } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Order ID is required.' });
  }

  let currentOrder: any = null;
  try {
    currentOrder = await store.getDoc('orders', id);
  } catch {}

  const updates: any = { updatedAt: new Date().toISOString() };

  if (status) {
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid order status "${status}". Allowed statuses: ${VALID_ORDER_STATUSES.join(', ')}` 
      });
    }

    if (currentOrder) {
      const currentStatus = currentOrder.orderStatus || 'pending_confirmation';
      const allowed = VALID_ORDER_STATUS_TRANSITIONS[currentStatus] || [];
      if (status !== currentStatus && !allowed.includes(status)) {
        return res.status(400).json({
          error: `Invalid status transition: Cannot transition order from "${currentStatus}" to "${status}". Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (order is in final terminal state)'}`,
        });
      }
    }

    updates.orderStatus = status;
    // CRITICAL SECURITY ENFORCEMENT:
    // Do NOT automatically mark an order as paid simply because it was placed, confirmed, shipped, or marked delivered!
    logSecurityEvent('ORDER_LIFECYCLE_STATUS_UPDATED', {
      orderId: id,
      newStatus: status,
      adminEmail: authUser.email,
    });
  }

  // Payment status changes to 'paid' ONLY after authorized admin confirms cash was collected
  if (paymentStatus) {
    if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return res.status(400).json({ 
        error: `Invalid payment status "${paymentStatus}". Allowed statuses: ${VALID_PAYMENT_STATUSES.join(', ')}` 
      });
    }

    if (currentOrder) {
      const currentPay = currentOrder.paymentStatus || 'pending';
      const allowedPay = VALID_PAYMENT_STATUS_TRANSITIONS[currentPay] || [];
      if (paymentStatus !== currentPay && !allowedPay.includes(paymentStatus)) {
        return res.status(400).json({
          error: `Invalid payment transition: Cannot transition payment from "${currentPay}" to "${paymentStatus}". Allowed transitions: ${allowedPay.length > 0 ? allowedPay.join(', ') : 'none (terminal state)'}`,
        });
      }
    }

    if (paymentStatus === 'paid') {
      updates.paymentStatus = 'paid';
      updates.paidAt = new Date().toISOString();
      updates.cashCollectedConfirmedBy = authUser.email;

      logSecurityEvent('COD_CASH_COLLECTION_CONFIRMED', {
        orderId: id,
        adminEmail: authUser.email,
        paidAt: updates.paidAt,
      });
    } else {
      updates.paymentStatus = paymentStatus;
    }
  }

  if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
  if (trackingCourier !== undefined) updates.trackingCourier = trackingCourier;

  try {
    await store.updateDoc('orders', id, updates);
    return res.json({ success: true, updated: updates });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to update order status: ' + e.message });
  }
});

// ----------------------------------------------------
// 5. Payment Gateway Deprecation (COD ONLY)
// ----------------------------------------------------
// All legacy payment gateway endpoints are strictly rejected on the server
apiRouter.all('/payments/*', (_req, res) => {
  return res.status(400).json({
    error: 'Online payment gateways and simulations have been removed. MemoPrint accepts Cash on Delivery (COD) only.',
  });
});

// ----------------------------------------------------
// 6. Persistent Media Serving & Access Control
// ----------------------------------------------------
// Rigorous Authorization-First Architecture:
// 1. Load authoritative metadata (from memory or Firestore)
// 2. If metadata missing for customer upload: return 404 immediately (fail-closed, never trust disk)
// 3. If private: verify signed token, owner UID, or admin BEFORE reading/sending any bytes
// 4. Only AFTER authorization succeeds: retrieve and serve bytes with strict private no-cache headers
apiRouter.get('/images/:id', async (req, res) => {
  const { id } = req.params;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) {
    return res.status(400).json({ error: 'Invalid image ID.' });
  }

  // 1. AUTHORIZATION FIRST: Load authoritative metadata
  const meta = await getAuthoritativeMediaMetadata(cleanId);
  if (!meta) {
    return res.status(404).json({ error: 'Image not found.' });
  }

  // 2. AUTHORIZE: If private, verify authorization BEFORE reading or serving bytes
  if (meta.visibility === 'private') {
    let authorized = false;

    // Check signed token query parameter (?token=...)
    const tokenQuery = req.query.token as string;
    if (tokenQuery && verifySignedImageToken(cleanId, meta.uploadedBy, tokenQuery)) {
      authorized = true;
    }

    // Check authenticated user header or signed session
    if (!authorized) {
      const authUser = await verifyRequestAuth(req);
      const isOwner = authUser && authUser.uid === meta.uploadedBy;
      const isAdmin = authUser && isAuthorizedAdmin(authUser);
      if (isOwner || isAdmin) {
        authorized = true;
      }
    }

    if (!authorized) {
      logSecurityEvent('UNAUTHORIZED_PRIVATE_MEDIA_ACCESS', { mediaId: cleanId, ip: req.ip });
      return res.status(403).json({ error: 'Forbidden: Private media asset. Access restricted to owner or admin.' });
    }
  }

  // 3. RETRIEVE BYTES: Only AFTER authorization has passed
  let buffer: Buffer | null = null;
  const cached = mediaMemoryCache.get(cleanId);
  if (cached?.buffer) {
    buffer = cached.buffer;
  } else {
    // Check local disk cache
    for (const ext of ['.webp', '.jpg', '.png']) {
      const filePath = path.join(uploadsDir, `${cleanId}${ext}`);
      if (fs.existsSync(filePath)) {
        try {
          buffer = fs.readFileSync(filePath);
          break;
        } catch {}
      }
    }
    // Persistent fallback: Cloud Storage file or Firestore document data
    if (!buffer) {
      buffer = await loadMediaBytes(cleanId);
    }
  }

  if (!buffer) {
    return res.status(404).json({ error: 'Image data could not be retrieved.' });
  }

  setMediaCacheHeaders(res, meta.visibility, meta.mime);
  return res.send(buffer);
});

apiRouter.head('/images/:id', async (req, res) => {
  const { id } = req.params;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) return res.status(400).end();

  const meta = await getAuthoritativeMediaMetadata(cleanId);
  if (!meta) {
    return res.status(404).end();
  }

  if (meta.visibility === 'private') {
    let authorized = false;
    const tokenQuery = req.query.token as string;
    if (tokenQuery && verifySignedImageToken(cleanId, meta.uploadedBy, tokenQuery)) {
      authorized = true;
    }
    if (!authorized) {
      const authUser = await verifyRequestAuth(req);
      const isOwner = authUser && authUser.uid === meta.uploadedBy;
      const isAdmin = authUser && isAuthorizedAdmin(authUser);
      if (isOwner || isAdmin) {
        authorized = true;
      }
    }
    if (!authorized) {
      return res.status(403).end();
    }
  }

  res.setHeader('Content-Type', meta.mime);
  return res.status(200).end();
});

// ----------------------------------------------------
// App Server Setup
// ----------------------------------------------------
const app = express();
// Number of reverse proxies in front of the app (Cloud Run / most hosts: 1). Set to 0 if none.
app.set('trust proxy', Number.isFinite(Number(process.env.TRUST_PROXY_HOPS)) && process.env.TRUST_PROXY_HOPS !== undefined ? Number(process.env.TRUST_PROXY_HOPS) : 1);
function resolvePort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const p = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(p) && p > 0) return p;
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return 3000;
}
const PORT = resolvePort();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint for Cloud Run container probes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Backward-compatible static /uploads handler with persistent fallback and access control
app.get('/uploads/:fileName', async (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const cleanId = fileName.replace(/\.[a-zA-Z0-9]+$/, '');
  const isCustomerPhoto = /^(img_|photo_)/.test(fileName);

  // If customer photo pattern: REQUIRE authoritative metadata and authorization FIRST!
  if (isCustomerPhoto) {
    const meta = await getAuthoritativeMediaMetadata(cleanId);
    if (!meta) {
      // FAIL-CLOSED: Disk existence is NOT sufficient!
      return res.status(404).json({ error: 'Image metadata not found.' });
    }

    if (meta.visibility === 'private') {
      let authorized = false;
      const tokenQuery = req.query.token as string;
      if (tokenQuery && verifySignedImageToken(cleanId, meta.uploadedBy, tokenQuery)) {
        authorized = true;
      }
      if (!authorized) {
        const authUser = await verifyRequestAuth(req);
        const isOwner = authUser && authUser.uid === meta.uploadedBy;
        const isAdmin = authUser && isAuthorizedAdmin(authUser);
        if (isOwner || isAdmin) {
          authorized = true;
        }
      }

      if (!authorized) {
        logSecurityEvent('UNAUTHORIZED_PRIVATE_UPLOADS_ACCESS', { fileName, ip: req.ip });
        return res.status(403).json({ error: 'Forbidden: Private media asset. Access restricted to owner or admin.' });
      }
    }

    // Authorized: Serve bytes (from memory, disk, or Firestore)
    const cached = mediaMemoryCache.get(cleanId);
    if (cached?.buffer) {
      setMediaCacheHeaders(res, meta.visibility, meta.mime);
      return res.send(cached.buffer);
    }

    const diskPath = path.join(uploadsDir, fileName);
    if (fs.existsSync(diskPath)) {
      setMediaCacheHeaders(res, meta.visibility, meta.mime);
      return res.sendFile(diskPath, { cacheControl: false });
    }

    // Fallback: load from durable storage
    {
      const stored = await loadMediaBytes(cleanId);
      if (stored) {
        setMediaCacheHeaders(res, meta.visibility, meta.mime);
        return res.send(stored);
      }
    }

    return res.status(404).json({ error: 'Image file could not be read.' });
  }

  // Non-customer static asset (e.g. placeholder, logo, UI asset)
  const safeStaticPath = path.join(uploadsDir, fileName);
  if (fs.existsSync(safeStaticPath)) {
    return res.sendFile(safeStaticPath);
  }

  return res.status(404).json({ error: 'File not found.' });
});

// Mount Backend API
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[SERVER-ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred.',
  });
});

async function startServer() {
  await initDataStore();
  void syncFirestoreCatalog();
  const isDev = isDevMode;

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { index: false }));
      app.get('*', (req, res) => {
        const indexHtml = path.join(distPath, 'index.html');
        if (!fs.existsSync(indexHtml)) {
          return res.status(200).send('MemoPrint App is starting up. Run "npm run build" first.');
        }
        // Share previews need absolute URLs: use SITE_URL if set, else this request's origin.
        const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
        const html = fs.readFileSync(indexHtml, 'utf8').split('__SITE_URL__').join(siteUrl);
        res.type('html').send(html);
      });
    } else {
      app.get('*', (_req, res) => {
        res.status(200).send('MemoPrint App is starting up. Run "npm run build" first.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MemoPrint server running on http://0.0.0.0:${PORT}`);
  });
}

const isMainEntry = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('/server.ts') ||
   process.argv[1].endsWith('/server.js') ||
   process.argv[1] === 'server.ts' ||
   process.argv[1] === 'server.js')
);

if (isMainEntry && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start MemoPrint server:', err);
    process.exit(1);
  });
}

export default app;
