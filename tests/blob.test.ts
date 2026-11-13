import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BlobOverlayStore, createS3Backend, s3ConfigFromEnv } from '../server/blobBackends';
import { MemoryStore } from '../server/store';
import { startMockS3 } from './helpers/mockS3';

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

(async () => {
  console.log('Free image storage (S3 / R2)');
  const s3 = await startMockS3('photos');
  const cfg = { endpoint: s3.url, bucket: 'photos', accessKeyId: 'k', secretAccessKey: 's', name: 'r2' };
  const backend = createS3Backend(cfg);

  await test('settings are read from the environment, and incomplete settings mean "not configured"', () => {
    assert.equal(s3ConfigFromEnv({}), null);
    assert.equal(s3ConfigFromEnv({ R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 'b' } as any), null); // no bucket
    assert.equal(s3ConfigFromEnv({ R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 'b', R2_BUCKET: 'x' } as any), null); // no account or endpoint
    const c = s3ConfigFromEnv({ R2_ACCOUNT_ID: 'acct1', R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 'b', R2_BUCKET: 'x' } as any)!;
    assert.equal(c.endpoint, 'https://acct1.r2.cloudflarestorage.com');
    assert.equal(c.name, 'r2');
    assert.equal(s3ConfigFromEnv({ R2_ENDPOINT: 'http://h:1', R2_ACCESS_KEY_ID: 'a', R2_SECRET_ACCESS_KEY: 'b', R2_BUCKET: 'x' } as any)!.endpoint, 'http://h:1');
  });

  await test('the bucket check passes for a real bucket and explains a missing one', async () => {
    await backend.check();
    await assert.rejects(createS3Backend({ ...cfg, bucket: 'nope' }).check(), /not found/i);
  });

  await test('a 3 MB photo is saved and read back byte for byte', async () => {
    const bytes = crypto.randomBytes(3 * 1024 * 1024);
    await backend.put('media/abc.jpg', bytes, 'image/jpeg');
    assert.ok(s3.objects.get('media/abc.jpg')!.equals(bytes), 'what the bucket holds differs');
    assert.ok((await backend.get('media/abc.jpg'))!.equals(bytes), 'what we read back differs');
  });

  await test('a missing file reads as null, not an error', async () => {
    assert.equal(await backend.get('media/missing.jpg'), null);
  });

  await test('the overlay store sends files to the bucket and everything else to the database', async () => {
    const base = new MemoryStore();
    const store = new BlobOverlayStore(base, backend);
    assert.deepEqual([store.mode, store.supportsBlobs, store.blobProvider], ['memory', true, 'r2']);
    await store.setDoc('orders', 'o1', { a: 1 });
    assert.deepEqual(await base.getDoc('orders', 'o1'), { a: 1 });
    assert.equal(await store.createDoc('orders', 'o1', { a: 2 }), false);
    await store.putBlob('media/x.png', Buffer.from('png-bytes'), 'image/png');
    assert.ok(s3.objects.has('media/x.png'));
    assert.equal((await store.getBlob('media/x.png'))!.toString(), 'png-bytes');
    assert.equal((await base.getBlob('media/x.png')), null); // not stored in the base store
  });

  await test('an unreachable bucket fails fast with a readable reason', async () => {
    const dead = createS3Backend({ ...cfg, endpoint: 'http://127.0.0.1:9' });
    await assert.rejects(dead.check());
  });

  s3.close();
  console.log(`\n${passed} passed`);
  process.exit(process.exitCode || 0);
})();
