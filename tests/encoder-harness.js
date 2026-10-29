// Browser integration check only; not an application entrypoint.
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import { exportMp4 } from '../src/video.js';
registerAacEncoder();
let buffer, abort;
const file = document.getElementById('file'), state = document.getElementById('state');
file.addEventListener('change', async () => {
  buffer = await new AudioContext().decodeAudioData(await file.files[0].arrayBuffer());
  state.textContent = 'Ready: ' + buffer.duration + ' seconds';
});
document.getElementById('encode').addEventListener('click', async () => {
  abort = new AbortController();
  try {
    const output = await exportMp4(buffer, { title: 'Software AAC check', accent: '#90efb8', lines: ['[Verse]', 'Software AAC + H.264'], timestamps: [{ line: 1, start: 0 }] }, {
      width: 640, height: 360, signal: abort.signal, onProgress: value => { state.textContent = 'Encoding: ' + Math.round(value * 100) + '%'; },
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(output); a.download = 'software-aac-check.mp4'; a.click();
    state.textContent = 'Complete: ' + output.size + ' bytes';
  } catch (error) { state.textContent = error.name + ': ' + error.message; }
});
document.getElementById('cancel').addEventListener('click', () => abort?.abort());
