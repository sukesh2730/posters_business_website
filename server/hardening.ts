// Small, dependency-free helpers used by server.ts. Kept separate so they can be unit
// tested without starting the server or connecting to Firestore.

import crypto from 'node:crypto';
import { isSafePhotoUrl } from '../src/shared/printPricing';

/**
 * Firestore rejects `undefined` anywhere in a document. Orders contain optional fields
 * (couponCode, addressLine2, caption...) that are undefined when unused, so every order
 * must pass through this before setDoc/updateDoc.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/** A catalog price must be a finite number above zero. Never invent a default price. */
export function normalizeCatalogPrice(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}

/** Keeps only durable photo links. Throws a customer-readable error if any are unusable. */
export function sanitizeClientPhotoUrls(input: unknown, max = 40): string[] {
  if (!Array.isArray(input)) return [];
  if (input.length > max) throw new Error(`Too many photos on one item (maximum ${max}).`);
  for (const url of input) {
    if (!isSafePhotoUrl(url)) {
      throw new Error('One of your photos has not finished uploading. Please wait for it to complete and try again.');
    }
  }
  return input as string[];
}

/** Same Idempotency-Key always maps to the same order id, so a retry overwrites, never duplicates. */
export function orderIdFromIdempotencyKey(key: string): string {
  return `mp_${crypto.createHash('sha256').update(key.trim()).digest('hex').slice(0, 24)}`;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/** Least-recently-used cache bounded by total bytes, so uploads cannot exhaust server memory. */
export class BoundedMediaCache<V extends { sizeBytes: number }> {
  private map = new Map<string, V>();
  private bytes = 0;
  constructor(private maxBytes: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v); // mark most recently used
    }
    return v;
  }
  has(key: string): boolean {
    return this.map.has(key);
  }
  set(key: string, value: V): this {
    if (value.sizeBytes > this.maxBytes) return this; // too large to cache; still served from storage
    const old = this.map.get(key);
    if (old) this.bytes -= old.sizeBytes;
    this.map.delete(key);
    this.map.set(key, value);
    this.bytes += value.sizeBytes;
    while (this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.bytes -= this.map.get(oldest)!.sizeBytes;
      this.map.delete(oldest);
    }
    return this;
  }
  delete(key: string): boolean {
    const old = this.map.get(key);
    if (old) this.bytes -= old.sizeBytes;
    return this.map.delete(key);
  }
  get size(): number {
    return this.map.size;
  }
  get totalBytes(): number {
    return this.bytes;
  }
}

/** Least-recently-used map bounded by entry count. */
export class BoundedMap<K, V> {
  private map = new Map<K, V>();
  constructor(private maxEntries: number) {}
  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  has(key: K): boolean {
    return this.map.has(key);
  }
  set(key: K, value: V): this {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value as K);
    }
    return this;
  }
  delete(key: K): boolean {
    return this.map.delete(key);
  }
  get size(): number {
    return this.map.size;
  }
}
