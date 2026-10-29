import { resolve, join } from 'node:path';
const root = resolve(import.meta.dir, '../dist');
const port = Number(process.env.PORT || 8194);
const server = Bun.serve({ hostname: '127.0.0.1', port, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === '/favicon.ico') return new Response(null, { status: 204 });
  if (path !== '/' && path !== '/index.html') return new Response('Not found', { status: 404 });
  const file = Bun.file(join(root, 'index.html'));
  if (!await file.exists()) return new Response('Run bun run build first.', { status: 503 });
  return new Response(file, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
} });
console.log(`studio: http://${server.hostname}:${server.port}`);
