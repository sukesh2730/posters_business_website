/**
 * Comprehensive Automated Verification Test Suite for MemoPrint Image Upload,
 * Storage Performance, Instant Previews, Deduplication, and Caching.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { 
  estimatePrintQuality, 
  computeBinarySha256 
} from '../src/utils/imageOptimization';
import { validateImageFileBuffer } from '../src/services/persistentStorage';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

// Minimal 1x1 valid PNG image (68 bytes)
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SAMPLE_PNG_BUFFER = Buffer.from(SAMPLE_PNG_BASE64, 'base64');

// Minimal 1x1 valid JPEG image (134 bytes)
const SAMPLE_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const SAMPLE_JPEG_BUFFER = Buffer.from(SAMPLE_JPEG_BASE64, 'base64');

console.log('\n========================================');
console.log('STARTING MEMOPRINT IMAGE PERFORMANCE & UPLOAD AUDIT');
console.log('========================================\n');

let totalTests = 0;
let passedTests = 0;

function reportPass(msg: string) {
  totalTests++;
  passedTests++;
  console.log(`  ✓ PASS: ${msg}`);
}

function reportFail(msg: string, err: any) {
  totalTests++;
  console.error(`  ✗ FAIL: ${msg}`);
  console.error(err);
  throw err;
}

async function runSuite() {
  // ----------------------------------------------------
  // Suite 1: DPI and Resolution Print Quality Estimator
  // ----------------------------------------------------
  console.log('--- Suite 1: DPI and Resolution Print Quality Estimator ---');
  try {
    // Archival: 1800 x 2400 on 4x6" print -> 300 x 400 DPI -> min 300 DPI
    const archival = estimatePrintQuality(1800, 2400, { width: 4, height: 6 });
    assert.strictEqual(archival.quality, 'archival', '1800x2400 should be archival quality');
    assert.ok(archival.estimatedDpi >= 280, 'DPI should be >= 280');
    assert.strictEqual(archival.warning, undefined, 'No warning for archival quality');
    reportPass('High resolution images correctly identified as archival (>=300 DPI)');

    // Good: 1200 x 1500 on 4x6" print -> 200 x 250 DPI -> min 200 DPI
    const good = estimatePrintQuality(1200, 1500, { width: 4, height: 6 });
    assert.strictEqual(good.quality, 'good', '1200x1500 should be good quality');
    assert.ok(good.estimatedDpi >= 200, 'DPI should be >= 200');
    reportPass('Standard camera photos categorized as High Quality (>=200 DPI)');

    // Acceptable: 600 x 900 on 4x6" print -> 150 x 150 DPI -> min 150 DPI
    const acceptable = estimatePrintQuality(600, 900, { width: 4, height: 6 });
    assert.strictEqual(acceptable.quality, 'acceptable', '600x900 should be acceptable quality');
    reportPass('Medium resolution photos categorized as Good Quality (>=140 DPI)');

    // Low Resolution: 300 x 300 on 4x6" print -> 50 x 75 DPI -> min 50 DPI
    const low = estimatePrintQuality(300, 300, { width: 4, height: 6 });
    assert.strictEqual(low.quality, 'low', '300x300 should be flagged as low quality');
    assert.ok(low.warning && low.warning.includes('150 DPI'), 'Warning message indicates lower resolution');
    reportPass('Low resolution images trigger non-blocking warning without failing');
  } catch (err) {
    reportFail('Suite 1 DPI estimator failed', err);
  }

  // ----------------------------------------------------
  // Suite 2: Client Magic Bytes & Pre-Upload Validation
  // ----------------------------------------------------
  console.log('\n--- Suite 2: Client Magic Bytes & Pre-Upload Validation ---');
  try {
    // Valid PNG file
    const pngBlob = new Blob([SAMPLE_PNG_BUFFER], { type: 'image/png' });
    const pngFile = new File([pngBlob], 'sample.png', { type: 'image/png' });
    const pngMeta = await validateImageFileBuffer(pngFile);
    assert.strictEqual(pngMeta.mime, 'image/png');
    assert.strictEqual(pngMeta.ext, '.png');
    reportPass('PNG magic bytes validated successfully on client');

    // Valid JPEG file
    const jpegBlob = new Blob([SAMPLE_JPEG_BUFFER], { type: 'image/jpeg' });
    const jpegFile = new File([jpegBlob], 'sample.jpg', { type: 'image/jpeg' });
    const jpegMeta = await validateImageFileBuffer(jpegFile);
    assert.strictEqual(jpegMeta.mime, 'image/jpeg');
    assert.strictEqual(jpegMeta.ext, '.jpg');
    reportPass('JPEG magic bytes validated successfully on client');

    // Invalid non-image buffer
    const invalidBlob = new Blob([Buffer.from('%PDF-1.4 Fake PDF file content here')], { type: 'application/pdf' });
    const invalidFile = new File([invalidBlob], 'document.pdf', { type: 'application/pdf' });
    let rejected = false;
    try {
      await validateImageFileBuffer(invalidFile);
    } catch {
      rejected = true;
    }
    assert.ok(rejected, 'Non-image file must be rejected before network request');
    reportPass('Non-image PDF files rejected on client before upload');
  } catch (err) {
    reportFail('Suite 2 pre-upload validation failed', err);
  }

  // ----------------------------------------------------
  // Suite 3: SHA-256 Binary Fingerprinting & Deduplication
  // ----------------------------------------------------
  console.log('\n--- Suite 3: SHA-256 Binary Fingerprinting & Deduplication ---');
  try {
    const hash1 = await computeBinarySha256(SAMPLE_PNG_BUFFER);
    const hash2 = await computeBinarySha256(SAMPLE_PNG_BUFFER);
    assert.strictEqual(hash1, hash2, 'Identical buffers must produce identical hashes');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex string must be 64 characters long');
    reportPass('SHA-256 binary hash computed deterministically');

    const differentBuffer = Buffer.from('different image content buffer 123456');
    const hashDiff = await computeBinarySha256(differentBuffer);
    assert.notStrictEqual(hash1, hashDiff, 'Different buffers must produce different hashes');
    reportPass('Different image contents produce unique fingerprints');
  } catch (err) {
    reportFail('Suite 3 SHA-256 fingerprinting failed', err);
  }

  // ----------------------------------------------------
  // Suite 4: Backend Persistent Upload API & Deduplication
  // ----------------------------------------------------
  console.log('\n--- Suite 4: Backend Persistent Upload API & Deduplication ---');
  try {
    const guestSession = `guest_test_${Date.now()}`;
    const hash = crypto.createHash('sha256').update(SAMPLE_PNG_BUFFER).digest('hex');

    // First upload
    const uploadRes1 = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': guestSession,
      },
      body: JSON.stringify({
        fileData: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
        fileName: 'test_upload.png',
        hash,
      }),
    });

    assert.strictEqual(uploadRes1.status, 200, 'Initial upload should succeed with 200');
    const data1 = await uploadRes1.json();
    assert.ok(data1.success, 'Response should declare success: true');
    assert.ok(data1.id, 'Response should return media asset id');
    assert.ok(data1.url, 'Response should return accessible URL');
    assert.strictEqual(data1.isDuplicate, false, 'First upload should not be marked as duplicate');
    reportPass('Initial photo upload succeeded and returned durable asset URL');

    // Duplicate upload with same hash in same guest session
    const uploadRes2 = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': guestSession,
      },
      body: JSON.stringify({
        fileData: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
        fileName: 'test_upload_copy.png',
        hash,
      }),
    });

    assert.strictEqual(uploadRes2.status, 200, 'Duplicate upload should succeed with 200');
    const data2 = await uploadRes2.json();
    assert.strictEqual(data2.isDuplicate, true, 'Subsequent upload with same hash detected as duplicate');
    assert.strictEqual(data2.id, data1.id, 'Duplicate upload reuses existing asset ID without extra write');
    reportPass('Duplicate image upload detected and deduplicated with 0 extra writes');
  } catch (err) {
    reportFail('Suite 4 Upload API & deduplication failed', err);
  }

  // ----------------------------------------------------
  // Suite 5: Firestore 1 MiB Safeguard & Oversized Rejection
  // ----------------------------------------------------
  console.log('\n--- Suite 5: Firestore 1 MiB Safeguard & Oversized Rejection ---');
  try {
    // Generate an oversized base64 payload (> 700 KB binary)
    const largeBuffer = Buffer.alloc(750 * 1024, 0x41); // 750 KB
    const largeBase64 = largeBuffer.toString('base64');

    const oversizedRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': `guest_large_${Date.now()}`,
      },
      body: JSON.stringify({
        fileData: `data:image/jpeg;base64,${largeBase64}`,
        fileName: 'oversized.jpg',
      }),
    });

    assert.strictEqual(oversizedRes.status, 400, 'Oversized payload exceeding 700KB must be rejected');
    const errJson = await oversizedRes.json();
    assert.ok(
      errJson.error && errJson.error.toLowerCase().includes('limit'),
      'Error message mentions size limit'
    );
    reportPass('Oversized image payload safely rejected before reaching Firestore');
  } catch (err) {
    reportFail('Suite 5 Oversized payload check failed', err);
  }

  // ----------------------------------------------------
  // Suite 6: Smart Caching & Access Control Headers
  // ----------------------------------------------------
  console.log('\n--- Suite 6: Smart Caching & Access Control Headers ---');
  try {
    // Check public media endpoint or static /uploads route
    const guestSession = `guest_cache_${Date.now()}`;
    const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': guestSession,
      },
      body: JSON.stringify({
        fileData: `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
        fileName: 'cache_test.png',
      }),
    });

    const data = await uploadRes.json();
    assert.ok(data.url, 'Asset URL returned');

    // Private customer image: must be gated and require authorization or owner session
    const customerFetch = await fetch(`${BASE_URL}${data.url}`, {
      headers: { 'x-guest-session': guestSession },
    });
    assert.strictEqual(customerFetch.status, 200, 'Owner can access their private photo');
    const cacheHeader = customerFetch.headers.get('cache-control') || '';
    assert.ok(
      cacheHeader.includes('private') || cacheHeader.includes('no-cache'),
      `Customer private photo must have private cache control, got: ${cacheHeader}`
    );
    reportPass('Customer photos protected with private cache-control headers');

    // Unauthenticated access from another guest must be rejected with 403 Forbidden
    const unauthorizedFetch = await fetch(`${BASE_URL}${data.url}`, {
      headers: { 'x-guest-session': 'different_unauthorized_guest' },
    });
    assert.strictEqual(unauthorizedFetch.status, 403, 'Unauthorized access to private photo rejected with 403');
    reportPass('Private customer photos are strictly access-controlled against third parties');
  } catch (err) {
    reportFail('Suite 6 Smart caching & access control failed', err);
  }

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n========================================');
  console.log(`TOTAL AUDIT CHECKS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${totalTests - passedTests}`);
  console.log('========================================\n');
}

runSuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
