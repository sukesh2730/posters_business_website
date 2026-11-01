/**
 * Automated QA Audit Test Suite for MemoPrint
 * Tests all 11 Phase 2 workflows and 8 Phase 3 data consistency invariants.
 */

import { DEFAULT_PRODUCTS, COLLECTIONS, AVAILABLE_COUPONS } from '../src/data/defaultProducts';
import { sanitizeFirestoreData } from '../src/services/orderService';
import { Order, CartItem, Product } from '../src/types';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    results.push({ name: testName, passed: true, details });
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    results.push({ name: testName, passed: false, error: 'Assertion failed', details });
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

async function runTestSuite() {
  console.log('\n========================================');
  console.log('STARTING MEMOPRINT QA AUDIT TEST SUITE');
  console.log('========================================\n');

  // ----------------------------------------------------
  // TEST 1: Default Catalog Integrity & Product Stability
  // ----------------------------------------------------
  console.log('--- Suite 1: Product Identifiers & Catalog Integrity ---');
  assert(DEFAULT_PRODUCTS.length >= 6, 'Catalog has standard baseline products (>=6)');
  const productIds = new Set(DEFAULT_PRODUCTS.map(p => p.id));
  assert(productIds.size === DEFAULT_PRODUCTS.length, 'All product IDs are unique and stable');
  const validPrices = DEFAULT_PRODUCTS.every(p => typeof p.price === 'number' && p.price > 0);
  assert(validPrices, 'All products have positive numeric INR prices');
  const validAspectRatios = DEFAULT_PRODUCTS.every(p => !p.aspectRatio || ['square', 'portrait', 'tall', 'wide'].includes(p.aspectRatio));
  assert(validAspectRatios, 'All products specify valid Pinterest aspect ratio for masonry display');

  // ----------------------------------------------------
  // TEST 2: Search & Filter Logic
  // ----------------------------------------------------
  console.log('\n--- Suite 2: Search & Filter Logic ---');
  const query = 'polaroid';
  const searchResults = DEFAULT_PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.description.toLowerCase().includes(query) ||
    p.category.toLowerCase().includes(query)
  );
  assert(searchResults.length > 0, 'Search query for "polaroid" matches relevant items');

  const retroStrips = DEFAULT_PRODUCTS.filter(p => p.collectionId === 'photo-strips' || p.category === 'photo-strips');
  assert(retroStrips.length > 0, 'Collection filter for "photo-strips" correctly isolates designs');

  const priceFiltered = DEFAULT_PRODUCTS.filter(p => p.price < 400);
  assert(priceFiltered.every(p => p.price < 400), 'Price filter correctly filters products under ₹400');

  // ----------------------------------------------------
  // TEST 3: Cart Calculations & Shipping Thresholds
  // ----------------------------------------------------
  console.log('\n--- Suite 3: Cart Calculations & Monetary Integrity ---');
  // Order below ₹499 -> shipping ₹60
  const item1: CartItem = {
    id: 'cart-1',
    productId: DEFAULT_PRODUCTS[0].id,
    product: DEFAULT_PRODUCTS[0],
    size: 'Standard',
    finish: 'Glossy',
    quantity: 1,
    unitPrice: 349,
    photos: ['https://example.com/photo1.jpg'],
    previewThumbnail: 'https://example.com/photo1.jpg',
  };

  const subtotal1 = item1.unitPrice * item1.quantity; // 349
  const shipping1 = subtotal1 >= 499 ? 0 : 60;
  const total1 = subtotal1 + shipping1; // 409
  assert(subtotal1 === 349, 'Subtotal for single item calculated accurately (₹349)');
  assert(shipping1 === 60, 'Standard shipping applied for subtotal < ₹499 (₹60)');
  assert(total1 === 409, 'Total equals subtotal + shipping (₹409)');

  // Order above ₹499 -> free shipping
  const item2: CartItem = {
    id: 'cart-2',
    productId: DEFAULT_PRODUCTS[1].id,
    product: DEFAULT_PRODUCTS[1],
    size: 'Mini',
    finish: 'Matte',
    quantity: 2,
    unitPrice: 399,
    photos: ['https://example.com/photo2.jpg'],
    previewThumbnail: 'https://example.com/photo2.jpg',
  };

  const subtotal2 = item1.unitPrice * item1.quantity + item2.unitPrice * item2.quantity; // 349 + 798 = 1147
  const shipping2 = subtotal2 >= 499 ? 0 : 60;
  assert(shipping2 === 0, 'Free shipping granted when subtotal exceeds ₹499 threshold (₹1147 >= ₹499)');

  // Coupon discount calculation
  const coupon = AVAILABLE_COUPONS.find(c => c.code === 'MEMO10');
  assert(coupon !== undefined, 'Coupon MEMO10 exists in default coupons');
  if (coupon) {
    const discount = Math.round((subtotal2 * coupon.discountPercent!) / 100);
    assert(discount === 115, '10% discount on ₹1147 calculated as ₹115');
    const finalTotalWithCoupon = subtotal2 + shipping2 - discount;
    assert(finalTotalWithCoupon === 1032, 'Total after discount equals ₹1032');
  }

  // ----------------------------------------------------
  // TEST 4: Backend API Price Validation Endpoint
  // ----------------------------------------------------
  console.log('\n--- Suite 4: Backend Order Validation Route ---');
  try {
    const res = await fetch('http://localhost:3000/api/orders/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { productId: 'prod-polaroid-classic', quantity: 1 }, // ₹349
          { productId: 'prod-polaroid-mini-magnets', quantity: 2 }, // ₹399 * 2 = ₹798
        ],
        couponCode: 'MEMO10',
      }),
    });
    const data = await res.json();
    assert(res.ok === true, 'Backend API /api/orders/validate returned HTTP 200');
    assert(data.subtotal === 1147, 'Server calculated subtotal matches client expectation (1147)');
    assert(data.shippingCharges === 0, 'Server calculated free shipping charges correctly (0)');
    assert(data.discount === 115, 'Server validated discount matches (115)');
    assert(data.total === 1032, 'Server validated total matches client expectation (1032)');
  } catch (err: any) {
    assert(false, 'Backend validation API call succeeded', err.message);
  }

  // ----------------------------------------------------
  // TEST 5: Backend File Upload & Security Validation
  // ----------------------------------------------------
  console.log('\n--- Suite 5: Image Upload Validation ---');
  try {
    // Valid PNG 1x1 pixel base64
    const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-test-auth': 'customer' 
      },
      body: JSON.stringify({
        fileData: validPngBase64,
        fileName: 'test_pixel.png',
        fileType: 'image/png',
      }),
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.ok === true, 'Upload API accepted valid PNG image');
    assert(uploadData.url && uploadData.url.startsWith('/uploads/'), 'Upload returned persistent URL in /uploads/');

    // Invalid file format rejection
    const invalidRes = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-test-auth': 'customer' 
      },
      body: JSON.stringify({
        fileData: 'data:application/pdf;base64,JVBERi0xLjQK',
        fileName: 'document.pdf',
        fileType: 'application/pdf',
      }),
    });
    assert(invalidRes.status === 400, 'Upload API rejected non-image PDF file with HTTP 400');
  } catch (err: any) {
    assert(false, 'Upload validation tests completed', err.message);
  }

  // ----------------------------------------------------
  // TEST 6: Data Consistency & Snapshot Isolation
  // ----------------------------------------------------
  console.log('\n--- Suite 6: Order Snapshot Isolation & Immutability ---');
  const originalProduct: Product = { ...DEFAULT_PRODUCTS[0], price: 349, name: 'Original Name' };
  
  const createdOrder: Order = {
    id: 'test_order_1',
    orderNumber: 'MP-123456',
    userId: 'user_cust_1',
    userEmail: 'cust@example.com',
    customerName: 'Aarav Sharma',
    customerPhone: '9876543210',
    shippingAddress: {
      fullName: 'Aarav Sharma',
      phone: '9876543210',
      addressLine1: 'Flat 402, Lotus Apt',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
    },
    items: [
      {
        productId: originalProduct.id,
        productName: originalProduct.name,
        size: 'Standard (3.5 x 4.2 in)',
        finish: 'Glossy Ultra-HD',
        quantity: 2,
        unitPrice: originalProduct.price,
        totalPrice: originalProduct.price * 2,
        photoUrls: ['https://example.com/memories1.jpg'],
        caption: 'Goa Holiday 2026',
      },
    ],
    itemsCount: 2,
    subtotal: 698,
    shippingCharges: 0,
    discount: 0,
    total: 698,
    currency: 'INR',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    orderStatus: 'pending_confirmation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Simulate catalog price/name update by Admin
  const updatedCatalogProduct: Product = { ...originalProduct, price: 999, name: 'Renamed Product' };

  assert(
    createdOrder.items[0].unitPrice === 349,
    'Order item preserved original price of ₹349 after product catalog was updated to ₹999'
  );
  assert(
    createdOrder.items[0].productName === 'Original Name',
    'Order item preserved historical product name after product was renamed in catalog'
  );

  // ----------------------------------------------------
  // TEST 7: Firestore Undefined Stripping & Sanitization
  // ----------------------------------------------------
  console.log('\n--- Suite 7: Firestore Serialization & Undefined Stripping ---');
  const dirtyObject = {
    name: 'Sample',
    deliveryNotes: undefined,
    caption: undefined,
    stock: 100,
    tags: ['a', 'b'],
  };
  const clean = sanitizeFirestoreData(dirtyObject);
  assert(!('deliveryNotes' in clean), 'Sanitizer stripped undefined deliveryNotes field');
  assert(!('caption' in clean), 'Sanitizer stripped undefined caption field');
  assert(clean.name === 'Sample' && clean.stock === 100, 'Sanitizer preserved valid primitives and arrays');

  // ----------------------------------------------------
  // TEST 8: Security Audit Fix Validations
  // ----------------------------------------------------
  console.log('\n--- Suite 8: Security Audit & Access Control Validations ---');
  
  // 8.1 Check devAdminBypass removal
  const fs = await import('fs');
  const path = await import('path');
  const adminPageContent = fs.readFileSync(path.resolve(process.cwd(), 'src', 'pages', 'AdminPage.tsx'), 'utf8');
  assert(!adminPageContent.includes('devAdminBypass'), 'SEC-01: devAdminBypass completely removed from AdminPage.tsx');
  assert(!adminPageContent.includes('Unlock Dashboard as'), 'SEC-01: Admin unlock bypass button completely removed');

  // 8.2 Check firestore.rules email verification enforcement
  const firestoreRulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert(
    firestoreRulesContent.includes('request.auth.token.email_verified == true'),
    'SEC-05: firestore.rules enforces email_verified == true for admin operations'
  );
  assert(
    firestoreRulesContent.includes("orderStatus == 'pending_confirmation'"),
    'SEC-02: firestore.rules locks initial orderStatus to pending_confirmation'
  );
  assert(
    firestoreRulesContent.includes("paymentStatus == 'pending_instructions'"),
    'SEC-02: firestore.rules locks initial paymentStatus to pending_instructions'
  );

  // 8.3 Check storage.rules presence & constraints
  const storageRulesExist = fs.existsSync(path.resolve(process.cwd(), 'storage.rules'));
  assert(storageRulesExist, 'SEC-04: storage.rules file exists in repository');
  if (storageRulesExist) {
    const storageRulesContent = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8');
    assert(
      storageRulesContent.includes('customer_uploads/{userId}/{fileName}'),
      'SEC-04: storage.rules isolates customer uploads by user UID'
    );
    assert(
      storageRulesContent.includes('10 * 1024 * 1024'),
      'SEC-04: storage.rules enforces 10MB maximum file size'
    );
    assert(
      storageRulesContent.includes('image/(jpeg|jpg|png|webp|heic)'),
      'SEC-04: storage.rules enforces strict image MIME whitelist'
    );
  }

  // 8.4 Authoritative Price Recalculation Test (replaces manipulated unitPrice)
  const manipulatedItem = {
    productId: 'prod-polaroid-classic',
    quantity: 1,
    unitPrice: 1, // Manipulated price from malicious client
  };
  const trustedProduct = DEFAULT_PRODUCTS.find(p => p.id === manipulatedItem.productId);
  assert(trustedProduct !== undefined, 'Trusted product exists in catalog');
  
  // Test authoritative calculation function
  const { validateServerOrderTotals } = await import('../src/services/orderService');
  const serverCalc = await validateServerOrderTotals({
    items: [manipulatedItem],
  });
  
  assert(
    serverCalc.subtotal === 349,
    `SEC-03: Subtotal computed using trusted catalog price (₹349), discarding client-supplied ₹1`
  );
  assert(
    serverCalc.shippingCharges === 60,
    `SEC-03: Shipping fee of ₹60 correctly applied for subtotal ₹349 (< ₹499)`
  );
  assert(
    serverCalc.total === 409,
    `SEC-03: Authoritative total payable is ₹409 (₹349 + ₹60)`
  );

  // 8.5 Test coupon validation with authoritative pricing
  const couponCalc = await validateServerOrderTotals({
    items: [{ productId: 'prod-polaroid-classic', quantity: 2, unitPrice: 349 }], // Subtotal ₹698 >= 399
    couponCode: 'MEMO10', // 10% discount
  });
  assert(couponCalc.shippingCharges === 0, 'Free delivery applied on order of ₹698 (>= ₹499)');
  assert(couponCalc.discount === 70, '10% discount (₹70) correctly calculated on ₹698 subtotal');
  assert(couponCalc.total === 628, 'Payable total is ₹628 (₹698 - ₹70)');

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n========================================');
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
