/**
 * Comprehensive Verification: Option B (GST Inclusive), State Machine, Media Access Isolation, and Fail-Closed Security
 */
process.env.NODE_ENV = 'test';

import { calculateAuthoritativeTotals, isAuthorizedAdmin } from '../server';

const BASE_URL = 'http://localhost:3000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, title: string, detail: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${title}: ${detail}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${title}: ${detail}`);
  }
}

async function runComprehensiveTests() {
  console.log('\n============================================================');
  console.log('MEMOPRINT: COMPREHENSIVE SECURITY, GST & STATE MACHINE TESTS');
  console.log('============================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: GST Inclusive Calculation & Mathematical Identity
  // ----------------------------------------------------
  console.log('--- TEST GROUP 1: GST Inclusive Model (Option B) & Integer Precision ---');

  // 1.1 Single item with standard shipping
  const order1 = calculateAuthoritativeTotals([{ productId: 'prod-polaroid-classic', quantity: 1 }]);
  assert(order1.subtotal === 349, 'GST Subtotal', 'Subtotal is ₹349 (inclusive of GST)');
  assert(order1.shippingCharges === 60, 'Shipping Fee', 'Shipping fee is ₹60 for order < ₹499');
  assert(order1.taxableAmount === 296, 'Taxable Amount', 'Taxable amount is ₹296 (Math.round(349 / 1.18))');
  assert(order1.gst === 53, 'GST Amount', 'GST is ₹53 (349 - 296)');
  assert(order1.total === 409, 'Total Amount', 'Total is ₹409 (349 + 60)');
  assert(
    order1.taxableAmount + order1.gst + order1.shippingCharges === order1.total,
    'Identity Check 1',
    'taxableAmount (296) + gst (53) + shipping (60) === total (409)'
  );

  // 1.2 Free shipping threshold (₹698 >= ₹499)
  const order2 = calculateAuthoritativeTotals([{ productId: 'prod-polaroid-classic', quantity: 2 }]);
  assert(order2.subtotal === 698, 'Subtotal 2', 'Subtotal is ₹698');
  assert(order2.shippingCharges === 0, 'Shipping 2', 'Shipping is ₹0 (>= ₹499 threshold)');
  assert(order2.taxableAmount === 592, 'Taxable Amount 2', 'Taxable is ₹592 (Math.round(698 / 1.18))');
  assert(order2.gst === 106, 'GST Amount 2', 'GST is ₹106 (698 - 592)');
  assert(order2.total === 698, 'Total 2', 'Total is ₹698');
  assert(
    order2.taxableAmount + order2.gst + order2.shippingCharges === order2.total,
    'Identity Check 2',
    'taxableAmount (592) + gst (106) + shipping (0) === total (698)'
  );

  // 1.3 Percentage discount coupon (FIRSTMEMO15 - 15% off)
  const order3 = calculateAuthoritativeTotals([{ productId: 'prod-polaroid-classic', quantity: 1 }], 'FIRSTMEMO15');
  assert(order3.discount === 52, 'Coupon Discount', '15% discount is ₹52 (5235 paise)');
  assert(order3.total === 357, 'Discounted Total', 'Total is ₹357 (35665 paise with ₹60 shipping)');
  assert(order3.taxableAmount === 251, 'Discounted Taxable', 'Taxable is ₹251 (25140 paise)');
  assert(order3.gst === 46, 'Discounted GST', 'GST is ₹46 (357 - 60 - 251)');
  assert(
    order3.taxableAmount + order3.gst + order3.shippingCharges === order3.total,
    'Identity Check 3',
    'taxableAmount (251) + gst (46) + shipping (60) === total (357)'
  );

  // 1.4 Flat discount coupon (MEMOLIFE - ₹150 off on orders >= ₹799)
  const order4 = calculateAuthoritativeTotals([
    { productId: 'prod-vintage-scrapbook-album', quantity: 1 } // ₹899
  ], 'MEMOLIFE');
  assert(order4.discount === 150, 'Flat Discount', 'Flat discount of ₹150 applied');
  assert(order4.subtotal === 899, 'Original Subtotal', 'Subtotal is ₹899');
  assert(order4.total === 749, 'Discounted Total', 'Total is ₹749 (899 - 150, free shipping)');
  assert(
    order4.taxableAmount + order4.gst + order4.shippingCharges === order4.total,
    'Identity Check 4',
    'taxableAmount + gst + shipping === total'
  );

  // ----------------------------------------------------
  // TEST GROUP 2: Fail-Closed Order Security & Catalog Lookup
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 2: Fail-Closed Order Security ---');

  // 2.1 Unknown product must throw
  let unknownThrew = false;
  try {
    calculateAuthoritativeTotals([{ productId: 'non-existent-product-id', quantity: 1 }]);
  } catch (err: any) {
    unknownThrew = true;
    assert(err.message.includes('not found in the verified store catalog'), 'Unknown Product', 'Unknown product rejected fail-closed');
  }
  assert(unknownThrew, 'Fail Closed Check', 'calculateAuthoritativeTotals throws on unverified product');

  // 2.2 Invalid quantity checks
  for (const invalidQty of [0, -1, 101, NaN, 'abc']) {
    let threw = false;
    try {
      calculateAuthoritativeTotals([{ productId: 'prod-polaroid-classic', quantity: invalidQty as any }]);
    } catch {
      threw = true;
    }
    assert(threw, 'Invalid Quantity Check', `Invalid quantity (${invalidQty}) rejected`);
  }

  // 2.3 Server-side order validation endpoint rejects unknown product
  const valRes = await fetch(`${BASE_URL}/api/orders/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'hacked_fake_item', quantity: 1 }],
    }),
  });
  assert(valRes.status === 400, 'Server Validation Fail-Closed', 'Unknown product rejected with 400 Bad Request');

  // 2.4 Server-side order creation rejects payment methods other than 'cod'
  const onlineOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Test Customer',
      customerPhone: '9876543210',
      userEmail: 'customer@example.com',
      shippingAddress: {
        addressLine1: '123 Test Street, Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560066',
      },
      items: [{ productId: 'prod-polaroid-classic', quantity: 1 }],
      paymentMethod: 'razorpay',
    }),
  });
  assert(onlineOrderRes.status === 400, 'COD-Only Enforcement', 'Non-COD payment method "razorpay" rejected with 400 Bad Request');

  // ----------------------------------------------------
  // TEST GROUP 3: Media Access Isolation (Private Customer Media)
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 3: Media Access Isolation ---');

  const testCustomerPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // 3.1 Customer upload (automatically marked private)
  const custUploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'customer',
    },
    body: JSON.stringify({
      fileData: testCustomerPng,
      fileName: 'private_customer_photo.png',
    }),
  });
  const custUploadData = await custUploadRes.json();
  console.log('UPLOAD STATUS:', custUploadRes.status, custUploadData);
  assert(custUploadRes.ok, 'Customer Upload', 'Customer photo uploaded successfully');
  assert(custUploadData.visibility === 'private', 'Customer Privacy', 'Customer upload has visibility: private');

  // 3.2 Unauthenticated GET /api/images/:id on private asset must return 403
  const unauthImageRes = await fetch(`${BASE_URL}/api/images/${custUploadData.id}`);
  assert(unauthImageRes.status === 403, 'Media Isolation', 'Unauthenticated request to private photo returns 403 Forbidden');

  // 3.3 Unauthenticated HEAD /api/images/:id on private asset must return 403
  const unauthHeadRes = await fetch(`${BASE_URL}/api/images/${custUploadData.id}`, { method: 'HEAD' });
  assert(unauthHeadRes.status === 403, 'Media Isolation HEAD', 'Unauthenticated HEAD probe returns 403 Forbidden');

  // 3.4 Different user attempting to access private asset must return 403
  const hackerImageRes = await fetch(`${BASE_URL}/api/images/${custUploadData.id}`, {
    headers: { 'x-guest-session': 'different_stranger_session_999999' },
  });
  assert(hackerImageRes.status === 403, 'Media Isolation Cross-User', 'Stranger accessing another customer photo returns 403 Forbidden');

  // 3.5 Owner accessing private asset returns 200
  const ownerImageRes = await fetch(`${BASE_URL}/api/images/${custUploadData.id}`, {
    headers: { 'x-test-auth': 'customer' },
  });
  assert(ownerImageRes.status === 200, 'Owner Access', 'Owner can access their own private photo (200 OK)');

  // 3.6 Admin accessing private asset returns 200
  const adminImageRes = await fetch(`${BASE_URL}/api/images/${custUploadData.id}`, {
    headers: { 'x-test-auth': 'admin' },
  });
  assert(adminImageRes.status === 200, 'Admin Access', 'Admin sukeshkavin@gmail.com can inspect photo for printing (200 OK)');

  // 3.7 Admin bulk upload marks assets public
  const adminBulkRes = await fetch(`${BASE_URL}/api/upload-bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'admin',
    },
    body: JSON.stringify({
      files: [{ fileData: testCustomerPng, fileName: 'catalog_cover.png' }],
    }),
  });
  const bulkData = await adminBulkRes.json();
  assert(adminBulkRes.ok && bulkData.files.length > 0, 'Admin Bulk Upload', 'Admin bulk upload succeeds');
  const catalogMediaId = bulkData.files[0].id;

  // 3.8 Public catalog media accessible without authentication
  const publicMediaRes = await fetch(`${BASE_URL}/api/images/${catalogMediaId}`);
  assert(publicMediaRes.status === 200, 'Public Catalog Media', 'Public catalog media readable without authentication (200 OK)');

  // ----------------------------------------------------
  // TEST GROUP 4: Order Status State Transitions
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 4: Order Lifecycle & State Machine ---');

  // 4.1 Invalid order status rejected
  const invalidStatusRes = await fetch(`${BASE_URL}/api/admin/orders/fake_order_123/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'admin',
    },
    body: JSON.stringify({
      status: 'bogus_status_string',
    }),
  });
  assert(invalidStatusRes.status === 400, 'State Machine Validation', 'Invalid status "bogus_status_string" rejected with 400');

  // 4.2 Non-admin cannot change order status
  const unauthStatusRes = await fetch(`${BASE_URL}/api/admin/orders/fake_order_123/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'customer',
    },
    body: JSON.stringify({
      status: 'confirmed',
    }),
  });
  assert(unauthStatusRes.status === 403, 'RBAC Status Protection', 'Customer forbidden from changing order status (403)');

  // 4.3 Payment status cannot be changed by non-admin
  const unauthPaymentRes = await fetch(`${BASE_URL}/api/admin/orders/fake_order_123/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': 'customer',
    },
    body: JSON.stringify({
      paymentStatus: 'paid',
    }),
  });
  assert(unauthPaymentRes.status === 403, 'RBAC Payment Protection', 'Customer forbidden from marking order paid (403)');

  // Summary
  console.log('\n============================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runComprehensiveTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
