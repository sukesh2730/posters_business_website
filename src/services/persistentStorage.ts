import { doc, setDoc } from 'firebase/firestore';
import { db, auth, storage } from './firebase';
import { optimizeImageForUpload } from '../utils/imageOptimization';

export interface PersistentMediaResult {
  id: string;
  url: string;
  canonicalUrl?: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  width?: number;
  height?: number;
  hash?: string;
  isDuplicate?: boolean;
}

export interface UploadPhotoOptions {
  maxDimension?: number;
  quality?: number;
  onProgress?: (progressPercent: number) => void;
  onStageChange?: (stage: string) => void;
  maxRetries?: number;
  folder?: string;
  isPublic?: boolean;
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
export async function verifyImageAccessible(url: string, timeoutMs = 3000): Promise<boolean> {
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
 * Stages:
 * 1. Selected / Previewing (handled by caller with createInstantPreview)
 * 2. Optimizing image (client-side non-blocking resize & compression)
 * 3. Uploading (transmitting binary)
 * 4. Saving securely (durable persistence)
 * 5. Uploaded successfully (durable URL returned)
 */
export async function uploadPhotoPersistently(
  file: File,
  options?: UploadPhotoOptions
): Promise<PersistentMediaResult> {
  const maxRetries = options?.maxRetries ?? 3;
  let lastError: Error = new Error('Upload failed');

  // 1. Client-Side Magic Bytes & Size Pre-Check
  await validateImageFileBuffer(file);
  const MAX_RAW_SIZE = 25 * 1024 * 1024; // 25MB initial raw intake limit
  if (file.size > MAX_RAW_SIZE) {
    throw new Error(`File is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed photo size is 25MB.`);
  }

  // 2. High-performance non-blocking client-side optimization
  options?.onStageChange?.('Optimizing image...');
  options?.onProgress?.(15);

  const optimized = await optimizeImageForUpload(file, {
    maxDimension: options?.maxDimension || 1920,
    initialQuality: options?.quality || 0.85,
    onStageChange: options?.onStageChange,
  });

  options?.onProgress?.(35);
  options?.onStageChange?.('Uploading photo...');

  const contentType = optimized.mimeType;
  const safeRandom = Math.random().toString(36).substring(2, 10);
  const mediaId = `img_${Date.now()}_${safeRandom}`;
  const fileName = optimized.file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 100);
  const folder = options?.folder || 'photos';

  // 3. Attempt Primary: Firebase Storage Object Storage (if initialized and available)
  try {
    if (storage && (storage as any).app) {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const storageRef = ref(storage, `${folder}/${mediaId}_${fileName}`);
      options?.onProgress?.(55);
      const snapshot = await uploadBytes(storageRef, optimized.file, {
        contentType,
        customMetadata: {
          uploadedBy: auth.currentUser?.uid || 'guest',
          fileName,
          hash: optimized.hash,
        },
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // Save metadata in Firestore (durable record)
      if (db) {
        try {
          const docRef = doc(db, 'media_assets', mediaId);
          await setDoc(docRef, {
            id: mediaId,
            url: downloadUrl,
            storagePath: snapshot.ref.fullPath,
            fileName,
            contentType,
            sizeBytes: optimized.sizeBytes,
            hash: optimized.hash,
            uploadedBy: auth.currentUser?.uid || 'guest',
            visibility: options?.isPublic ? 'public' : 'private',
            createdAt: new Date().toISOString(),
          });
        } catch {
          // Non-blocking metadata write
        }
      }

      options?.onStageChange?.('Uploaded successfully');
      options?.onProgress?.(100);
      return {
        id: mediaId,
        url: downloadUrl,
        canonicalUrl: downloadUrl,
        fileName,
        sizeBytes: optimized.sizeBytes,
        contentType,
        width: optimized.width,
        height: optimized.height,
        hash: optimized.hash,
      };
    }
  } catch (storageErr: any) {
    if (import.meta.env.DEV) {
      console.warn('Firebase Storage direct upload skipped, using resilient persistent media endpoint:', storageErr?.message);
    }
  }

  // 4. Resilient Authoritative Server `/api/upload` endpoint with deduplication
  options?.onStageChange?.('Saving securely...');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      options?.onProgress?.(45 + attempt * 15);

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
          fileData: optimized.dataUri,
          hash: optimized.hash,
          isPublic: options?.isPublic === true,
        }),
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        const finalUrl = data.url;

        // Sub-millisecond verify or duplicate return
        options?.onStageChange?.('Uploaded successfully');
        options?.onProgress?.(100);
        return {
          id: data.id || mediaId,
          url: finalUrl,
          canonicalUrl: data.canonicalUrl || `/api/images/${data.id || mediaId}`,
          fileName,
          sizeBytes: optimized.sizeBytes,
          contentType,
          width: optimized.width,
          height: optimized.height,
          hash: optimized.hash,
          isDuplicate: data.isDuplicate,
        };
      } else {
        const errData = await serverRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${serverRes.status} for photo upload.`);
      }

    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 150 + Math.random() * 50;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  options?.onStageChange?.('Upload failed');
  throw new Error(`Failed to upload photo after ${maxRetries} attempts: ${lastError.message}`);
}
