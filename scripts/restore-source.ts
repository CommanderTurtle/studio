// Reconstruct the source bundle downloaded from the standalone page.
// Refuse existing destinations and traversal rather than overwrite user files.
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
const [bundlePath, destination] = process.argv.slice(2);
if (!bundlePath || !destination) throw Error('Usage: bun scripts/restore-source.ts studio-source.json NEW_DIRECTORY');
const root = resolve(destination);
try { await access(root); throw Error('Destination already exists. Choose a new directory.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
if (bundle.format !== 'studio-source' || bundle.version !== 1 || !bundle.files) throw Error('Invalid source bundle.');
for (const [path, contents] of Object.entries(bundle.files)) {
  const target = resolve(root, path), inside = relative(root, target);
  if (!inside || inside.startsWith('..') || isAbsolute(inside) || typeof contents !== 'string') throw Error('Invalid source path.');
}
await mkdir(root);
for (const [path, contents] of Object.entries(bundle.files)) {
  const target = join(root, path); await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, contents as string);
}
console.log('Source restored to ' + root);
