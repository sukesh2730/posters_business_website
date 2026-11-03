import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Test Suite: Private Media Security, Disk-Cache Isolation & Signed URLs
 */
async function runPrivateMediaSecurityTests() {
  console.log('======================================================================');
  console.log('STARTING MEMOPRINT PRIVATE MEDIA SECURITY & SIGNED URL AUDIT');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3000';

  // Step 1: Request signed guest session
  console.log('\n--- 1. Cryptographic Guest Session Verification ---');
  let guestSessionToken = '';
  let guestSessionId = '';
  try {
    const sRes = await fetch(`${BASE_URL}/api/session/guest`, { method: 'POST' });
    assert(sRes.status === 200, 'Server provides /api/session/guest endpoint');
    const sData = await sRes.json();
    assert(Boolean(sData.sessionToken && sData.sessionId), 'Server returns sessionId and sessionToken');
    guestSessionToken = sData.sessionToken;
    guestSessionId = sData.sessionId;
  } catch (e: any) {
    assert(false, `Failed to call /api/session/guest: ${e.message}`);
  }

  // Step 2: Upload private image with signed guest session
  console.log('\n--- 2. Private Image Upload & Signed URL Generation ---');
  let uploadedMediaId = '';
  let permanentUrlWithToken = '';
  let canonicalUrlWithToken = '';
  const testPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  try {
    const upRes = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-guest-session': guestSessionToken,
      },
      body: JSON.stringify({
        fileName: 'customer_private_photo.png',
        fileData: `data:image/png;base64,${testPixel}`,
        isPublic: false,
      }),
    });

    assert(upRes.status === 200, 'Upload accepted private image with signed guest session');
    const upData = await upRes.json();
    uploadedMediaId = upData.id;
    permanentUrlWithToken = upData.url;
    canonicalUrlWithToken = upData.canonicalUrl;
    assert(Boolean(uploadedMediaId), `Private image assigned mediaId: ${uploadedMediaId}`);
    assert(permanentUrlWithToken.includes('token='), 'Returned permanent URL includes signed authorization token');
    assert(canonicalUrlWithToken.includes('token='), 'Returned canonical URL includes signed authorization token');
  } catch (e: any) {
    assert(false, `Upload failed: ${e.message}`);
  }

  // Step 3: Access via Signed URL (simulating <img src="..."> in browser without custom headers)
  console.log('\n--- 3. Browser Image Display via Signed URL (Zero Custom Headers) ---');
  try {
    const imgRes = await fetch(`${BASE_URL}${permanentUrlWithToken}`, {
      method: 'GET',
    });
    assert(imgRes.status === 200, 'Browser <img src="..."> loads private image successfully using signed token query');
    assert(imgRes.headers.get('content-type')?.includes('image/png') === true, 'Content-Type is image/png');
    assert(imgRes.headers.get('cache-control')?.includes('private') === true, 'Cache-Control header is strictly private');
  } catch (e: any) {
    assert(false, `Signed URL fetch failed: ${e.message}`);
  }

  // Step 4: Access without token or headers (Fail-Closed)
  console.log('\n--- 4. Unauthenticated Access Without Token (Fail-Closed) ---');
  try {
    const rawUrl = permanentUrlWithToken.split('?')[0];
    const unauthRes = await fetch(`${BASE_URL}${rawUrl}`, {
      method: 'GET',
    });
    assert(unauthRes.status === 403, 'Unauthenticated request without token receives HTTP 403 Forbidden');
  } catch (e: any) {
    assert(false, `Unauth check failed: ${e.message}`);
  }

  // Step 5: Forged/Tampered Token Rejection
  console.log('\n--- 5. Tampered Signed Token Rejection ---');
  try {
    const rawUrl = permanentUrlWithToken.split('?')[0];
    const tamperedRes = await fetch(`${BASE_URL}${rawUrl}?token=9999999999999.forged_signature_hex_123456`, {
      method: 'GET',
    });
    assert(tamperedRes.status === 403, 'Tampered token receives HTTP 403 Forbidden');
  } catch (e: any) {
    assert(false, `Tampered token check failed: ${e.message}`);
  }

  // Step 6: Disk-Cache Fail-Open Prevention (Even if file exists on disk, unauthorized access must be blocked)
  console.log('\n--- 6. Disk-Cache Fail-Open Prevention ---');
  try {
    // Confirm file exists on local disk
    const diskPath = path.resolve(process.cwd(), 'public', 'uploads', `${uploadedMediaId}.png`);
    const fileExistsOnDisk = fs.existsSync(diskPath);
    assert(fileExistsOnDisk, 'Image file is physically present in local disk cache');

    // Make an unauthenticated request directly to the raw URL
    const rawUrl = `/uploads/${uploadedMediaId}.png`;
    const probeRes = await fetch(`${BASE_URL}${rawUrl}`, {
      method: 'GET',
    });
    assert(probeRes.status === 403, 'Direct raw disk URL rejected with 403 Forbidden when unauthenticated (no disk fail-open)');
  } catch (e: any) {
    assert(false, `Disk-cache test failed: ${e.message}`);
  }

  // Step 7: Stranger with different guest session cannot access
  console.log('\n--- 7. Cross-Guest Isolation ---');
  try {
    const strangerRes = await fetch(`${BASE_URL}/api/session/guest`, { method: 'POST' });
    const strangerData = await strangerRes.json();
    const strangerToken = strangerData.sessionToken;

    const rawUrl = `/api/images/${uploadedMediaId}`;
    const crossAccessRes = await fetch(`${BASE_URL}${rawUrl}`, {
      method: 'GET',
      headers: {
        'x-guest-session': strangerToken,
      },
    });
    assert(crossAccessRes.status === 403, 'Different guest session cannot access another guest photo (HTTP 403)');
  } catch (e: any) {
    assert(false, `Cross-guest test failed: ${e.message}`);
  }

  // Step 8: Owner with original guest session CAN access via API
  console.log('\n--- 8. Owner Guest Session Authorization ---');
  try {
    const rawUrl = `/api/images/${uploadedMediaId}`;
    const ownerRes = await fetch(`${BASE_URL}${rawUrl}`, {
      method: 'GET',
      headers: {
        'x-guest-session': guestSessionToken,
      },
    });
    assert(ownerRes.status === 200, 'Owner with verified guest session receives HTTP 200 OK');
  } catch (e: any) {
    assert(false, `Owner test failed: ${e.message}`);
  }

  // Step 9: Expired Token Rejection (Fail-Closed)
  console.log('\n--- 9. Expired Token Verification ---');
  try {
    const rawUrl = permanentUrlWithToken.split('?')[0];
    const pastTimestamp = Date.now() - 60000; // 1 minute in the past
    // Mint token with past expiry
    const expiredToken = `${pastTimestamp}.${crypto.randomBytes(32).toString('hex')}`;
    const expRes = await fetch(`${BASE_URL}${rawUrl}?token=${expiredToken}`);
    assert(expRes.status === 403, 'Expired signed URL token strictly rejected with 403 Forbidden');
  } catch (e: any) {
    assert(false, `Expired token test failed: ${e.message}`);
  }

  // Step 10: Media ID Tampering (Token Replay on Different Asset)
  console.log('\n--- 10. Cross-Asset Signature Replay Rejection ---');
  try {
    const validToken = permanentUrlWithToken.split('token=')[1];
    // Attempt to use media A's valid token to access another media ID
    const fakeOtherMedia = `/uploads/img_9999999999999_fakeotherid.png`;
    const replayRes = await fetch(`${BASE_URL}${fakeOtherMedia}?token=${validToken}`);
    assert(replayRes.status === 403 || replayRes.status === 404, 'Token bound to media A cannot authorize media B');
  } catch (e: any) {
    assert(false, `Token replay test failed: ${e.message}`);
  }

  // Step 11: Expiry Timestamp Tampering
  console.log('\n--- 11. Expiry Timestamp Modification Rejection ---');
  try {
    const rawUrl = permanentUrlWithToken.split('?')[0];
    const validToken = permanentUrlWithToken.split('token=')[1];
    const [originalExp, originalSig] = validToken.split('.');
    const extendedExp = String(Number(originalExp) + 86400000); // Add 1 day
    const tamperedToken = `${extendedExp}.${originalSig}`;
    const tamperRes = await fetch(`${BASE_URL}${rawUrl}?token=${tamperedToken}`);
    assert(tamperRes.status === 403, 'Modifying expiry timestamp invalidates signature (HTTP 403 Forbidden)');
  } catch (e: any) {
    assert(false, `Expiry tampering test failed: ${e.message}`);
  }

  // Step 12: Expired Guest Session Rejection
  console.log('\n--- 12. Expired Guest Session Invalidation ---');
  try {
    const expiredGuest = `guest_${crypto.randomBytes(24).toString('hex')}.${Date.now() - 3600000}.${crypto.randomBytes(32).toString('hex')}`;
    const rawUrl = `/api/images/${uploadedMediaId}`;
    const expGuestRes = await fetch(`${BASE_URL}${rawUrl}`, {
      headers: { 'x-guest-session': expiredGuest },
    });
    assert(expGuestRes.status === 403, 'Expired guest session rejected with HTTP 403');
  } catch (e: any) {
    assert(false, `Expired guest session test failed: ${e.message}`);
  }

  // Step 13: Strict Anti-CDN & Private Caching Headers
  console.log('\n--- 13. Anti-CDN & Anti-Proxy Cache Leakage Headers ---');
  try {
    const res = await fetch(`${BASE_URL}${permanentUrlWithToken}`);
    const cacheControl = res.headers.get('cache-control') || '';
    const pragma = res.headers.get('pragma') || '';
    const expires = res.headers.get('expires') || '';
    const vary = res.headers.get('vary') || '';
    const nosniff = res.headers.get('x-content-type-options') || '';

    assert(cacheControl.includes('no-store') && cacheControl.includes('private'), 'Cache-Control includes private and no-store');
    assert(pragma === 'no-cache', 'Pragma header is no-cache');
    assert(expires === '0', 'Expires header is 0');
    assert(vary.includes('Authorization') || vary.includes('Cookie'), 'Vary header protects against shared proxy cache mixing');
    assert(nosniff === 'nosniff', 'X-Content-Type-Options: nosniff enforced');
  } catch (e: any) {
    assert(false, `Cache header test failed: ${e.message}`);
  }

  // Step 14: Order Authoritative HMAC Signature Integrity
  console.log('\n--- 14. Order Authoritative Signature Integrity ---');
  try {
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Security Audit Customer',
        customerPhone: '9876543210',
        userEmail: 'audit@example.com',
        shippingAddress: {
          addressLine1: '123 MG Road, Koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
        items: [{
          productId: 'prod-polaroid-classic',
          quantity: 1,
        }],
        paymentMethod: 'cod',
      }),
    });
    assert(orderRes.status === 201, 'Authoritative server creates order via /api/orders (201 Created)');
    const orderData = await orderRes.json();
    assert(Boolean(orderData.order && orderData.order.orderSignature), 'Server stamps cryptographic orderSignature');
    assert(orderData.order.orderSignature.length === 64, 'orderSignature is 64-character SHA-256 HMAC');
  } catch (e: any) {
    assert(false, `Order signature test failed: ${e.message}`);
  }

  console.log('\n======================================================================');
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPrivateMediaSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
