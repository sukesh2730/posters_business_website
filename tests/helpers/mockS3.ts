// A tiny stand-in for an S3-compatible service (Cloudflare R2, Backblaze B2...) for tests. No signatures are checked.
import http from 'node:http';

export interface MockS3 {
  url: string;
  objects: Map<string, Buffer>;
  close: () => void;
}

export function startMockS3(bucket: string): Promise<MockS3> {
  const objects = new Map<string, Buffer>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    const b = parts[0];
    const key = parts.slice(1).join('/');
    const xml = (status: number, code: string) => {
      res.writeHead(status, { 'Content-Type': 'application/xml' });
      res.end(`<?xml version="1.0"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`);
    };
    if (b !== bucket) return xml(404, 'NoSuchBucket');
    if (req.method === 'HEAD' && !key) { res.writeHead(200); return res.end(); }
    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => { objects.set(key, Buffer.concat(chunks)); res.writeHead(200, { ETag: '"mock"' }); res.end(); });
      return;
    }
    if (req.method === 'GET') {
      const o = objects.get(key);
      if (!o) return xml(404, 'NoSuchKey');
      res.writeHead(200, { 'Content-Length': o.length, 'Content-Type': 'application/octet-stream' });
      return res.end(o);
    }
    res.writeHead(405);
    res.end();
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ url: `http://127.0.0.1:${(server.address() as any).port}`, objects, close: () => server.close() })
    )
  );
}
