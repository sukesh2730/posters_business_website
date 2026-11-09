import assert from 'node:assert/strict';
import { AdminStore, ClientStore, MemoryStore, DataStore, createAdminStore } from '../server/store';

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e: any) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

// A tiny stand-in for the Firebase Admin Firestore, enough to exercise AdminStore's logic.
class FakeFirestore {
  cols = new Map<string, Map<string, any>>();
  private c(n: string) { if (!this.cols.has(n)) this.cols.set(n, new Map()); return this.cols.get(n)!; }
  collection(name: string) {
    const col = this.c(name);
    const snap = (id: string) => ({ exists: col.has(id), id, data: () => structuredClone(col.get(id)) });
    const list = (rows: [string, any][]) => ({ forEach: (fn: any) => rows.forEach(([id, v]) => fn({ id, data: () => structuredClone(v) })) });
    return {
      doc: (id: string) => ({
        get: async () => snap(id),
        set: async (d: any, opts?: any) => {
          if (opts?.merge) {
            const cur = { ...(col.get(id) || {}) };
            for (const [k, v] of Object.entries(d) as [string, any][]) cur[k] = v && v.__inc ? (cur[k] || 0) + v.__inc : v;
            col.set(id, cur);
          } else col.set(id, d);
        },
        create: async (d: any) => {
          if (col.has(id)) { const e: any = new Error('6 ALREADY_EXISTS: Document already exists'); e.code = 6; throw e; }
          col.set(id, d);
        },
        update: async (d: any) => { if (!col.has(id)) throw new Error('NOT_FOUND'); col.set(id, { ...col.get(id), ...d }); },
      }),
      get: async () => list([...col.entries()]),
      where: (f: string, _op: string, v: any) => ({ limit: (n: number) => ({ get: async () => list([...col.entries()].filter(([, d]) => d[f] === v).slice(0, n)) }) }),
    };
  }
}
class FakeBucket {
  files = new Map<string, Buffer>();
  file(p: string) {
    return {
      save: async (d: Buffer) => { this.files.set(p, Buffer.from(d)); },
      exists: async () => [this.files.has(p)] as [boolean],
      download: async () => [this.files.get(p)!] as [Buffer],
    };
  }
}

const sharedBehaviour = (label: string, make: () => DataStore) => {
  test(`${label}: set/get/update/list round trip`, async () => {
    const s = make();
    await s.setDoc('products', 'p1', { name: 'A', price: 10 });
    assert.deepEqual(await s.getDoc('products', 'p1'), { name: 'A', price: 10 });
    assert.equal(await s.getDoc('products', 'nope'), null);
    await s.updateDoc('products', 'p1', { price: 20 });
    assert.equal((await s.getDoc('products', 'p1'))!.price, 20);
    const all = await s.listDocs('products');
    assert.equal(all.length, 1);
    assert.equal(all[0].id, 'p1');
  });
  test(`${label}: createDoc creates once and reports duplicates`, async () => {
    const s = make();
    assert.equal(await s.createDoc('orders', 'o1', { a: 1 }), true);
    assert.equal(await s.createDoc('orders', 'o1', { a: 2 }), false);
    assert.equal((await s.getDoc('orders', 'o1'))!.a, 1); // the first write wins
  });
  test(`${label}: concurrent createDoc with the same id has exactly one winner`, async () => {
    const s = make();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => s.createDoc('orders', 'race', { i })));
    assert.equal(results.filter(Boolean).length, 1);
  });
  test(`${label}: finds orders by email or phone, without duplicates`, async () => {
    const s = make();
    await s.setDoc('orders', 'a', { userEmail: 'x@y.com', customerPhone: '9000000001' });
    await s.setDoc('orders', 'b', { userEmail: 'other@y.com', customerPhone: '9000000001' });
    await s.setDoc('orders', 'c', { userEmail: 'z@y.com', customerPhone: '9000000002' });
    assert.equal((await s.findOrdersByContact({ phone: '9000000001' }, 10)).length, 2);
    assert.equal((await s.findOrdersByContact({ email: 'x@y.com', phone: '9000000001' }, 10)).length, 2);
    assert.equal((await s.findOrdersByContact({ email: 'nobody@y.com' }, 10)).length, 0);
    assert.equal((await s.findOrdersByContact({ phone: '9000000001' }, 1)).length, 1);
  });
  test(`${label}: shared counter allows up to the limit then blocks`, async () => {
    const s = make();
    const r = [];
    for (let i = 0; i < 5; i++) r.push((await s.hit('ip:1', 60000, 3)).allowed);
    assert.deepEqual(r, [true, true, true, false, false]);
    assert.equal((await s.hit('ip:2', 60000, 3)).allowed, true); // other keys unaffected
    assert.ok((await s.hit('ip:1', 60000, 3)).retryAfter >= 1);
  });
  test(`${label}: stores and returns file bytes`, async () => {
    const s = make();
    assert.equal(s.supportsBlobs, true);
    const bytes = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256));
    await s.putBlob('media/x.jpg', bytes, 'image/jpeg');
    assert.ok(bytes.equals((await s.getBlob('media/x.jpg'))!));
    assert.equal(await s.getBlob('media/missing.jpg'), null);
  });
};

(async () => {
  console.log('Data store backends');
  sharedBehaviour('MemoryStore', () => new MemoryStore());
  sharedBehaviour('AdminStore', () => new AdminStore(new FakeFirestore() as any, new FakeBucket() as any, (n) => ({ __inc: n })));

  await test('MemoryStore rejects undefined fields like Firestore does', async () => {
    const s = new MemoryStore();
    await assert.rejects(s.setDoc('orders', 'x', { a: 1, couponCode: undefined }), /undefined/);
    await assert.rejects(s.createDoc('orders', 'y', { items: [{ caption: undefined }] }), /undefined/);
  });
  await test('AdminStore without a storage bucket reports no file support', async () => {
    const s = new AdminStore(new FakeFirestore() as any, null, (n) => n);
    assert.equal(s.supportsBlobs, false);
    await assert.rejects(s.putBlob('a', Buffer.from('x'), 'image/jpeg'), /bucket/i);
    assert.equal(await s.getBlob('a'), null);
  });
  await test('AdminStore rethrows real errors from createDoc (only "already exists" means false)', async () => {
    const fs: any = new FakeFirestore();
    const orig = fs.collection.bind(fs);
    fs.collection = (n: string) => ({ ...orig(n), doc: () => ({ create: async () => { throw new Error('PERMISSION_DENIED'); } }) });
    await assert.rejects(new AdminStore(fs, null, (n) => n).createDoc('orders', 'x', {}), /PERMISSION_DENIED/);
  });
  await test('ClientStore (fallback) reports what it cannot do', async () => {
    const s = new ClientStore({ db: {}, doc: () => ({}), getDoc: async () => ({ exists: () => false }), setDoc: async () => {}, updateDoc: async () => {}, getDocs: async () => ({ forEach: () => {} }), collection: () => ({}) });
    assert.equal(s.supportsBlobs, false);
    assert.equal(s.supportsSharedState, false);
    await assert.rejects(s.findOrdersByContact(), /Admin SDK/);
    assert.equal((await s.hit()).allowed, true);
  });

  await test('createAdminStore fails cleanly (never crashes the process) with bad or missing credentials', async () => {
    await assert.rejects(createAdminStore({ serviceAccountJson: 'not json at all' }));
    await assert.rejects(createAdminStore({ serviceAccountJson: '{"type":"service_account"}' }));
    await assert.rejects(createAdminStore({ projectId: 'demo' }), /(credentials|permission_denied)/i); // no key and no Google environment
  });

  await new Promise((r) => setTimeout(r, 50));
  console.log(`\n${passed} passed`);
})();
