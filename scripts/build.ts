import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dir, '..');
const result = await Bun.build({ entrypoints: [join(root, 'src/app.js')], target: 'browser', format: 'iife', minify: true, sourcemap: 'none' });
if (!result.success) throw new AggregateError(result.logs, 'Build failed');
if (result.outputs.length !== 1) throw Error('Expected one self-contained JavaScript bundle.');
const js = await result.outputs[0].text();
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const files: Record<string, string> = {};
async function include(path: string) {
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const relative = path + '/' + entry.name;
    if (entry.isDirectory()) await include(relative); else files[relative] = await readFile(join(root, relative), 'utf8');
  }
}
await include('src'); await include('scripts'); await include('tests');
for (const file of ['package.json', 'bun.lock', '.gitignore', '.gitattributes']) files[file] = await readFile(join(root, file), 'utf8');
const license = await readFile(join(root, 'LICENSE'), 'utf8');
// Escaping script terminators is required even inside JavaScript string literals.
const inserts: Record<string, string> = {
  '/* STUDIO_CSS */': await readFile(join(root, 'src/style.css'), 'utf8'),
  STUDIO_SOURCE: JSON.stringify({ format: 'studio-source', version: 1, files }).replaceAll('<', '\\u003c'),
  '/* STUDIO_JS */': js.replace(/<\/script/gi, '<\\/script'),
};
// One pass: do not accidentally replace a placeholder inside embedded source.
const html = (await readFile(join(root, 'src/index.html'), 'utf8'))
  .replace(/\/\* STUDIO_CSS \*\/|STUDIO_SOURCE|\/\* STUDIO_JS \*\//g, marker => inserts[marker]!);
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/index.html'), html);
console.log(`Built dist/index.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB); JS, AAC WASM, license and source embedded.`);
