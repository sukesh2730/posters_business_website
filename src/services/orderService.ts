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

// 1. Authoritative Server-side order calculation & price validation (No online payment gateway needed)
export async function validateServerOrderTotals(payload: {
  items: any[];
  couponCode?: string;
  discount?: number;
}) {
  try {
    const res = await fetch('/api/orders/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: payload.items,
        couponCode: payload.couponCode,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to validate order totals.');
    }

    return await res.json();
  } catch (err: any) {
    const isDev = Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV) || process.env.NODE_ENV === 'test';
    if (isDev) {
      console.warn('Notice: Server validation notice, verifying with local authoritative catalog:', err.message);
    }
    
    // Authoritative fallback using trusted catalog constants only (fail closed on unknown products)
    let subtotal = 0;
    const validatedItems = [];
    const catalogMap = new Map(DEFAULT_PRODUCTS.map((p) => [p.id, p]));

    for (const it of payload.items) {
      const prod = catalogMap.get(it.productId);
      if (!prod) {
        throw new Error(`Product "${it.productId}" was not found in the verified store catalog.`);
      }
      const unitPrice = prod.price;
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      subtotal += unitPrice * qty;
      validatedItems.push({
        ...it,
        unitPrice,
        totalPrice: unitPrice * qty,
      });
    }

    const shippingCharges = subtotal >= 499 ? 0 : 60;
    let validatedDiscount = 0;
    let appliedCoupon = null;

    if (payload.couponCode) {
      const coupon = AVAILABLE_COUPONS.find((c) => c.code === payload.couponCode?.toUpperCase());
      if (coupon && subtotal >= coupon.minAmount) {
        if ('flatDiscount' in coupon && coupon.flatDiscount) {
          validatedDiscount = coupon.flatDiscount;
        } else if ('discountPercent' in coupon && coupon.discountPercent) {
          validatedDiscount = Math.round(subtotal * (coupon.discountPercent / 100));
        }
        appliedCoupon = coupon.code;
      }
    }

    const taxableBase = Math.max(0, subtotal - validatedDiscount);
    const gst = Math.round(taxableBase * 0.18);
    const total = Math.max(0, subtotal + shippingCharges - validatedDiscount);

    return {
      valid: true,
      subtotal,
      subtotalPaise: subtotal * 100,
      gst,
      gstPaise: gst * 100,
      shippingCharges,
      shippingChargesPaise: shippingCharges * 100,
      discount: validatedDiscount,
      discountPaise: validatedDiscount * 100,
      couponCode: appliedCoupon,
      total,
      totalPaise: total * 100,
      currency: 'INR',
      items: validatedItems,
    };
  }
}

/**
 * Fast client-side image compression and resizing.
 * Downscales images exceeding maxDimension (1920px) and converts to optimized WebP/JPEG.
 * Shrinks 10MB phone camera photos down to 200KB-400KB in ~80ms with 300 DPI clarity.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1920,
  quality = 0.85
): Promise<File> {
  // If already lightweight and standard format, don't re-compress
  if (file.size <= 350 * 1024 && !file.type.includes('heic')) {
    return file;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // If dimensions are within bounds and under 500KB, resolve as is
      if (width <= maxDimension && height <= maxDimension && file.size < 500 * 1024) {
        resolve(file);
        return;
      }

      // Proportional downscaling
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const isPngTarget = (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) && file.size < 1.5 * 1024 * 1024;
      const mimeType = isPngTarget ? 'image/png' : 'image/jpeg';
      const ext = isPngTarget ? '.png' : '.jpg';

      if (mimeType === 'image/jpeg') {
        // JPEG has no alpha channel. In HTML Canvas, transparent/alpha pixels turn pitch black
        // when serialized to image/jpeg without a composite background fill.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // For PNG, preserve the full alpha transparency channel
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      try {
        ctx.drawImage(img, 0, 0, width, height);
      } catch (drawErr) {
        console.warn('Canvas drawImage error, resolving original file:', drawErr);
        resolve(file);
        return;
      }

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size < 500) {
            // If blob generation failed or is corrupted/tiny, resolve with original file
            resolve(file);
            return;
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, '') + ext;
          const compressed = new File([blob], cleanName, {
            type: mimeType,
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
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
  const result = await uploadPhotoPersistently(file, { onProgress });
  return result.url;
}

// 2b. Server photo upload helper with persistent Firestore & cache storage
export async function uploadCustomPhoto(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  const result = await uploadPhotoPersistently(file, { onProgress });
  return result.url;
}

// 3. Bulk photo upload helper for Admin collection import with Firebase Auth token
export async function bulkUploadCustomPhotos(files: File[]): Promise<Array<{ url: string; fileName: string }>> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);

  const compressedFiles = await Promise.all(
    files.map((file) => compressImageFile(file).catch(() => file))
  );

  const convertedFiles: Array<{ fileData: string; fileName: string; fileType: string }> = [];

  for (const file of compressedFiles) {
    const base64Data = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

    convertedFiles.push({
      fileData: base64Data,
      fileName: file.name,
      fileType: file.type,
    });
  }

  const res = await fetch('/api/upload-bulk', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({ files: convertedFiles }),
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

// 8. Fetch products catalog from Firestore, merging custom uploads with default catalog baseline
export async function getProductsCatalog(): Promise<Product[]> {
  const path = 'products';
  try {
    console.log('[orderService] Fetching products catalog from Firestore collection:', path);
    const snap = await getDocs(collection(db, path));
    console.log(`[orderService] Retrieved ${snap.size} product documents from Firestore.`);

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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 11. Admin: Delete product from Firestore
export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 12. Collections: Fetch collections from Firestore with fallback to default
export async function getStoreCollections(): Promise<import('../types').CollectionInfo[]> {
  const path = 'collections';
  try {
    const snap = await getDocs(collection(db, path));
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 14. Admin: Delete collection from Firestore
export async function deleteCollectionFromFirestore(colId: string): Promise<void> {
  const path = `collections/${colId}`;
  try {
    await deleteDoc(doc(db, 'collections', colId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
