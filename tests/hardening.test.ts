import assert from 'node:assert/strict';
import {
  BoundedMap,
  BoundedMediaCache,
  normalizeCatalogPrice,
  orderIdFromIdempotencyKey,
  sanitizeClientPhotoUrls,
  stripUndefined,
  withTimeout,
} from '../server/hardening';

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e: any) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
};

(async () => {
  console.log('Server hardening helpers');

  await test('stripUndefined removes undefined deeply, keeps null/0/false/empty', () => {
    const out: any = stripUndefined({ a: 1, b: undefined, c: null, d: 0, e: false, f: '', g: { h: undefined, i: [1, undefined, { j: undefined, k: 2 }] } });
    assert.deepEqual(out, { a: 1, c: null, d: 0, e: false, f: '', g: { i: [1, { k: 2 }] } });
  });

  await test('stripUndefined output has no undefined anywhere (what Firestore requires)', () => {
    const order = { couponCode: undefined, shippingAddress: { addressLine2: undefined, city: 'Chennai' }, items: [{ caption: undefined, qty: 1 }] };
    assert.ok(!JSON.stringify(Object.entries(stripUndefined(order))).includes('undefined'));
    const walk = (v: any) => { if (v === undefined) throw new Error('undefined left'); if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(stripUndefined(order));
  });

  await test('catalog prices: never invent a default', () => {
    assert.equal(normalizeCatalogPrice(199), 199);
    assert.equal(normalizeCatalogPrice('249'), 249);
    for (const bad of [undefined, null, '', 'abc', 0, -5, NaN, Infinity, 5_000_000]) assert.equal(normalizeCatalogPrice(bad), null, String(bad));
  });

  await test('photo urls: accepts durable links, rejects unsafe or unfinished ones', () => {
    assert.deepEqual(sanitizeClientPhotoUrls(['/api/images/abc?token=1', 'https://x.com/a.jpg']), ['/api/images/abc?token=1', 'https://x.com/a.jpg']);
    assert.deepEqual(sanitizeClientPhotoUrls(undefined), []);
    for (const bad of ['blob:http://a/1', 'data:image/png;base64,AA', 'javascript:alert(1)', '//evil.com/x', 'http://plain.com/x.jpg']) {
      assert.throws(() => sanitizeClientPhotoUrls([bad]), /finished uploading/);
    }
    assert.throws(() => sanitizeClientPhotoUrls(Array(41).fill('/api/images/a')), /Too many/);
  });

  await test('idempotency key maps to one stable order id', () => {
    const a = orderIdFromIdempotencyKey('key-1');
    assert.equal(a, orderIdFromIdempotencyKey(' key-1 '));
    assert.notEqual(a, orderIdFromIdempotencyKey('key-2'));
    assert.match(a, /^mp_[0-9a-f]{24}$/);
  });

  await test('withTimeout rejects slow work and passes fast work', async () => {
    assert.equal(await withTimeout(Promise.resolve(7), 100, 'x'), 7);
    await assert.rejects(withTimeout(new Promise(() => {}), 30, 'too slow'), /too slow/);
  });

  await test('media cache evicts least recently used and never exceeds its byte limit', () => {
    const c = new BoundedMediaCache<{ sizeBytes: number }>(100);
    c.set('a', { sizeBytes: 40 }); c.set('b', { sizeBytes: 40 });
    c.get('a'); // a is now most recent
    c.set('c', { sizeBytes: 40 }); // must evict b
    assert.ok(c.has('a') && c.has('c') && !c.has('b'));
    assert.ok(c.totalBytes <= 100);
    c.set('huge', { sizeBytes: 500 }); // larger than the whole cache: skipped
    assert.ok(!c.has('huge') && c.totalBytes <= 100);
    c.set('a', { sizeBytes: 10 }); // replacing updates the byte count
    assert.equal(c.totalBytes, 50);
    for (let i = 0; i < 1000; i++) c.set(`k${i}`, { sizeBytes: 30 });
    assert.ok(c.totalBytes <= 100 && c.size <= 3);
  });

  await test('bounded map keeps only the newest entries', () => {
    const m = new BoundedMap<string, number>(3);
    for (let i = 0; i < 10; i++) m.set(`k${i}`, i);
    assert.equal(m.size, 3);
    assert.ok(m.has('k9') && m.has('k8') && m.has('k7') && !m.has('k0'));
  });

  console.log(`\n${passed} passed`);
})();
