// Optional real-browser AAC/WASM integration harness. No production hooks.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
const result = await Bun.build({ entrypoints: [root + '/tests/encoder-harness.js'], target: 'browser', format: 'iife', minify: true });
if (!result.success) throw Error('Harness build failed');
const js = (await result.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; object-src 'none'; base-uri 'none'"><title>studio encoder check</title><body style="background:#111;color:#eee;font:16px monospace;padding:30px"><h1>Encoder integration check</h1><label>Audio fixture<input type="file" id="file"></label><button id="encode">Encode software AAC</button><button id="cancel">Cancel</button><p id="state">Choose a fixture</p><script>${js}</script>`;
await mkdir(root + '/.work', { recursive: true }); await writeFile(root + '/.work/encoder-check.html', html);
const server = Bun.serve({ hostname: '127.0.0.1', port: 8195, fetch: () => new Response(html, { headers: { 'Content-Type': 'text/html' } }) });
console.log('Encoder harness: http://' + server.hostname + ':' + server.port);
