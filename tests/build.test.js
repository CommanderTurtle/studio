import { test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
const url = new URL('../dist/index.html', import.meta.url);
test.skipIf(!existsSync(url))('portable build has no external runtime assets and contains reconstructable source', () => {
  const html = readFileSync(url, 'utf8');
  expect(html).not.toMatch(/<script[^>]+src\s*=/i);
  expect(html).not.toMatch(/<link[^>]+(?:href|rel)\s*=/i);
  expect(html.includes('<script>/* STUDIO_JS */</script>')).toBe(false);
  expect(html.includes('data:application/wasm;base64,')).toBe(true);
  const source = JSON.parse(html.match(/<script id="studio-source" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  expect(source.files['src/app.js']).toContain('buildAudioPlayerHtml');
  expect(source.files['bun.lock']).toBeTruthy();
  expect(source.files['scripts/build.ts']).toBeTruthy();
});
