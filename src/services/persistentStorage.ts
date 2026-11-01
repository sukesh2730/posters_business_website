import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, storage } from './firebase';
import { compressImageFile } from './orderService';

export interface PersistentMediaResult {
  id: string;
  url: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Validates file magic bytes on client before sending to network.
 */
export async function validateImageFileBuffer(file: File): Promise<{ mime: string; ext: string }> {
  const slice = file.slice(0, 16);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 12) {
    throw new Error('Selected file is corrupted or too small to be a valid photo.');
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // WebP: RIFF ... WEBP
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }

  throw new Error('Unsupported image format. Please select a valid JPG, PNG, or WebP photo.');
}

/**
 * Converts a Blob or File to Base64 string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image data.'));
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Verified probe to check if the uploaded image URL is accessible via HTTP.
 */
export async function verifyImageAccessible(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Production-ready persistent photo uploader.
 * Solves:
 * 1. Binary storage in Firebase Storage with Firestore metadata tracking.
 * 2. Capped documents to prevent exceeding Firestore 1 MiB limit.
 * 3. File validation and retry backoff.
 */
export async function uploadPhotoPersistently(
  file: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    onProgress?: (progressPercent: number) => void;
    maxRetries?: number;
    folder?: string;
  }
): Promise<PersistentMediaResult> {
  const maxRetries = options?.maxRetries ?? 3;
  let lastError: Error = new Error('Upload failed');

  // 1. Client-Side Magic Bytes & Size Validation
  await validateImageFileBuffer(file);
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    throw new Error(`File is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed photo size is 10MB.`);
  }

  // 2. Pre-compress to ensure optimal size (<500KB)
  options?.onProgress?.(15);
  const compressed = await compressImageFile(file, options?.maxDimension || 1920, options?.quality || 0.85);
  options?.onProgress?.(30);

  const contentType = compressed.type || 'image/jpeg';
  const safeRandom = Math.random().toString(36).substring(2, 10);
  const mediaId = `img_${Date.now()}_${safeRandom}`;
  const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 100);
  const folder = options?.folder || 'photos';

  // 3. Attempt Primary: Firebase Storage Object Storage
  try {
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const storageRef = ref(storage, `${folder}/${mediaId}_${fileName}`);
    options?.onProgress?.(50);
    const snapshot = await uploadBytes(storageRef, compressed, {
      contentType,
      customMetadata: {
        uploadedBy: auth.currentUser?.uid || 'guest',
        fileName,
      },
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);

    // Save metadata only in Firestore (No heavy base64 binary!)
    if (db) {
      try {
        const docRef = doc(db, 'media_assets', mediaId);
        await setDoc(docRef, {
          id: mediaId,
          url: downloadUrl,
          storagePath: snapshot.ref.fullPath,
          fileName,
          contentType,
          sizeBytes: compressed.size,
          uploadedBy: auth.currentUser?.uid || 'guest',
          createdAt: new Date().toISOString(),
        });
      } catch (metaErr) {
        // Non-blocking metadata write
      }
    }

    options?.onProgress?.(100);
    return {
      id: mediaId,
      url: downloadUrl,
      fileName,
      sizeBytes: compressed.size,
      contentType,
    };
  } catch (storageErr: any) {
    // If Firebase Storage is unprovisioned, proceed to resilient server endpoint
    if (import.meta.env.DEV) {
      console.warn('Firebase Storage direct upload notice, using persistent media endpoint:', storageErr?.message);
    }
  }

  // 4. Fallback Attempt: Server `/api/upload` endpoint
  const base64Data = await blobToBase64(compressed);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      options?.onProgress?.(40 + attempt * 15);

      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        const guestId = sessionStorage.getItem('memo_guest_session_id') || `guest_${safeRandom}`;
        sessionStorage.setItem('memo_guest_session_id', guestId);
        headers['x-guest-session'] = guestId;
      }

      const serverRes = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mediaId,
          fileName,
          fileData: `data:${contentType};base64,${base64Data}`,
        }),
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        const finalUrl = data.url;

        // Verify image accessibility
        const isAccessible = await verifyImageAccessible(finalUrl);
        if (isAccessible || attempt === maxRetries) {
          options?.onProgress?.(100);
          return {
            id: data.id || mediaId,
            url: finalUrl,
            fileName,
            sizeBytes: compressed.size,
            contentType,
          };
        }
      } else {
        const errData = await serverRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${serverRes.status} for photo upload.`);
      }

    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 200 + Math.random() * 100;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  throw new Error(`Failed to upload photo after ${maxRetries} attempts: ${lastError.message}`);
}
