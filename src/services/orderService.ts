import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth, storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';
import { Order, Product } from '../types';
import { DEFAULT_PRODUCTS, AVAILABLE_COUPONS } from '../data/defaultProducts';
import { optimizeImageForUpload } from '../utils/imageOptimization';

// 1. Authoritative Server-side order calculation & price validation (No online payment gateway needed)
export async function validateServerOrderTotals(payload: {
  items: any[];
  couponCode?: string;
  discount?: number;
}) {
  const baseUrl = typeof window !== 'undefined' ? '' : (process.env.INTERNAL_API_URL || 'http://localhost:3000');
  const res = await fetch(`${baseUrl}/api/orders/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: payload.items,
      couponCode: payload.couponCode,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to validate order totals on server.');
  }

  return await res.json();
}

/**
 * Fast client-side image compression and resizing./**
 * Canonical image downscaler delegating to the unified imageOptimization engine.
 * Downscales images exceeding maxDimension (1920px) and converts to optimized WebP/JPEG/PNG.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1920,
  quality = 0.85
): Promise<File> {
  const result = await optimizeImageForUpload(file, { maxDimension, initialQuality: quality });
  return result.file;
}

export function getGuestSessionId(): string {
  if (typeof window === 'undefined') return 'guest_default_session';
  try {
    let id = sessionStorage.getItem('memo_guest_session_id');
    if (!id) {
      id = `guest_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      sessionStorage.setItem('memo_guest_session_id', id);
    }
    return id;
  } catch {
    return 'guest_fallback_session';
  }
}

import { uploadPhotoPersistently } from './persistentStorage';

// 2. Resumable client photo upload helper with persistent Firestore & cache storage
export async function uploadPhotoToFirebaseStorage(
  file: File, 
  folder = 'products',
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const isPublic = folder === 'products' || folder === 'catalog';
  const result = await uploadPhotoPersistently(file, { onProgress, folder, isPublic });
  return result.url;
}

// 2b. Server photo upload helper with persistent Firestore & cache storage
export async function uploadCustomPhoto(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const result = await uploadPhotoPersistently(file, { onProgress, folder: 'customer_uploads', isPublic: false });
  return result.url;
}

// 3. Bulk photo upload helper for Admin collection import with Firebase Auth token
export async function bulkUploadCustomPhotos(files: File[]): Promise<Array<{ url: string; fileName: string }>> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);

  const { optimizeImageForUpload } = await import('../utils/imageOptimization');
  const { blobToBase64 } = await import('./persistentStorage');

  const optimizedFiles = await Promise.all(
    files.map(async (file) => {
      try {
        const opt = await optimizeImageForUpload(file);
        return {
          fileData: opt.dataUri,
          fileName: file.name,
          fileType: opt.mimeType,
          hash: opt.hash,
        };
      } catch {
        const base64Data = await blobToBase64(file);
        return {
          fileData: `data:${file.type || 'image/jpeg'};base64,${base64Data}`,
          fileName: file.name,
          fileType: file.type || 'image/jpeg',
        };
      }
    })
  );

  const res = await fetch('/api/upload-bulk', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({ files: optimizedFiles }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to process bulk upload.');
  }

  const json = await res.json();
  return json.files;
}

// Helper to recursively sanitize data and strip undefined properties for Firestore
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}

// 4. Save order to Firestore with enforced initial status constraints
export async function saveOrderToFirestore(order: Order): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    const cleanOrder = sanitizeFirestoreData(order);
    
    // Strict initial COD status integrity
    cleanOrder.orderStatus = 'pending_confirmation';
    cleanOrder.paymentStatus = 'pending';
    cleanOrder.paymentMethod = 'cod';
    if (auth.currentUser?.uid) {
      cleanOrder.userId = auth.currentUser.uid;
    }

    await setDoc(doc(db, 'orders', order.id), cleanOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// 5. Get orders for specific authenticated customer
export async function getCustomerOrders(userId: string): Promise<Order[]> {
  const path = 'orders';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const orders: Order[] = [];
    snap.forEach((d) => {
      orders.push(d.data() as Order);
    });
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// 6. Admin: Get all orders across the store
export async function getAllOrdersForAdmin(): Promise<Order[]> {
  const path = 'orders';
  try {
    const snap = await getDocs(collection(db, path));
    const orders: Order[] = [];
    snap.forEach((d) => {
      orders.push(d.data() as Order);
    });
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// 7. Admin: Update order status, courier tracking & confirmed cash payment
export async function updateOrderStatusByAdmin(
  orderId: string, 
  orderStatus: Order['orderStatus'], 
  paymentStatus?: Order['paymentStatus'],
  trackingNumber?: string,
  trackingCourier?: string
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const updatePayload: any = {
      orderStatus,
      updatedAt: new Date().toISOString()
    };
    if (paymentStatus) {
      updatePayload.paymentStatus = paymentStatus;
      if (paymentStatus === 'paid') {
        updatePayload.paidAt = new Date().toISOString();
        updatePayload.cashCollectedConfirmedBy = auth.currentUser?.email || 'sukeshkavin@gmail.com';
      }
    }
    if (trackingNumber !== undefined) updatePayload.trackingNumber = trackingNumber;
    if (trackingCourier !== undefined) updatePayload.trackingCourier = trackingCourier;

    // Send through server-side verification endpoint
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (token) {
      await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: orderStatus,
          paymentStatus,
          trackingNumber,
          trackingCourier,
        }),
      }).catch(() => null);
    }

    await updateDoc(doc(db, 'orders', orderId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export const DEFAULT_FALLBACK_PRODUCT_IMAGE = 
  'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80';

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  polaroids: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80',
  'photo-strips': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
  posters: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
  frames: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
  vintage: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
  pastel: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=800&auto=format&fit=crop&q=80',
  gifts: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
  bundles: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80',
};

/**
 * Universal helper to extract and sanitize a valid image URL for any product record.
 * Handles diverse field names from Firestore documents (imageUrl, image, images[], photoUrl, url, thumbnailUrl).
 * Guarantees that no product renders as a black box or missing image.
 */
export function resolveProductImageUrl(product: Partial<Product> | null | undefined): string {
  if (!product) return DEFAULT_FALLBACK_PRODUCT_IMAGE;

  const rawUrl =
    product.imageUrl ||
    (product as any).image ||
    (Array.isArray(product.images) && product.images.length > 0 && product.images[0]) ||
    (product as any).photoUrl ||
    (product as any).url ||
    (product as any).thumbnailUrl;

  if (typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('uploads/')) {
      return `/${trimmed}`;
    }
    return trimmed;
  }

  const category = (product.category || product.collectionId || 'polaroids') as string;
  return CATEGORY_FALLBACK_IMAGES[category] || DEFAULT_FALLBACK_PRODUCT_IMAGE;
}

// ---- Cached catalogue -------------------------------------------------------------------------------
// The server reads products and collections once every few minutes and shares them with every visitor,
// so a page load costs no database reads. If the server cannot answer we read Firestore directly.
interface CatalogSnap {
  empty: boolean;
  size: number;
  forEach(cb: (d: { id: string; data: () => any }) => void): void;
}
let catalogPromise: Promise<{ products: any[]; collections: any[] } | null> | null = null;
let catalogFetchedAt = 0;
const CATALOG_CLIENT_TTL_MS = 60_000;

function fetchCatalogPayload() {
  if (catalogPromise && Date.now() - catalogFetchedAt < CATALOG_CLIENT_TTL_MS) return catalogPromise;
  catalogFetchedAt = Date.now();
  catalogPromise = (async () => {
    try {
      const r = await fetch('/api/catalog');
      if (!r.ok) return null;
      const j = await r.json();
      return Array.isArray(j?.products) && Array.isArray(j?.collections) ? j : null;
    } catch {
      return null;
    }
  })();
  return catalogPromise;
}

async function readCatalogCollection(path: 'products' | 'collections'): Promise<CatalogSnap> {
  const payload = await fetchCatalogPayload();
  if (payload) {
    const docs: any[] = path === 'products' ? payload.products : payload.collections;
    return { empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach((d) => cb({ id: d.id, data: () => d })) };
  }
  catalogPromise = null; // do not remember a failure
  return (await getDocs(collection(db, path))) as unknown as CatalogSnap;
}

/** Admins: call after changing products or collections so the change is visible right away. */
export async function bustCatalogCache(): Promise<void> {
  catalogPromise = null;
  catalogFetchedAt = 0;
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) await fetch('/api/admin/catalog/refresh', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // the server cache still expires on its own within a few minutes
  }
}

// 8. Fetch products catalog from Firestore, merging custom uploads with default catalog baseline
export async function getProductsCatalog(): Promise<Product[]> {
  const path = 'products';
  try {
    console.log('[orderService] Fetching products catalog from Firestore collection:', path);
    const snap = await readCatalogCollection('products');
    console.log(`[orderService] Retrieved ${snap.size} product documents.`);

    if (!snap.empty) {
      const firestoreItems: Product[] = [];
      const firestoreMap = new Map<string, Product>();

      snap.forEach((docSnap) => {
        const rawData = docSnap.data();
        const docId = docSnap.id || rawData.id;

        // Resolve image URL from any potential field stored in Firestore
        const resolvedImageUrl = resolveProductImageUrl(rawData as Partial<Product>);

        const p: Product = {
          ...(rawData as Product),
          id: docId,
          name: rawData.name || 'Custom Photo Print',
          imageUrl: resolvedImageUrl,
          images: Array.isArray(rawData.images) && rawData.images.length > 0 
            ? rawData.images 
            : [resolvedImageUrl],
          category: rawData.category || 'polaroids',
          price: typeof rawData.price === 'number' ? rawData.price : (Number(rawData.price) || 299),
          originalPrice: typeof rawData.originalPrice === 'number' ? rawData.originalPrice : (Number(rawData.originalPrice) || 399),
          sizes: Array.isArray(rawData.sizes) && rawData.sizes.length > 0 
            ? rawData.sizes 
            : ['Standard (3.5 x 4.2 in)'],
          paperFinishes: Array.isArray(rawData.paperFinishes) && rawData.paperFinishes.length > 0 
            ? rawData.paperFinishes 
            : ['Glossy Ultra-HD'],
          minPhotos: typeof rawData.minPhotos === 'number' ? rawData.minPhotos : 1,
          maxPhotos: typeof rawData.maxPhotos === 'number' ? rawData.maxPhotos : 20,
          stock: typeof rawData.stock === 'number' ? rawData.stock : 100,
          isActive: rawData.isActive !== false,
          rating: typeof rawData.rating === 'number' ? rawData.rating : 5.0,
          reviewCount: typeof rawData.reviewCount === 'number' ? rawData.reviewCount : 1,
        };

        // Explicit debug logging for product image properties as requested
        console.log(`[orderService] Firestore product parsed: ID="${p.id}", Name="${p.name}", ImageUrl="${p.imageUrl}", Raw fields: [${Object.keys(rawData).join(', ')}]`);

        if (!rawData.imageUrl && !rawData.image && (!Array.isArray(rawData.images) || rawData.images.length === 0)) {
          console.warn(`[orderService] Notice: Product "${p.name}" (ID: ${p.id}) had missing or empty raw image property. Defaulted to fallback:`, resolvedImageUrl);
        }

        firestoreItems.push(p);
        firestoreMap.set(p.id, p);
      });

      // Merge: Custom/uploaded products from Firestore take priority, combined with baseline catalog
      const combined: Product[] = [...firestoreItems];
      for (const dp of DEFAULT_PRODUCTS) {
        if (!firestoreMap.has(dp.id)) {
          combined.push(dp);
        }
      }

      console.log(`[orderService] Catalog merge complete: ${firestoreItems.length} products from Firestore + ${combined.length - firestoreItems.length} default products = ${combined.length} total.`);

      // Sort with newest uploaded items at the very top of the store
      const sorted = combined.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      console.log(`[orderService] Top 3 catalog items for HomePage display:`, sorted.slice(0, 3).map(i => ({ id: i.id, name: i.name, imageUrl: i.imageUrl })));
      return sorted;
    }

    console.log('[orderService] Firestore products collection is empty. Returning default catalog baseline.');
    return DEFAULT_PRODUCTS;
  } catch (error) {
    console.warn('[orderService] Error fetching products catalog from Firestore. Using local catalog baseline:', error);
    return DEFAULT_PRODUCTS;
  }
}

// 9. Admin: Seed default products to Firestore
export async function seedProductsToFirestore(): Promise<number> {
  const path = 'products';
  let count = 0;
  for (const prod of DEFAULT_PRODUCTS) {
    try {
      await setDoc(doc(db, 'products', prod.id), {
        ...prod,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      count++;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${path}/${prod.id}`);
    }
  }
  await bustCatalogCache();
  return count;
}

// 10. Admin: Save or update product in Firestore
export async function saveProductToFirestore(product: Product): Promise<void> {
  const path = `products/${product.id}`;
  try {
    const cleanProduct = sanitizeFirestoreData({
      ...product,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'products', product.id), cleanProduct);
    await bustCatalogCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 11. Admin: Delete product from Firestore
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
    await bustCatalogCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 12. Collections: Fetch collections from Firestore with fallback to default
export async function getStoreCollections(): Promise<import('../types').CollectionInfo[]> {
  const path = 'collections';
  try {
    const snap = await readCatalogCollection('collections');
    if (!snap.empty) {
      const cols: import('../types').CollectionInfo[] = [];
      snap.forEach((d) => {
        cols.push(d.data() as import('../types').CollectionInfo);
      });
      return cols;
    }
    const { COLLECTIONS } = await import('../data/defaultProducts');
    return COLLECTIONS;
  } catch (error) {
    const { COLLECTIONS } = await import('../data/defaultProducts');
    return COLLECTIONS;
  }
}

// 13. Admin: Save or update collection in Firestore
export async function saveCollectionToFirestore(col: import('../types').CollectionInfo): Promise<void> {
  const path = `collections/${col.id}`;
  try {
    const cleanCol = sanitizeFirestoreData(col);
    await setDoc(doc(db, 'collections', col.id), cleanCol);
    await bustCatalogCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 14. Admin: Delete collection from Firestore
export async function deleteCollectionFromFirestore(colId: string): Promise<void> {
  const path = `collections/${colId}`;
  try {
    await deleteDoc(doc(db, 'collections', colId));
    await bustCatalogCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
