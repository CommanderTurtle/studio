import { test, expect } from 'bun:test';
import { parseLyrics, lyricIndices, activeLine, validateTimestamps, remapTimestamps, readProject, validAccent, toLrc } from '../src/core.js';
import { spectrumAt } from '../src/render.js';

test('plain Markdown ignores extra blank lines and retains section indices', () => {
  const lines = parseLyrics('\r\n[Verse 1]\r\n\r\n  First line  \r\n\r\n\r\nSecond line\n');
  expect(lines).toEqual(['[Verse 1]', 'First line', 'Second line']);
  expect(lyricIndices(lines)).toEqual([1, 2]);
});
test('timeline selection matches Yue lookahead and untimed fallback', () => {
  const lines = ['[Verse]', 'One', 'Two'];
  expect(activeLine(lines, [{ line: 1, start: 1 }, { line: 2, start: 3 }], .8, 4)).toBe(-1);
  expect(activeLine(lines, [{ line: 1, start: 1 }, { line: 2, start: 3 }], 2.86, 4)).toBe(2);
  expect(activeLine(lines, [], 0, 4)).toBe(1);
  expect(activeLine(lines, [], 4, 4)).toBe(2);
  expect(activeLine([], [], 0, 4)).toBe(-1);
});
test('timestamps are clean numeric row/start records', () => {
  expect(validateTimestamps([{ line: 1, start: 1.12349, extra: '</script>' }], ['[Verse]', 'One'], 3))
    .toEqual([{ line: 1, start: 1.123 }]);
  for (const raw of [[{ line: 0, start: 0 }], [{ line: 1, start: -1 }], [{ line: 1, start: NaN }], [{ line: 1, start: '1' }], [{ line: 1, start: 9 }], [{ line: 1.5, start: 0 }]]) {
    expect(() => validateTimestamps(raw, ['[Verse]', 'One'], 3)).toThrow();
  }
  expect(() => validateTimestamps([{ line: 0, start: 2 }, { line: 1, start: 1 }], ['One', 'Two'])).toThrow('order');
  expect(() => validateTimestamps([{ line: 0, start: 1 }, { line: 0, start: 2 }], ['One'])).toThrow('one timestamp');
});
test('text edits remap unchanged repeated lyrics without shifting deleted ones', () => {
  expect(remapTimestamps(['One', 'Repeat', 'Repeat', 'End'], ['[Verse]', 'One', 'New', 'Repeat', 'Repeat'], [{ line: 0, start: 0 }, { line: 2, start: 2 }, { line: 3, start: 3 }]))
    .toEqual([{ line: 1, start: 0 }, { line: 4, start: 2 }]);
  expect(remapTimestamps(['One', 'Two'], ['Two', 'One'], [{ line: 0, start: 0 }, { line: 1, start: 2 }])).toEqual([{ line: 0, start: 2 }]);
});
test('projects accept embedded audio only and sanitize accent/timestamps', () => {
  const project = { format: 'studio', version: 1, title: 'Title', lyrics: 'One', accent: 'red;bad', media: { data: 'data:audio/wav;base64,AAAA', name: 'song.wav' }, lyric_timestamps: [{ line: 0, start: 0 }] };
  expect(readProject(project).accent).toBe('#90efb8');
  expect(() => readProject({ ...project, media: { data: 'https://example.com/audio.mp3' } })).toThrow();
  expect(() => readProject({ ...project, media: { data: 'data:text/html;base64,AAAA' } })).toThrow();
  expect(validAccent('#ff00AA')).toBe('#ff00AA');
});
test('LRC export uses minutes and fractional seconds', () => {
  expect(toLrc(['One', 'Two'], [{ line: 0, start: 1.25 }, { line: 1, start: 62.5 }])).toBe('[00:01.25]One\n[01:02.50]Two\n');
  expect(toLrc(['One'], [{ line: 0, start: 59.999 }])).toBe('[01:00.00]One\n');
});
test('offline FFT detects a sine instead of inventing an idle spectrum', () => {
  const data = Float32Array.from({ length: 2048 }, (_, i) => .5 * Math.sin(2 * Math.PI * 8 * i / 256));
  const buffer = { sampleRate: 48000, numberOfChannels: 1, getChannelData: () => data };
  const bins = spectrumAt(buffer, .02);
  expect([...bins].indexOf(Math.max(...bins))).toBe(8);
  const silence = spectrumAt({ ...buffer, getChannelData: () => new Float32Array(2048) }, .02);
  expect(Math.max(...silence)).toBe(0);
});
