import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeAudio, canEncodeVideo, Quality } from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';
import { drawPerformance, spectrumAt } from './render.js';

let fallbackRegistered = false;
export async function exportMp4(buffer, project, { width = 1280, height = 720, signal, onProgress = () => {} } = {}) {
  if (!globalThis.VideoEncoder || !globalThis.isSecureContext) {
    throw Error('MP4 export needs WebCodecs in a secure browser context. Use localhost or HTTPS in a current Chromium browser. HTML export works independently.');
  }
  const frameRate = 30, quality = new Quality({ bitrate: width * height > 1_000_000 ? 5_000_000 : 2_500_000 });
  if (!(await canEncodeVideo('avc', { width, height, frameRate, quality }))) {
    throw Error('This browser has no H.264 encoder for the selected resolution. Try 720p in a current Chromium browser.');
  }
  if (!fallbackRegistered && !(await canEncodeAudio('aac', { numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate }))) {
    registerAacEncoder(); fallbackRegistered = true;
  }
  signal?.throwIfAborted();
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const video = new CanvasSource(canvas, { codec: 'avc', quality });
  const audio = new AudioBufferSource({ codec: 'aac', quality: new Quality({ bitrate: 192_000 }) });
  output.addVideoTrack(video, { frameRate }); output.addAudioTrack(audio);
  const abort = () => { output.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    await output.start();
    const bins = new Float32Array(128), frames = Math.ceil(buffer.duration * frameRate);
    await Promise.all([
      (async () => { await audio.add(buffer); audio.close(); })(),
      (async () => {
        for (let frame = 0; frame < frames; frame++) {
          signal?.throwIfAborted();
          const time = frame / frameRate;
          drawPerformance(canvas, project, time, buffer.duration, spectrumAt(buffer, time, bins));
          await video.add(time, Math.min(1 / frameRate, buffer.duration - time));
          if (frame % 6 === 0) { onProgress(frame / frames); await new Promise(resolve => setTimeout(resolve, 0)); }
        }
        video.close();
      })(),
    ]);
    signal?.throwIfAborted();
    await output.finalize(); onProgress(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  } catch (error) {
    await output.cancel().catch(() => {});
    if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError');
    throw error;
  } finally { signal?.removeEventListener('abort', abort); }
}
