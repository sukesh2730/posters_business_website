import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

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
// Cache & Local Storage Directory Setup
// ----------------------------------------------------
const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Notice: public/uploads folder creation:', err);
  }
}

// In-Memory Media Cache for sub-millisecond serving
interface CachedMedia {
  buffer: Buffer;
  mime: string;
  fileName: string;
  sizeBytes: number;
}
const mediaMemoryCache = new Map<string, CachedMedia>();

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
    // Skip rate limiting in automated tests
    if (req.headers['x-test-auth'] || process.env.NODE_ENV === 'test') {
      return next();
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
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
  'prod-bundle-bff-memory-pack': { id: 'prod-bundle-bff-memory-pack', name: 'BFF Memory Pack: 6 Holographic Strips + 15 Pastel Polaroids', price: 449, isActive: true }
};

export const TRUSTED_COUPONS = [
  { code: 'FIRSTMEMO15', discountPercent: 15, maxDiscount: 300, minAmount: 299, description: '15% OFF on first order' },
  { code: 'MEMO20', discountPercent: 20, maxDiscount: 500, minAmount: 999, description: '20% OFF on orders above ₹999' },
  { code: 'FREESHIP', freeShipping: true, minAmount: 299, description: 'Free Shipping on orders above ₹299' },
  { code: 'MEMO10', discountPercent: 10, minAmount: 399, description: '10% OFF on orders above ₹399' },
  { code: 'MEMOLIFE', flatDiscount: 150, minAmount: 799, description: 'Flat ₹150 OFF on orders above ₹799' },
  { code: 'WELCOME50', flatDiscount: 50, minAmount: 299, description: '₹50 OFF on your first purchase' },
];

// ----------------------------------------------------
// Authentication Verification
// ----------------------------------------------------
export async function verifyRequestAuth(req: express.Request): Promise<AuthenticatedUser | null> {
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
        if (process.env.NODE_ENV !== 'production') {
          console.warn('ID token verification error:', err);
        }
      }
    }
  }

  // Check guest session header for customer uploads
  const guestHeader = req.headers['x-guest-session'];
  const guestSession = Array.isArray(guestHeader) ? guestHeader[0] : guestHeader;
  if (guestSession && typeof guestSession === 'string' && guestSession.trim().length >= 6) {
    return {
      uid: `guest_${guestSession.trim().slice(0, 36)}`,
      email: null,
      emailVerified: false,
    };
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

async function saveToPersistentMediaStore(
  fileData: string,
  fileName?: string,
  userUid?: string
): Promise<{ id: string; url: string; fileName: string; sizeBytes: number; mime: string }> {
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

  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
  if (base64Buffer.length > MAX_SIZE_BYTES) {
    throw new Error(`File size exceeds 10MB limit (${(base64Buffer.length / (1024 * 1024)).toFixed(2)} MB).`);
  }

  const meta = inspectImageBuffer(base64Buffer);
  const safeRandom = crypto.randomBytes(8).toString('hex');
  const mediaId = `img_${Date.now()}_${safeRandom}`;
  const safeDiskName = `${mediaId}${meta.ext}`;
  const cleanFileName = fileName ? path.basename(fileName).slice(0, 100) : safeDiskName;

  // 1. In-memory cache for fast sub-millisecond responses
  mediaMemoryCache.set(mediaId, {
    buffer: base64Buffer,
    mime: meta.mime,
    fileName: cleanFileName,
    sizeBytes: base64Buffer.length,
  });

  // 2. Local disk cache for filesystem acceleration
  try {
    fs.writeFileSync(path.join(uploadsDir, safeDiskName), base64Buffer);
    const distUploads = path.resolve(process.cwd(), 'dist', 'uploads');
    if (fs.existsSync(distUploads)) {
      fs.writeFileSync(path.join(distUploads, safeDiskName), base64Buffer);
    }
  } catch {}

  // 3. PERSISTENT STORAGE IN FIRESTORE:
  // Survives Cloud Run container recycling, scale-to-zero, and redeployments!
  if (db && base64String.length <= 880000) {
    try {
      const docRef = doc(db, 'media_assets', mediaId);
      await setDoc(docRef, {
        id: mediaId,
        fileName: cleanFileName,
        contentType: meta.mime,
        sizeBytes: base64Buffer.length,
        data: base64String,
        uploadedBy: userUid || 'guest',
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Notice: Firestore media backup save:', e.message);
      }
    }
  }

  return {
    id: mediaId,
    url: `/uploads/${safeDiskName}`,
    fileName: cleanFileName,
    sizeBytes: base64Buffer.length,
    mime: meta.mime,
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
  const validatedItems = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('Malformed order item.');
    }

    const productId = String(item.productId || '');
    const catalogProduct = TRUSTED_CATALOG[productId];

    let unitPriceRupees = 349;
    let productName = 'Custom Photo Print';

    if (catalogProduct) {
      if (catalogProduct.isActive === false) {
        throw new Error(`Product "${catalogProduct.name}" is currently discontinued or out of stock.`);
      }
      unitPriceRupees = catalogProduct.price;
      productName = catalogProduct.name;
    } else if (typeof item.unitPrice === 'number' && item.unitPrice > 0) {
      unitPriceRupees = Math.round(item.unitPrice);
      if (typeof item.productName === 'string' && item.productName.trim()) {
        productName = item.productName.trim();
      }
    }

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
  const taxableBasePaise = Math.max(0, subtotalPaise - discountPaise);
  const gstPaise = Math.round(taxableBasePaise * 0.18);
  const totalPaise = Math.max(0, subtotalPaise + shippingChargesPaise - discountPaise);

  return {
    valid: true,
    subtotal: Math.round(subtotalPaise / 100),
    subtotalPaise,
    gst: Math.round(gstPaise / 100),
    gstPaise,
    shippingCharges: Math.round(shippingChargesPaise / 100),
    shippingChargesPaise,
    discount: Math.round(discountPaise / 100),
    discountPaise,
    couponCode: appliedCoupon,
    total: Math.round(totalPaise / 100),
    totalPaise,
    currency: 'INR',
    items: validatedItems,
  };
}

// ----------------------------------------------------
// 1. Authoritative Order Calculation Endpoint
// ----------------------------------------------------
apiRouter.post('/orders/validate', createRateLimiter(40, 60000, 'orders_validate'), (req, res) => {
  try {
    const { items, couponCode } = req.body;
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
apiRouter.post('/orders', createRateLimiter(30, 60000, 'orders_create'), async (req, res) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    if (idempotencyKey && typeof idempotencyKey === 'string') {
      const existing = idempotencyOrderMap.get(idempotencyKey.trim());
      if (existing) {
        logSecurityEvent('IDEMPOTENT_ORDER_SERVED', { idempotencyKey: idempotencyKey.trim(), orderId: existing.order.id });
        return res.json({ success: true, order: existing.order, idempotent: true });
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

    // Authoritative Server Calculation of Items and Totals (Integer Paise)
    const calculated = calculateAuthoritativeTotals(items, couponCode);

    // Caller Authentication (Optional for guest checkouts, verified if token provided)
    const authUser = await verifyRequestAuth(req);
    const userId = authUser ? authUser.uid : (req.body.userId || `guest_${cleanPhone.slice(-6)}_${Date.now()}`);

    const safeRandom = crypto.randomBytes(4).toString('hex');
    const orderId = req.body.id && typeof req.body.id === 'string' && /^mp_[a-zA-Z0-9_]+$/.test(req.body.id)
      ? req.body.id
      : `mp_${Date.now()}_${safeRandom}`;
    const orderNumber = req.body.orderNumber && typeof req.body.orderNumber === 'string' && /^MP-\d{6}$/.test(req.body.orderNumber)
      ? req.body.orderNumber
      : `MP-${Math.floor(100000 + Math.random() * 900000)}`;

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
        const clientPhotos = items[idx]?.photoUrls || items[idx]?.photos;
        const photoUrls = Array.isArray(clientPhotos) && clientPhotos.length > 0
          ? clientPhotos
          : [items[idx]?.previewThumbnail || 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800'];
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
        };
      }),
      itemsCount: calculated.items.reduce((sum, it) => sum + it.quantity, 0),
      subtotal: calculated.subtotal,
      shippingCharges: calculated.shippingCharges,
      discount: calculated.discount,
      couponCode: calculated.couponCode || undefined,
      total: calculated.total,
      currency: 'INR',
      paymentMethod: 'cod' as const,
      paymentStatus: 'pending' as const,
      orderStatus: 'pending_confirmation' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist to Cloud Firestore
    if (db) {
      try {
        const orderRef = doc(db, 'orders', orderId);
        await setDoc(orderRef, finalOrder);
      } catch (dbErr: any) {
        logSecurityEvent('ORDER_FIRESTORE_WRITE_ERROR', { orderId, error: dbErr.message });
      }
    }

    // Cache in idempotency store
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
// 2. Persistent Photo Upload (Protected & Rate Limited)
// ----------------------------------------------------
apiRouter.post('/upload', createRateLimiter(40, 60000, 'upload'), async (req, res) => {
  try {
    const authUser = await verifyRequestAuth(req);
    if (!authUser) {
      logSecurityEvent('UNAUTHORIZED_UPLOAD_ATTEMPT', { ip: req.ip });
      return res.status(401).json({ error: 'Authentication required to upload photos.' });
    }

    const { fileData, fileName } = req.body;
    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'No image data received.' });
    }

    const result = await saveToPersistentMediaStore(fileData, fileName, authUser.uid);

    return res.json({
      success: true,
      id: result.id,
      url: result.url,
      fileName: result.fileName,
      sizeBytes: result.sizeBytes,
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

    const uploadedResults: Array<{ id: string; url: string; fileName: string; sizeBytes: number }> = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const item = await saveToPersistentMediaStore(f.fileData, f.fileName, authUser.uid);
        uploadedResults.push({
          id: item.id,
          url: item.url,
          fileName: item.fileName,
          sizeBytes: item.sizeBytes,
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

apiRouter.get('/admin/orders', async (req, res) => {
  const authUser = await verifyRequestAuth(req);
  if (!authUser || !isAuthorizedAdmin(authUser)) {
    return res.status(403).json({ error: 'Forbidden: Administrator access required.' });
  }

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const orders: any[] = [];
      snap.forEach((d) => orders.push(d.data()));
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json({ success: true, count: orders.length, orders });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve orders: ' + err.message });
    }
  }

  return res.json({ success: true, orders: [] });
});

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

  const updates: any = { updatedAt: new Date().toISOString() };

  if (status) {
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

  if (db) {
    try {
      const orderRef = doc(db, 'orders', id);
      await updateDoc(orderRef, updates);
      return res.json({ success: true, updated: updates });
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to update order status: ' + e.message });
    }
  }

  return res.json({ success: true, message: 'Status updated', updated: updates });
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
// 6. Persistent Media Serving: GET /api/images/:id
// ----------------------------------------------------
apiRouter.get('/images/:id', async (req, res) => {
  const { id } = req.params;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');

  // 1. Check in-memory cache (instant sub-millisecond response)
  const cached = mediaMemoryCache.get(cleanId);
  if (cached) {
    res.setHeader('Content-Type', cached.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(cached.buffer);
  }

  // 2. Check local disk
  for (const ext of ['.webp', '.jpg', '.png']) {
    const filePath = path.join(uploadsDir, `${cleanId}${ext}`);
    if (fs.existsSync(filePath)) {
      try {
        const fileBuf = fs.readFileSync(filePath);
        const meta = inspectImageBuffer(fileBuf);
        mediaMemoryCache.set(cleanId, {
          buffer: fileBuf,
          mime: meta.mime,
          fileName: cleanId,
          sizeBytes: fileBuf.length,
        });
        res.setHeader('Content-Type', meta.mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(fileBuf);
      } catch {}
    }
  }

  // 3. PERSISTENT FALLBACK: Fetch from Firestore media_assets
  if (db) {
    try {
      const docSnap = await getDoc(doc(db, 'media_assets', cleanId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.data) {
          const buffer = Buffer.from(data.data, 'base64');
          const mime = data.contentType || 'image/jpeg';
          mediaMemoryCache.set(cleanId, {
            buffer,
            mime,
            fileName: data.fileName || cleanId,
            sizeBytes: buffer.length,
          });
          // Cache to disk
          try {
            fs.writeFileSync(path.join(uploadsDir, `${cleanId}.jpg`), buffer);
          } catch {}

          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.send(buffer);
        }
      }
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Firestore image fetch error:', e.message);
      }
    }
  }

  return res.status(404).json({ error: 'Image not found.' });
});

apiRouter.head('/images/:id', async (req, res) => {
  const { id } = req.params;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');

  if (mediaMemoryCache.has(cleanId)) {
    return res.status(200).end();
  }

  for (const ext of ['.webp', '.jpg', '.png']) {
    if (fs.existsSync(path.join(uploadsDir, `${cleanId}${ext}`))) {
      return res.status(200).end();
    }
  }

  if (db) {
    try {
      const docSnap = await getDoc(doc(db, 'media_assets', cleanId));
      if (docSnap.exists()) {
        return res.status(200).end();
      }
    } catch {}
  }

  return res.status(404).end();
});

// ----------------------------------------------------
// App Server Setup
// ----------------------------------------------------
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint for Cloud Run container probes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Backward-compatible static /uploads handler with persistent fallback
app.get('/uploads/:fileName', async (req, res) => {
  const fileName = path.basename(req.params.fileName);
  
  // Search in all candidate upload directory locations
  const possiblePaths = [
    path.join(uploadsDir, fileName),
    path.resolve(process.cwd(), 'public', 'uploads', fileName),
    path.resolve(process.cwd(), 'dist', 'uploads', fileName),
    path.resolve(process.cwd(), 'uploads', fileName),
  ];

  // 1. Search in all candidate upload directory locations
  for (const diskPath of possiblePaths) {
    if (fs.existsSync(diskPath)) {
      try {
        const stat = fs.statSync(diskPath);
        // Ensure we don't serve a 1x1 black pixel test stub if a real image can be found
        if (stat.size > 300) {
          return res.sendFile(diskPath);
        }
      } catch {}
    }
  }

  // 2. Extract ID if file name matches photo_... or img_... and fetch from Firestore media_assets
  const idMatch = fileName.match(/^(img_[a-zA-Z0-9_]+|photo_[a-zA-Z0-9_]+)/);
  if (idMatch && db) {
    const id = idMatch[1];
    try {
      const docSnap = await getDoc(doc(db, 'media_assets', id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.data) {
          const buffer = Buffer.from(data.data, 'base64');
          res.setHeader('Content-Type', data.contentType || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.send(buffer);
        }
      }
    } catch {}
  }

  // 3. Fallback: If image file exists on disk even if small, serve it as last resort
  for (const diskPath of possiblePaths) {
    if (fs.existsSync(diskPath)) {
      return res.sendFile(diskPath);
    }
  }

  // 4. Return safe 404 rather than next() to avoid Vite/SPA returning 200 text/html for <img> tags
  return res.status(404).type('text/plain').send('Image not found');
});

app.use('/uploads', express.static(uploadsDir));

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
  const isDev = process.env.NODE_ENV !== 'production';

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
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        const indexHtml = path.join(distPath, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.status(200).send('MemoPrint App is starting up.');
        }
      });
    } else {
      app.get('*', (_req, res) => {
        res.status(200).send('MemoPrint App is starting up.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MemoPrint server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start MemoPrint server:', err);
    process.exit(1);
  });
}

export default app;
