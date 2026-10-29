// Small generated media for browser QA; never included in dist.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { audioBufferToWav } from '../src/vendor/yue-player.js';
const path = resolve(import.meta.dir, '../.work/fixtures');
await mkdir(path, { recursive: true });
const rate = 48000, length = rate * 6;
const signal = Float32Array.from({ length }, (_, i) => .17 * Math.sin(2 * Math.PI * (i < rate * 3 ? 220 : 440) * i / rate) * Math.min(1, i / 1000, (length - i) / 1000));
await writeFile(join(path, 'studio-check.wav'), audioBufferToWav({ numberOfChannels: 1, length, sampleRate: rate, getChannelData: () => signal }));
await writeFile(join(path, 'lyrics.md'), '[Verse 1]\n\nSignal in the quiet\n\n\nA line across the screen\n[Chorus]\nEverything in time\n');
await writeFile(join(path, 'timing.json'), JSON.stringify({ lyric_timestamps: [{ line: 1, start: .5 }, { line: 2, start: 2 }, { line: 4, start: 4 }] }));
if (process.argv[2]) {
  for (const [ext, codec] of [['flac', 'flac'], ['mp3', 'libmp3lame'], ['m4a', 'aac']]) {
    const processResult = Bun.spawnSync([process.argv[2], '-hide_banner', '-loglevel', 'error', '-y', '-i', join(path, 'studio-check.wav'), '-c:a', codec, join(path, 'studio-check.' + ext)]);
    if (processResult.exitCode) throw Error(processResult.stderr.toString());
  }
}
console.log(path);
