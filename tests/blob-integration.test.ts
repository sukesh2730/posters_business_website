// The real server with R2-style image storage (a fake S3 service) and the catalogue cache, driven over HTTP.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { startMockS3 } from './helpers/mockS3';

const PORT = 3219;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = { 'x-test-auth': 'admin' };
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
const j = async (path: string, init?: RequestInit) => (await fetch(BASE + path, init)).json() as Promise<any>;

(async () => {
  const s3 = await startMockS3('memoprint-photos');
  const env: NodeJS.ProcessEnv = {
    ...process.env, PORT: String(PORT), DATA_STORE: 'memory', SESSION_SECRET: 'integration-test-secret-0123456789',
    R2_ENDPOINT: s3.url, R2_BUCKET: 'memoprint-photos', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's',
    DOTENV_CONFIG_PATH: '/dev/null', CATALOG_CACHE_SECONDS: '300',
  };
  delete env.NODE_ENV; delete env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const child = spawn('npx', ['tsx', 'server.ts', '--dev'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  process.on('exit', () => { try { child.kill('SIGKILL'); } catch {} s3.close(); });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 40000);
    child.stdout.on('data', (d) => { if (String(d).includes('running on')) { clearTimeout(t); resolve(); } });
    child.on('exit', (c) => reject(new Error('server exited early: ' + c)));
  });

  console.log('Server with free image storage and the catalogue cache');

  await test('health reports the R2 image provider', async () => {
    const h = await j('/api/health');
    assert.deepEqual([h.fileStorage, h.imageProvider], [true, 'r2']);
    assert.equal((await j('/api/config')).maxImageBytes, 10 * 1024 * 1024);
  });

  await test('a 3 MB photo is stored in the bucket and served back unchanged', async () => {
    const bytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(3 * 1024 * 1024), Buffer.from([0xff, 0xd9])]);
    const r = await fetch(BASE + '/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', ...ADMIN },
      body: JSON.stringify({ fileData: `data:image/jpeg;base64,${bytes.toString('base64')}`, fileName: 'wall.jpg' }) });
    const up: any = await r.json();
    assert.equal(r.status, 200, JSON.stringify(up).slice(0, 200));
    const keys = [...s3.objects.keys()];
    assert.equal(keys.length, 1);
    assert.ok(keys[0].startsWith('media/'));
    assert.ok(s3.objects.get(keys[0])!.equals(bytes), 'the bucket does not hold the same bytes');
    const back = Buffer.from(await (await fetch(BASE + up.canonicalUrl, { headers: ADMIN })).arrayBuffer());
    assert.ok(back.equals(bytes), 'the photo served back differs');
  });

  await test('a private photo is not readable by an anonymous visitor even though it is in a bucket', async () => {
    const up: any = await (await fetch(BASE + '/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', ...ADMIN },
      body: JSON.stringify({ fileData: `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(5000), Buffer.from([0xff, 0xd9])]).toString('base64')}`, fileName: 'p.jpg' }) })).json();
    const bare = up.canonicalUrl.split('?')[0]; // same photo, without its signed token
    const r = await fetch(BASE + bare);
    assert.ok(r.status === 401 || r.status === 403 || r.status === 404, `anonymous got ${r.status}`);
  });

  await test('the catalogue is read from the database once, then served from memory', async () => {
    const before = (await j('/api/health')).catalog;
    for (let i = 0; i < 8; i++) {
      const c: any = await j('/api/catalog');
      assert.ok(Array.isArray(c.products) && Array.isArray(c.collections));
    }
    const after = (await j('/api/health')).catalog;
    assert.equal(after.loads - before.loads, 1, 'the database was read more than once');
    assert.equal(after.hits - before.hits, 7);
  });

  await test('the catalogue supports ETag and answers 304 when nothing changed', async () => {
    const first = await fetch(BASE + '/api/catalog');
    const etag = first.headers.get('etag')!;
    assert.ok(etag);
    assert.match(first.headers.get('cache-control') || '', /max-age=\d+/);
    assert.equal((await fetch(BASE + '/api/catalog', { headers: { 'If-None-Match': etag } })).status, 304);
  });

  await test('only an admin can refresh the cache, and a refresh makes the next visitor reload it once', async () => {
    const denied = await fetch(BASE + '/api/admin/catalog/refresh', { method: 'POST', headers: { ...ADMIN, 'X-Forwarded-For': '203.0.113.9' } });
    assert.equal(denied.status, 403);
    const before = (await j('/api/health')).catalog.loads;
    assert.equal((await fetch(BASE + '/api/admin/catalog/refresh', { method: 'POST', headers: ADMIN })).status, 200);
    await Promise.all(Array.from({ length: 6 }, () => fetch(BASE + '/api/catalog'))); // six visitors at once
    assert.equal((await j('/api/health')).catalog.loads - before, 1, 'simultaneous visitors should share one reload');
  });

  child.kill('SIGKILL');
  console.log(`\n${passed} passed`);
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
