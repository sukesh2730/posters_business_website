// Starts the real server the way a careless deploy would (only SESSION_SECRET set, no NODE_ENV)
// and checks the security-sensitive behaviour over HTTP. Needs `npm run build` for the page tests.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { orderIdFromIdempotencyKey } from '../server/hardening';

const PORT = 3217;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
const post = (p: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const slots = (n: number) => Array.from({ length: n }, () => ({ type: 'design', designId: 'cars-1' }));

(async () => {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PORT), SESSION_SECRET: 'integration-test-secret-0123456789', ORDER_WRITE_TIMEOUT_MS: '3000' };
  delete env.NODE_ENV; delete env.ALLOW_TEST_AUTH;
  const child = spawn(process.execPath, ['./node_modules/tsx/dist/cli.mjs', 'server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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

  console.log('Server integration (production defaults)');

  await test('starts without Google credentials and reports the fallback store', async () => {
    const h: any = await (await fetch(BASE + '/api/health')).json();
    assert.equal(h.ok, true);
    assert.equal(h.store, 'client');
  });

  await test('test-auth admin header is rejected when NODE_ENV is unset', async () => {
    const r = await fetch(BASE + '/api/admin/verify', { headers: { 'x-test-auth': 'admin' } });
    assert.equal(r.status, 403);
  });

  await test('forged builder price is ignored; wall is priced from its layout', async () => {
    const r = await post('/api/orders/validate', { items: [{ productId: 'x', quantity: 1, unitPrice: 1, builder: { kind: 'wall', layoutId: 'large', slots: slots(17) } }] });
    const j: any = await r.json();
    assert.equal(r.status, 200);
    assert.equal(j.subtotal ?? j.totals?.subtotal ?? j.items?.[0]?.unitPrice, 699);
  });

  await test('wall with the wrong number of posters is rejected', async () => {
    const r = await post('/api/orders/validate', { items: [{ quantity: 1, builder: { kind: 'wall', layoutId: 'large', slots: slots(16) } }] });
    assert.equal(r.status, 400);
  });

  await test('photo pack is priced by the server (2 x 179), client price ignored', async () => {
    const r = await post('/api/orders/validate', { items: [{ productId: 'prod-custom-retro-prints', quantity: 2, unitPrice: 1 }] });
    const j: any = await r.json();
    assert.equal(r.status, 200);
    assert.equal(j.subtotal ?? j.totals?.subtotal, 358);
  });

  await test('order creation ignores client id/userId and never reports success without saving', async () => {
    const key = 'itest-' + Date.now();
    const body = {
      id: 'mp_attacker_chosen_id', userId: 'victim-user-id', orderNumber: 'MP-000001', paymentMethod: 'cod',
      customerName: 'Aarav Sharma', customerPhone: '9876543210', userEmail: 'aarav@example.com',
      shippingAddress: { addressLine1: 'Flat 402, Sunshine Apartments', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
      items: [{ productId: 'prod-custom-pocket-prints', quantity: 1, photoUrls: ['/api/images/a?token=1'] }],
    };
    const r = await post('/api/orders', body, { 'Idempotency-Key': key });
    const j: any = await r.json();
    if (r.status === 503) {
      assert.match(j.error, /could not save|unavailable/i); // Firestore unreachable: honest failure, no fake success
      const again = await post('/api/orders', body, { 'Idempotency-Key': key });
      const aj: any = await again.json();
      assert.notEqual(aj.idempotent, true); // a failed save must not be remembered as done
    } else {
      assert.equal(r.status, 201 === r.status ? 201 : 200);
      assert.equal(j.order.id, orderIdFromIdempotencyKey(key));
      assert.ok(String(j.order.userId).startsWith('guest_'));
      assert.match(j.order.orderNumber, /^MP-\d{10}$/);
    }
  });

  await test('order with an unfinished (blob:) photo is rejected', async () => {
    const r = await post('/api/orders', {
      paymentMethod: 'cod', customerName: 'Aarav Sharma', customerPhone: '9876543210', userEmail: 'aarav@example.com',
      shippingAddress: { addressLine1: 'Flat 402, Sunshine Apartments', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
      items: [{ productId: 'prod-custom-pocket-prints', quantity: 1, photoUrls: ['blob:http://x/1'] }],
    }, { 'Idempotency-Key': 'itest-blob-' + Date.now() });
    assert.equal(r.status, 400);
  });

  await test('rate limit cannot be dodged by spoofing the left side of X-Forwarded-For', async () => {
    let limited = 0;
    for (let i = 0; i < 160; i++) {
      const r = await post('/api/orders/validate', { items: [] }, { 'X-Forwarded-For': `spoof-${i}, 203.0.113.9` });
      if (r.status === 429) limited++;
    }
    assert.ok(limited > 0, 'every spoofed request was allowed');
  });

  const dist = path.resolve(process.cwd(), 'dist/index.html');
  if (fs.existsSync(dist)) {
    await test('home page has absolute share-preview tags and no leftover placeholder', async () => {
      const html = await (await fetch(BASE + '/')).text();
      assert.ok(html.includes(`content="${BASE}/og-image.png"`));
      assert.ok(!html.includes('__SITE_URL__'));
    });
    await test('share image and favicon are served', async () => {
      const a = await fetch(BASE + '/og-image.png'); assert.equal(a.status, 200); assert.match(a.headers.get('content-type') || '', /image\/png/);
      const b = await fetch(BASE + '/favicon.svg'); assert.equal(b.status, 200);
    });
  } else console.log('  skip page tests (run npm run build first)');

  killChild();
  console.log(`\n${passed} passed`);
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
