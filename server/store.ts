// Data layer for the server. Three interchangeable backends:
//   AdminStore  - Firebase Admin SDK. Bypasses security rules, so the rules can say "server only".
//   ClientStore - the browser-style SDK the server used before. Fallback when Admin is not set up.
//   MemoryStore - in-process, for automated tests and local development only.
// Everything the server persists goes through this interface.

import crypto from 'node:crypto';

export type Doc = Record<string, any>;

export interface RateHit {
  allowed: boolean;
  retryAfter: number;
}

export interface DataStore {
  readonly mode: 'admin' | 'client' | 'memory';
  /** can hold image files outside Firestore documents (allows larger uploads) */
  readonly supportsBlobs: boolean;
  /** can run cross-order queries and shared counters (needed for one-time coupons and limits) */
  readonly supportsSharedState: boolean;
  getDoc(col: string, id: string): Promise<Doc | null>;
  setDoc(col: string, id: string, data: Doc): Promise<void>;
  /** Creates the document only if it does not exist. Returns false if it already existed. */
  createDoc(col: string, id: string, data: Doc): Promise<boolean>;
  updateDoc(col: string, id: string, data: Doc): Promise<void>;
  listDocs(col: string): Promise<Doc[]>;
  findOrdersByContact(contact: { email?: string; phone?: string }, limit: number): Promise<Doc[]>;
  /** Shared (all instances) sliding-window counter. */
  hit(key: string, windowMs: number, limit: number): Promise<RateHit>;
  putBlob(path: string, data: Buffer, contentType: string): Promise<void>;
  getBlob(path: string): Promise<Buffer | null>;
}

const hashKey = (k: string) => crypto.createHash('sha1').update(k).digest('hex');

// ----------------------------------------------------------------- memory

export class MemoryStore implements DataStore {
  readonly mode = 'memory' as const;
  readonly supportsBlobs = true;
  readonly supportsSharedState = true;
  private cols = new Map<string, Map<string, Doc>>();
  private blobs = new Map<string, Buffer>();
  private hits = new Map<string, number>();

  private col(name: string) {
    if (!this.cols.has(name)) this.cols.set(name, new Map());
    return this.cols.get(name)!;
  }
  async getDoc(col: string, id: string) {
    const d = this.col(col).get(id);
    return d ? structuredClone(d) : null;
  }
  async setDoc(col: string, id: string, data: Doc) {
    assertNoUndefined(data);
    this.col(col).set(id, structuredClone(data));
  }
  async createDoc(col: string, id: string, data: Doc) {
    assertNoUndefined(data);
    if (this.col(col).has(id)) return false;
    this.col(col).set(id, structuredClone(data));
    return true;
  }
  async updateDoc(col: string, id: string, data: Doc) {
    assertNoUndefined(data);
    const cur = this.col(col).get(id);
    if (!cur) throw new Error(`No document to update: ${col}/${id}`);
    this.col(col).set(id, { ...cur, ...structuredClone(data) });
  }
  async listDocs(col: string) {
    return [...this.col(col).entries()].map(([id, d]) => ({ id, ...structuredClone(d) }));
  }
  async findOrdersByContact({ email, phone }: { email?: string; phone?: string }, limit: number) {
    const out: Doc[] = [];
    for (const d of this.col('orders').values()) {
      if ((email && d.userEmail === email) || (phone && d.customerPhone === phone)) out.push(structuredClone(d));
      if (out.length >= limit) break;
    }
    return out;
  }
  async hit(key: string, windowMs: number, limit: number): Promise<RateHit> {
    const w = Math.floor(Date.now() / windowMs);
    const k = `${key}:${w}`;
    const n = (this.hits.get(k) || 0) + 1;
    this.hits.set(k, n);
    return n > limit ? { allowed: false, retryAfter: Math.ceil(((w + 1) * windowMs - Date.now()) / 1000) } : { allowed: true, retryAfter: 0 };
  }
  async putBlob(p: string, data: Buffer) {
    this.blobs.set(p, Buffer.from(data));
  }
  async getBlob(p: string) {
    return this.blobs.get(p) ?? null;
  }
}

/** Firestore refuses undefined anywhere in a document; the memory store enforces the same rule so tests catch it. */
function assertNoUndefined(v: unknown, path = 'document'): void {
  if (v === undefined) throw new Error(`Unsupported field value: undefined (found in ${path})`);
  if (Array.isArray(v)) v.forEach((x, i) => assertNoUndefined(x, `${path}[${i}]`));
  else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    for (const [k, x] of Object.entries(v)) assertNoUndefined(x, `${path}.${k}`);
  }
}

// ----------------------------------------------------------------- admin SDK

/** The small slice of the Admin SDK that AdminStore uses (also lets tests pass a fake). */
export interface AdminFirestoreLike {
  collection(name: string): any;
  runTransaction?: (fn: (tx: any) => Promise<any>) => Promise<any>;
}
export interface BucketLike {
  file(path: string): { save(data: Buffer, opts: any): Promise<void>; download(): Promise<[Buffer]>; exists(): Promise<[boolean]> };
}

export class AdminStore implements DataStore {
  readonly mode = 'admin' as const;
  readonly supportsSharedState = true;
  constructor(
    private fs: AdminFirestoreLike,
    private bucket: BucketLike | null,
    private increment: (n: number) => unknown
  ) {}
  get supportsBlobs() {
    return !!this.bucket;
  }
  async getDoc(col: string, id: string) {
    const s = await this.fs.collection(col).doc(id).get();
    return s.exists ? (s.data() as Doc) : null;
  }
  async setDoc(col: string, id: string, data: Doc) {
    await this.fs.collection(col).doc(id).set(data);
  }
  async createDoc(col: string, id: string, data: Doc) {
    try {
      await this.fs.collection(col).doc(id).create(data);
      return true;
    } catch (e: any) {
      if (e?.code === 6 || /already exists/i.test(String(e?.message))) return false;
      throw e;
    }
  }
  async updateDoc(col: string, id: string, data: Doc) {
    await this.fs.collection(col).doc(id).update(data);
  }
  async listDocs(col: string) {
    const snap = await this.fs.collection(col).get();
    const out: Doc[] = [];
    snap.forEach((d: any) => out.push({ id: d.id, ...d.data() }));
    return out;
  }
  async findOrdersByContact({ email, phone }: { email?: string; phone?: string }, limit: number) {
    const found = new Map<string, Doc>();
    const run = async (field: string, value?: string) => {
      if (!value) return;
      const snap = await this.fs.collection('orders').where(field, '==', value).limit(limit).get();
      snap.forEach((d: any) => found.set(d.id, d.data()));
    };
    await Promise.all([run('userEmail', email), run('customerPhone', phone)]);
    return [...found.values()].slice(0, limit);
  }
  async hit(key: string, windowMs: number, limit: number): Promise<RateHit> {
    const w = Math.floor(Date.now() / windowMs);
    const ref = this.fs.collection('rate_limits').doc(`${hashKey(key)}_${w}`);
    // expiresAt lets you add a Firestore TTL policy so old counters delete themselves.
    await ref.set({ count: this.increment(1), expiresAt: new Date((w + 2) * windowMs) }, { merge: true });
    const count = Number((await ref.get()).data()?.count || 0);
    return count > limit
      ? { allowed: false, retryAfter: Math.max(1, Math.ceil(((w + 1) * windowMs - Date.now()) / 1000)) }
      : { allowed: true, retryAfter: 0 };
  }
  async putBlob(p: string, data: Buffer, contentType: string) {
    if (!this.bucket) throw new Error('Cloud Storage bucket is not configured.');
    await this.bucket.file(p).save(data, { contentType, resumable: false });
  }
  async getBlob(p: string) {
    if (!this.bucket) return null;
    const f = this.bucket.file(p);
    const [exists] = await f.exists();
    return exists ? (await f.download())[0] : null;
  }
}

// ----------------------------------------------------------------- client SDK (fallback)

export interface ClientFns {
  db: any;
  doc: (...a: any[]) => any;
  getDoc: (ref: any) => Promise<any>;
  setDoc: (ref: any, data: any) => Promise<void>;
  updateDoc: (ref: any, data: any) => Promise<void>;
  getDocs: (q: any) => Promise<any>;
  collection: (...a: any[]) => any;
}

/**
 * Same behaviour the server had before the data layer existed. It signs in as nobody, so
 * Firestore rules still apply and cross-order queries / shared counters / file storage are
 * unavailable. The server logs a warning and /api/health reports this mode.
 */
export class ClientStore implements DataStore {
  readonly mode = 'client' as const;
  readonly supportsBlobs = false;
  readonly supportsSharedState = false;
  constructor(private f: ClientFns) {}
  async getDoc(col: string, id: string) {
    const s = await this.f.getDoc(this.f.doc(this.f.db, col, id));
    return s.exists() ? (s.data() as Doc) : null;
  }
  async setDoc(col: string, id: string, data: Doc) {
    await this.f.setDoc(this.f.doc(this.f.db, col, id), data);
  }
  async createDoc(col: string, id: string, data: Doc) {
    await this.setDoc(col, id, data);
    return true;
  }
  async updateDoc(col: string, id: string, data: Doc) {
    await this.f.updateDoc(this.f.doc(this.f.db, col, id), data);
  }
  async listDocs(col: string) {
    const snap = await this.f.getDocs(this.f.collection(this.f.db, col));
    const out: Doc[] = [];
    snap.forEach((d: any) => out.push({ id: d.id, ...d.data() }));
    return out;
  }
  async findOrdersByContact(): Promise<Doc[]> {
    throw new Error('Order history lookups need the Firebase Admin SDK.');
  }
  async hit(): Promise<RateHit> {
    return { allowed: true, retryAfter: 0 };
  }
  async putBlob(): Promise<void> {
    throw new Error('File storage needs the Firebase Admin SDK.');
  }
  async getBlob(): Promise<Buffer | null> {
    return null;
  }
}

// ----------------------------------------------------------------- admin bootstrap

export interface AdminConfig {
  projectId?: string;
  databaseId?: string;
  storageBucket?: string;
  serviceAccountJson?: string;
}

/** Returns an AdminStore, or throws with a readable reason (caller falls back to ClientStore). */
export async function createAdminStore(cfg: AdminConfig): Promise<AdminStore> {
  const { initializeApp, getApps, cert, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const { getStorage } = await import('firebase-admin/storage');

  const credential = cfg.serviceAccountJson ? cert(JSON.parse(cfg.serviceAccountJson)) : applicationDefault();

  // Check the credentials BEFORE creating any Firestore client. Without valid credentials the
  // SDK fails inside its own background code (an unhandled error that would crash the whole
  // server), so we must detect that here and let the caller fall back cleanly.
  await Promise.race([
    credential.getAccessToken(),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Google credentials did not respond within 8 seconds')), 8000)),
  ]).catch((e: any) => {
    throw new Error(`no usable Google credentials (${String(e?.message || e).split('\n')[0].slice(0, 100)})`);
  });

  const app =
    getApps().find((a) => a.name === 'memoprint-admin') ||
    initializeApp({ credential, projectId: cfg.projectId, storageBucket: cfg.storageBucket }, 'memoprint-admin');
  const fs = cfg.databaseId && cfg.databaseId !== '(default)' ? getFirestore(app, cfg.databaseId) : getFirestore(app);

  // Prove the credentials work before we rely on them.
  await Promise.race([
    fs.collection('test').doc('connection').get(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Firestore did not answer within 8 seconds')), 8000)),
  ]);

  let bucket: BucketLike | null = null;
  if (cfg.storageBucket) {
    try {
      const b = getStorage(app).bucket(cfg.storageBucket);
      const [exists] = await Promise.race([
        b.exists(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Storage did not answer within 8 seconds')), 8000)),
      ]);
      if (exists) bucket = b as unknown as BucketLike;
    } catch {
      bucket = null; // image files fall back to Firestore documents
    }
  }
  return new AdminStore(fs as unknown as AdminFirestoreLike, bucket, (n) => FieldValue.increment(n));
}
