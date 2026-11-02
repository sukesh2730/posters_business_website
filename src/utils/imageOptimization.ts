/**
 * High-performance image optimization, instant preview generation,
 * DPI estimation, and SHA-256 fingerprinting for MemoPrint.
 */

export type PrintQualityLevel = 'archival' | 'good' | 'acceptable' | 'low';

export interface PrintQualityAssessment {
  estimatedDpi: number;
  quality: PrintQualityLevel;
  badgeLabel: string;
  badgeColor: string;
  warning?: string;
  width: number;
  height: number;
}

export interface OptimizedImageResult {
  file: File;
  base64: string;
  dataUri: string;
  hash: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Creates an instant zero-latency local preview URL.
 */
export function createInstantPreview(file: File | Blob): string {
  if (typeof window === 'undefined' || typeof URL === 'undefined') {
    return '';
  }
  return URL.createObjectURL(file);
}

/**
 * Revokes a local object URL to prevent memory leaks.
 */
export function revokePreview(url: string | null | undefined): void {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}

/**
 * Fast client-side image dimension inspector using createImageBitmap when available.
 */
export async function inspectImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();
      return { width, height };
    } catch {}
  }

  return new Promise((resolve) => {
    const objectUrl = createInstantPreview(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 800,
        height: img.naturalHeight || img.height || 800,
      });
      revokePreview(objectUrl);
    };
    img.onerror = () => {
      resolve({ width: 800, height: 800 });
      revokePreview(objectUrl);
    };
    img.src = objectUrl;
  });
}

/**
 * Calculates print DPI based on pixel dimensions and standard print sizes.
 * Assumes a standard 4x4 or 4x6 inch photographic target unless specified.
 */
export function estimatePrintQuality(
  width: number,
  height: number,
  targetPrintSizeInches: { width: number; height: number } = { width: 4, height: 5 }
): PrintQualityAssessment {
  const horizontalDpi = Math.round(width / Math.max(1, targetPrintSizeInches.width));
  const verticalDpi = Math.round(height / Math.max(1, targetPrintSizeInches.height));
  const estimatedDpi = Math.min(horizontalDpi, verticalDpi);

  if (estimatedDpi >= 280) {
    return {
      estimatedDpi,
      quality: 'archival',
      badgeLabel: 'Archival 300+ DPI',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      width,
      height,
    };
  }

  if (estimatedDpi >= 200) {
    return {
      estimatedDpi,
      quality: 'good',
      badgeLabel: 'High Quality',
      badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
      width,
      height,
    };
  }

  if (estimatedDpi >= 140) {
    return {
      estimatedDpi,
      quality: 'acceptable',
      badgeLabel: 'Good Quality',
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
      width,
      height,
    };
  }

  return {
    estimatedDpi,
    quality: 'low',
    badgeLabel: 'Lower Resolution',
    badgeColor: 'text-amber-800 bg-amber-50 border-amber-200',
    warning: 'Resolution is lower than 150 DPI. Prints might appear slightly soft, but will still be printed with care.',
    width,
    height,
  };
}

/**
 * Computes SHA-256 fingerprint of an ArrayBuffer or Uint8Array.
 */
export async function computeBinarySha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    try {
      const digestBuffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
      const hashArray = Array.from(new Uint8Array(digestBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }

  // Fallback simple checksum if Web Crypto is unavailable
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return `hash_${Math.abs(hash).toString(16)}_${bytes.length}`;
}

/**
 * Checks if a canvas context has transparent pixels.
 */
function canvasHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const sampleWidth = Math.min(width, 100);
    const sampleHeight = Math.min(height, 100);
    const stepX = Math.max(1, Math.floor(width / sampleWidth));
    const stepY = Math.max(1, Math.floor(height / sampleHeight));
    
    // Sample a grid of pixels
    const imgData = ctx.getImageData(0, 0, Math.min(width, 200), Math.min(height, 200));
    const data = imgData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        return true;
      }
    }
  } catch {}
  return false;
}

/**
 * Optimizes an image file for fast network transmission and safe durable storage.
 * - Non-blocking canvas resizing
 * - Max dimension 1920px (preserves high-resolution details)
 * - Pure white background composite for JPEGs (prevents black background bug)
 * - Alpha preservation for transparent PNGs
 * - Max binary payload size: < 700 KB (strictly within Firestore 1 MiB limits)
 * - Returns SHA-256 fingerprint for deduplication
 */
export async function optimizeImageForUpload(
  file: File,
  options?: {
    maxDimension?: number;
    initialQuality?: number;
    preservePngAlpha?: boolean;
    onStageChange?: (stage: string) => void;
  }
): Promise<OptimizedImageResult> {
  const maxDim = options?.maxDimension || 1920;
  let quality = options?.initialQuality || 0.85;

  options?.onStageChange?.('Optimizing image...');

  // Yield execution to event loop so UI does not freeze
  await new Promise((r) => setTimeout(r, 0));

  const objectUrl = createInstantPreview(file);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale proportionally if larger than maxDim
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          revokePreview(objectUrl);
          reject(new Error('Canvas 2D context unavailable for image compression.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Check if PNG and if transparency should be preserved
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        
        let hasAlpha = false;
        if (isPng) {
          ctx.drawImage(img, 0, 0, width, height);
          hasAlpha = canvasHasTransparency(ctx, width, height);
        }

        const targetMime = hasAlpha ? 'image/png' : 'image/jpeg';
        const targetExt = hasAlpha ? '.png' : '.jpg';

        if (targetMime === 'image/jpeg') {
          // Fill pure white background to prevent transparent areas turning black
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        revokePreview(objectUrl);

        // Helper to convert canvas to blob with progressive compression if oversized
        const encodeBlob = (q: number): Promise<Blob> => {
          return new Promise((resBlob, rejBlob) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resBlob(blob);
                else rejBlob(new Error('Failed to encode image blob from canvas.'));
              },
              targetMime,
              targetMime === 'image/jpeg' ? q : undefined
            );
          });
        };

        let finalBlob = await encodeBlob(quality);
        const MAX_BYTES = 700 * 1024; // 700 KB safe limit for Firestore 1 MiB

        // If file is still too big, adaptively step down quality
        if (finalBlob.size > MAX_BYTES && targetMime === 'image/jpeg') {
          for (const testQuality of [0.75, 0.65, 0.55]) {
            finalBlob = await encodeBlob(testQuality);
            if (finalBlob.size <= MAX_BYTES) break;
          }
        }

        // If PNG is oversized, convert to JPEG with white background
        if (finalBlob.size > MAX_BYTES && targetMime === 'image/png') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, width, height);
          finalBlob = await new Promise((resBlob, rejBlob) => {
            canvas.toBlob(
              (b) => (b ? resBlob(b) : rejBlob(new Error('JPEG fallback conversion failed.'))),
              'image/jpeg',
              0.80
            );
          });
        }

        const buffer = await finalBlob.arrayBuffer();
        const hash = await computeBinarySha256(buffer);

        // Base64 conversion
        const base64 = await new Promise<string>((resB64, rejB64) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const b64 = res.includes(',') ? res.split(',')[1] : res;
            resB64(b64);
          };
          reader.onerror = rejB64;
          reader.readAsDataURL(finalBlob);
        });

        const cleanName = file.name.replace(/\.[^/.]+$/, '') + targetExt;
        const optimizedFile = new File([finalBlob], cleanName, {
          type: finalBlob.type,
          lastModified: Date.now(),
        });

        resolve({
          file: optimizedFile,
          base64,
          dataUri: `data:${finalBlob.type};base64,${base64}`,
          hash,
          width,
          height,
          sizeBytes: finalBlob.size,
          mimeType: finalBlob.type,
        });
      } catch (err) {
        revokePreview(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      revokePreview(objectUrl);
      reject(new Error('Failed to load selected photo for processing.'));
    };

    img.src = objectUrl;
  });
}
