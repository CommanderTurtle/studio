import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildAudioPlayerHtml, audioBufferToWav } from '../src/vendor/yue-player.js';
import upstream from '../src/vendor/upstream.json';

test('all vendored Yue functions retain pinned upstream source hashes', () => {
  const source = readFileSync(new URL('../src/vendor/yue-player.js', import.meta.url), 'utf8');
  for (const item of upstream.functions) {
    const from = source.indexOf(`function ${item.name}(`);
    const next = source.indexOf('\nfunction ', from + 1), end = next === -1 ? source.indexOf('\nexport ', from) : next;
    const original = source.slice(from, end).trimEnd();
    expect(createHash('sha256').update(original).digest('hex')).toBe(item.sha256);
  }
});
test('original player embeds local media and escapes lyric markup', () => {
  const html = buildAudioPlayerHtml({ title: '<Title>', source: 'data:audio/wav;base64,AAAA', accent: '#90efb8', lyrics: ['[Verse]', '</script><img src=x onerror=alert(1)>'], timestamps: [{ line: 1, start: 0 }] });
  expect(html).toContain('data-section="1"');
  expect(html).toContain('&lt;/script&gt;&lt;img');
  expect(html).toContain('SELF-CONTAINED PLAYER &middot; MM-TOOLS');
  expect(html).toContain('src="data:audio/wav;base64,AAAA"');
  expect(html.match(/<script>/g)?.length).toBe(1);
  expect(html.match(/<\/script>/g)?.length).toBe(1);
});
test('original WAV encoder emits PCM with actual duration/channels', () => {
  const data = audioBufferToWav({ numberOfChannels: 1, length: 480, sampleRate: 48000, getChannelData: () => new Float32Array(480) });
  expect(new TextDecoder().decode(data.slice(0, 4))).toBe('RIFF');
  expect(new DataView(data.buffer).getUint32(40, true)).toBe(960);
  expect(data.byteLength).toBe(1004);
});
