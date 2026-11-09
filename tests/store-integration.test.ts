// Runs the real server on the in-memory data store and drives it over HTTP: order saving,
// retries, one-time coupons, order limits and large image storage. Needs no network or credentials.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { orderIdFromIdempotencyKey } from '../server/hardening';

const PORT = 3218;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = { 'x-test-auth': 'admin' };
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

let seq = 0;
const orderBody = (phone: string, extra: Record<string, unknown> = {}) => ({
  paymentMethod: 'cod', customerName: 'Aarav Sharma', customerPhone: phone, userEmail: `buyer${phone}@example.com`,
  shippingAddress: { addressLine1: 'Flat 402, Sunshine Apartments', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
  items: [{ productId: 'prod-custom-pocket-prints', quantity: 4, photoUrls: ['/api/images/a?token=1'] }],
  ...extra,
});
const place = (phone: string, extra: Record<string, unknown> = {}, key = `k-${Date.now()}-${seq++}`) =>
  post('/api/orders', orderBody(phone, extra), { 'Idempotency-Key': key });

(async () => {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PORT), DATA_STORE: 'memory', ALLOW_TEST_AUTH: 'true', SESSION_SECRET: 'integration-test-secret-0123456789' };
  delete env.NODE_ENV;
  const child = spawn(process.execPath, ['./node_modules/tsx/dist/cli.mjs', 'server.ts', '--dev'], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const killChild = () => {
    try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch {}
    try { child.kill('SIGKILL'); } catch {}
  };
  process.on('exit', killChild);
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 40000);
    let errOut = '';
    child.stderr.on('data', (d) => { errOut += String(d); });
    child.stdout.on('data', (d) => { if (String(d).includes('running on')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => reject(new Error('server exited early: ' + c + (errOut ? '\n' + errOut : ''))));
  });

  console.log('Server on the in-memory data store');

  await test('health and config report the active store', async () => {
    const h: any = await (await fetch(BASE + '/api/health')).json();
    assert.deepEqual([h.ok, h.store, h.fileStorage, h.sharedState], [true, 'memory', true, true]);
    const c: any = await (await fetch(BASE + '/api/config')).json();
    assert.equal(c.maxImageBytes, 10 * 1024 * 1024);
  });

  await test('an order is really saved (no undefined fields reach the database)', async () => {
    const key = 'save-' + Date.now();
    const r = await place('9000000011', { id: 'mp_attacker_id', userId: 'victim', orderNumber: 'MP-000001' }, key);
    const j: any = await r.json();
    assert.ok(r.status === 200 || r.status === 201, `status ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    assert.equal(j.order.id, orderIdFromIdempotencyKey(key));
    assert.ok(String(j.order.userId).startsWith('guest_'));
    assert.match(j.order.orderNumber, /^MP-\d{10}$/);
    const list: any = await (await fetch(BASE + '/api/admin/orders', { headers: ADMIN })).json();
    assert.ok(list.orders.some((o: any) => o.id === j.order.id), 'order missing from the stored orders');
  });

  await test('retrying the same Idempotency-Key returns the same order, not a second one', async () => {
    const key = 'retry-' + Date.now();
    const a: any = await (await place('9000000012', {}, key)).json();
    const b: any = await (await place('9000000012', {}, key)).json();
    assert.equal(a.order.id, b.order.id);
    assert.equal(b.idempotent, true);
    const list: any = await (await fetch(BASE + '/api/admin/orders', { headers: ADMIN })).json();
    assert.equal(list.orders.filter((o: any) => o.id === a.order.id).length, 1);
  });

  await test('two simultaneous requests with one key create exactly one order', async () => {
    const key = 'race-' + Date.now();
    const [a, b]: any[] = await Promise.all([place('9000000013', {}, key), place('9000000013', {}, key)].map(async (p) => (await p).json()));
    assert.equal(a.order.id, b.order.id);
    const list: any = await (await fetch(BASE + '/api/admin/orders', { headers: ADMIN })).json();
    assert.equal(list.orders.filter((o: any) => o.id === a.order.id).length, 1);
  });

  await test('a first-order coupon works once per customer, then is refused', async () => {
    const first: any = await (await place('9000000021', { couponCode: 'WELCOME50' })).json();
    assert.ok(first.order?.discount > 0 || first.order?.discountAmount > 0 || first.order?.couponCode === 'WELCOME50', 'coupon not applied: ' + JSON.stringify(first).slice(0, 200));
    const second = await place('9000000021', { couponCode: 'WELCOME50' });
    assert.equal(second.status, 400);
    assert.match(((await second.json()) as any).error, /first order/i);
    assert.ok([200, 201].includes((await place('9000000021')).status), 'same customer, no coupon, should be fine');
    assert.ok([200, 201].includes((await place('9000000022', { couponCode: 'WELCOME50' })).status), 'a different customer can use it');
  });

  await test('FIRSTMEMO15 is also limited, and email alone identifies a returning customer', async () => {
    assert.ok([200, 201].includes((await place('9000000031', { couponCode: 'FIRSTMEMO15', userEmail: 'same@example.com' })).status));
    const again = await place('9000000032', { couponCode: 'FIRSTMEMO15', userEmail: 'same@example.com' });
    assert.equal(again.status, 400);
  });

  await test('ordinary coupons stay reusable', async () => {
    for (let i = 0; i < 2; i++) assert.ok([200, 201].includes((await place('9000000041', { couponCode: 'MEMO10' })).status));
  });

  await test('more than 5 orders per customer per hour is refused', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await place('9000000051')).status);
    assert.deepEqual(codes.map((c) => c === 429), [false, false, false, false, false, true, true]);
  });

  await test('a 3 MB photo is stored as a file and comes back byte for byte', async () => {
    const bytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(3 * 1024 * 1024), Buffer.from([0xff, 0xd9])]);
    const r = await post('/api/upload', { fileData: `data:image/jpeg;base64,${bytes.toString('base64')}`, fileName: 'big.jpg' }, ADMIN);
    const j: any = await r.json();
    assert.equal(r.status, 200, JSON.stringify(j).slice(0, 200));
    assert.equal(j.sizeBytes, bytes.length);
    const back = Buffer.from(await (await fetch(BASE + j.canonicalUrl, { headers: ADMIN })).arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(back).digest('hex'), crypto.createHash('sha256').update(bytes).digest('hex'));
  });

  killChild();
  console.log(`\n${passed} passed`);
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
