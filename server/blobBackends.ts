// Optional free image storage that does not depend on Firebase's paid Cloud Storage.
// Works with Cloudflare R2 (10 GB free, free downloads) and any other S3-compatible bucket.
// Photos are always served through the server (which checks who may see them), so the bucket stays private.

import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import type { DataStore, Doc, RateHit } from './store';

export interface BlobBackend {
  readonly name: string;
  put(path: string, data: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<Buffer | null>;
  /** Throws a readable error if the bucket cannot be reached with these credentials. */
  check(): Promise<void>;
}

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  name?: string;
}

const withTimeout = <T>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

export function createS3Backend(cfg: S3Config): BlobBackend {
  const client = new S3Client({
    region: cfg.region || 'auto',
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    // R2 and several other S3-compatible services reject the newer automatic checksum headers.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2,
  });
  return {
    name: cfg.name || 's3',
    async put(path, data, contentType) {
      await withTimeout(
        client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: path, Body: data, ContentType: contentType, ContentLength: data.length })),
        30000,
        'Image storage timed out while saving.'
      );
    },
    async get(path) {
      try {
        const out = await withTimeout(client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: path })), 30000, 'Image storage timed out while reading.');
        if (!out.Body) return null;
        return Buffer.from(await (out.Body as any).transformToByteArray());
      } catch (e: any) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null;
        throw e;
      }
    },
    async check() {
      try {
        await withTimeout(client.send(new HeadBucketCommand({ Bucket: cfg.bucket })), 8000, 'Image storage did not answer within 8 seconds.');
      } catch (e: any) {
        const code = e?.$metadata?.httpStatusCode;
        const why = code === 403 ? 'access denied (check the access key and its permission on this bucket)'
          : code === 404 || e?.name === 'NotFound' ? `bucket "${cfg.bucket}" was not found`
          : String(e?.message || e).slice(0, 120);
        throw new Error(why);
      }
    },
  };
}

/** Same data store, but image files go to the given backend. Everything else is untouched. */
export class BlobOverlayStore implements DataStore {
  constructor(private base: DataStore, private blobs: BlobBackend) {}
  get mode() { return this.base.mode; }
  get supportsSharedState() { return this.base.supportsSharedState; }
  readonly supportsBlobs = true;
  get blobProvider() { return this.blobs.name; }
  getDoc(c: string, id: string) { return this.base.getDoc(c, id); }
  setDoc(c: string, id: string, d: Doc) { return this.base.setDoc(c, id, d); }
  createDoc(c: string, id: string, d: Doc) { return this.base.createDoc(c, id, d); }
  updateDoc(c: string, id: string, d: Doc) { return this.base.updateDoc(c, id, d); }
  listDocs(c: string) { return this.base.listDocs(c); }
  findOrdersByContact(contact: { email?: string; phone?: string }, limit: number) { return this.base.findOrdersByContact(contact, limit); }
  hit(key: string, windowMs: number, limit: number): Promise<RateHit> { return this.base.hit(key, windowMs, limit); }
  putBlob(path: string, data: Buffer, contentType: string) { return this.blobs.put(path, data, contentType); }
  getBlob(path: string) { return this.blobs.get(path); }
}

/** Reads R2 settings from the environment. Returns null when R2 is not configured. */
export function s3ConfigFromEnv(env: NodeJS.ProcessEnv): S3Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT } = env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  const endpoint = R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  if (!endpoint) return null;
  return { endpoint, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, name: 'r2' };
}
