import { parseLyrics, lyricIndices, isSection, activeLine, formatTime, validAccent, safeFilename, validateTimestamps, remapTimestamps, readProject, toLrc } from './core.js';
import { buildAudioPlayerHtml } from './vendor/yue-player.js';
import { drawBars } from './render.js';
import { exportMp4 } from './video.js';

const $ = id => document.getElementById(id);
const state = { file: null, buffer: null, url: null, data: null, lines: [], timestamps: [],
  draft: null, target: -1, history: [], busy: false, abort: null };
const player = $('player');
let context, analyser, animation, selected = -2;
function status(message, error = false) {
  $('status-text').textContent = message;
  $('status-text').parentElement.classList.toggle('error', error);
}
function fail(error) { console.error(error); status(error.message || String(error), true); }
function audioContext() {
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) throw Error('This browser does not support Web Audio.');
  return context ||= new AudioContextType();
}
function projectSnapshot() {
  return { title: $('track-title').value || 'Untitled', accent: validAccent($('accent').value),
    lines: [...state.lines], timestamps: validateTimestamps(state.timestamps, state.lines, state.buffer.duration) };
}
function updateControls() {
  const ready = Boolean(state.buffer) && !state.busy, manual = Boolean(state.draft);
  for (const id of ['save-project', 'html-export', 'video-open']) $(id).disabled = !ready || manual;
  $('sync-start').disabled = !ready || !lyricIndices(state.lines).length;
  $('sync-start').hidden = manual; $('sync-controls').hidden = !manual;
  $('stamp').disabled = !ready || state.target < 0;
  $('undo').disabled = state.busy || !state.history.length;
  $('sync-save').disabled = state.busy;
  for (const id of ['timing-export', 'lrc-export', 'clear-timings']) $(id).disabled = state.busy || manual || !state.timestamps.length;
  for (const id of ['lyrics', 'track-title', 'accent', 'media-file', 'open-project', 'lyrics-open', 'timing-import']) $(id).disabled = state.busy || (manual && id !== 'track-title' && id !== 'accent');
  $('mode-label').textContent = manual ? 'MANUAL SYNC / REC' : 'PREVIEW';
  $('line-count').textContent = `${lyricIndices(state.lines).length} lines`;
  $('stamp-count').textContent = `${state.timestamps.length} timed`;
  $('preview-timing').textContent = manual ? 'Manual / recording' : state.timestamps.length ? `Manual / ${state.timestamps.length} lines` : 'Manual / not started';
  $('sync-instruction').textContent = manual
    ? state.target < 0 ? 'All lines marked. Save timing to commit.' : `Next: ${state.lines[state.target]}`
    : 'Mark the moment each lyric begins.';
  for (const control of $('timeline').querySelectorAll('input,button')) control.disabled = state.busy || manual;
}
function setBusy(busy) { state.busy = busy; updateControls(); }

function rebuildLyrics() {
  const panel = $('lyric-preview'); panel.replaceChildren();
  if (!state.lines.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    const icon = document.createElement('span'); icon.textContent = '∷';
    const text = document.createElement('p'); text.textContent = 'Your lyrics appear here.';
    const small = document.createElement('small'); small.textContent = 'Load audio, add words, then mark each line.';
    empty.append(icon, text, small); panel.append(empty);
  }
  state.lines.forEach((text, index) => {
    const row = document.createElement(isSection(text) ? 'div' : 'button');
    row.className = 'lyric-row' + (isSection(text) ? ' section' : ''); row.dataset.line = String(index);
    const number = document.createElement('small'); number.textContent = isSection(text) ? '—' : String(index + 1).padStart(2, '0');
    const content = document.createElement('span'); content.textContent = text; row.append(number, content);
    if (!isSection(text)) row.addEventListener('click', () => {
      if (state.busy) return;
      if (state.draft) { state.target = index; updateControls(); syncLyrics(); }
      else {
        const stamp = state.timestamps.find(item => item.line === index);
        if (stamp && state.buffer) player.currentTime = stamp.start;
      }
    });
    panel.append(row);
  });
  selected = -2; syncLyrics(); updateControls(); rebuildTimeline();
}

function syncLyrics() {
  const stamps = state.draft ? [...state.draft].map(([line, start]) => ({ line, start })).sort((a, b) => a.line - b.line) : state.timestamps;
  const current = state.draft ? state.target : activeLine(state.lines, stamps, player.currentTime, state.buffer?.duration || 0);
  for (const row of $('lyric-preview').querySelectorAll('[data-line]')) {
    const line = Number(row.dataset.line);
    row.classList.toggle('active', !state.draft && line === current);
    row.classList.toggle('pending', Boolean(state.draft) && line === current);
    row.classList.toggle('recorded', Boolean(state.draft?.has(line)));
    if (line === current && current !== selected) {
      const panel = $('lyric-preview');
      panel.scrollTo({ top: Math.max(0, row.offsetTop - panel.clientHeight * 0.4), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
  selected = current;
  $('performance-clock').textContent = `${formatTime(player.currentTime)} / ${formatTime(state.buffer?.duration)}`;
}

function rebuildTimeline() {
  const panel = $('timeline'); panel.replaceChildren();
  if (!state.timestamps.length) {
    const text = document.createElement('p'); text.className = 'muted'; text.textContent = 'Mark lyrics to build a timeline.'; panel.append(text);
  }
  for (const stamp of state.timestamps) {
    const row = document.createElement('div'); row.className = 'timeline-row';
    const text = document.createElement('span'); text.textContent = state.lines[stamp.line]; text.title = text.textContent;
    const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = String(state.buffer?.duration || 0); input.step = '.001';
    input.value = String(stamp.start); input.disabled = Boolean(state.draft) || state.busy; input.setAttribute('aria-label', `Start seconds: ${text.textContent}`);
    input.addEventListener('change', () => {
      try {
        state.timestamps = validateTimestamps(state.timestamps.map(item => item.line === stamp.line ? { line: item.line, start: Number(input.value) } : item), state.lines, state.buffer.duration);
        status('Timestamp updated.'); syncLyrics();
      } catch (error) { input.value = String(state.timestamps.find(item => item.line === stamp.line).start); fail(error); }
    });
    const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', `Remove timestamp: ${text.textContent}`);
    remove.disabled = Boolean(state.draft) || state.busy;
    remove.addEventListener('click', () => { state.timestamps = state.timestamps.filter(item => item.line !== stamp.line); rebuildTimeline(); updateControls(); syncLyrics(); });
    row.append(text, input, remove); panel.append(row);
  }
}

function paint() {
  const canvas = $('spectrum'), ratio = Math.min(devicePixelRatio || 1, 2);
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
  const bins = new Uint8Array(128); if (analyser) analyser.getByteFrequencyData(bins);
  const levels = Float32Array.from(bins, sample => sample / 255);
  drawBars(ctx, levels, width, height); syncLyrics();
  if (!player.paused && !player.ended) animation = requestAnimationFrame(paint);
}
player.addEventListener('play', async () => {
  try {
    const ctx = audioContext();
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .82; ctx.createMediaElementSource(player).connect(analyser); analyser.connect(ctx.destination); }
    await ctx.resume(); cancelAnimationFrame(animation); paint();
  } catch (error) { fail(error); }
});
for (const event of ['pause', 'ended', 'seeked', 'loadedmetadata']) player.addEventListener(event, () => { cancelAnimationFrame(animation); paint(); });
player.addEventListener('timeupdate', syncLyrics);
player.addEventListener('error', () => { if (state.file) status('This browser cannot play the selected media format. Try a WAV, MP3, FLAC or supported M4A file.', true); });
new ResizeObserver(() => { if (player.paused) paint(); }).observe($('spectrum'));

async function decodeFile(file) {
  if (!file.size) throw Error('The media file is empty.');
  try { return await audioContext().decodeAudioData(await file.arrayBuffer()); }
  catch { throw Error('This browser cannot decode this media file. Try a WAV, MP3, FLAC or supported M4A file. No file was uploaded.'); }
}
function adoptMedia(file, buffer, { title, data = null } = {}) {
  player.pause(); if (state.url) URL.revokeObjectURL(state.url);
  state.file = file; state.buffer = buffer; state.data = data; state.url = URL.createObjectURL(file);
  state.timestamps = []; state.draft = null; state.target = -1; state.history = [];
  player.src = state.url;
  $('track-title').value = title ?? file.name.replace(/\.[^.]+$/, '');
  $('media-name').textContent = file.name; $('media-size').textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
  $('preview-source').textContent = file.name;
  $('session-info').textContent = `${formatTime(buffer.duration)} / ${Math.round(buffer.sampleRate / 100) / 10} kHz / ${buffer.numberOfChannels} ch`;
  updateTitle();
}
async function loadMedia(file) {
  if (!file || state.busy || state.draft) return;
  setBusy(true); status('Reading local media…');
  try {
    const buffer = await decodeFile(file); adoptMedia(file, buffer); rebuildLyrics();
    status('Media loaded. Add lyrics, then start timing.');
  } catch (error) { fail(error); }
  finally { setBusy(false); $('media-file').value = ''; }
}
$('media-file').addEventListener('change', event => loadMedia(event.target.files[0]));
const drop = $('media-drop');
for (const event of ['dragenter', 'dragover']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) drop.addEventListener(event, e => { e.preventDefault(); drop.classList.remove('dragging'); if (event === 'drop') loadMedia(e.dataTransfer.files[0]); });
function updateTitle() {
  $('preview-title').textContent = $('track-title').value || 'Untitled';
  document.documentElement.style.setProperty('--accent', validAccent($('accent').value));
}
$('track-title').addEventListener('input', updateTitle); $('accent').addEventListener('input', updateTitle);
function updateLyrics() {
  const lines = parseLyrics($('lyrics').value); state.timestamps = remapTimestamps(state.lines, lines, state.timestamps); state.lines = lines; rebuildLyrics();
}
$('lyrics').addEventListener('input', updateLyrics);
$('lyrics-open').addEventListener('click', () => $('lyrics-file').click());
$('lyrics-file').addEventListener('change', async event => {
  try {
    const file = event.target.files[0]; if (!file || state.busy || state.draft) return;
    if (file.size > 2_000_000) throw Error('Lyrics must be smaller than 2 MB.');
    const text = await file.text();
    // LRC import is optional; ordinary Markdown is kept as plain text.
    if (/\.lrc$/i.test(file.name)) {
      const rows = text.split(/\r?\n/), lines = [], timestamps = [];
      for (const row of rows) {
        const match = row.match(/^\[(\d+):(\d{2}(?:\.\d+)?)\]\s*(.+)$/);
        if (match) { timestamps.push({ line: lines.length, start: Number(match[1]) * 60 + Number(match[2]) }); lines.push(match[3].trim()); }
      }
      if (!lines.length) throw Error('No timed lyrics found in the LRC file.');
      const checked = validateTimestamps(timestamps, lines, state.buffer?.duration || Infinity);
      $('lyrics').value = lines.join('\n'); state.lines = lines; state.timestamps = checked; rebuildLyrics();
    } else { $('lyrics').value = text; updateLyrics(); }
    status('Lyrics imported.');
  } catch (error) { fail(error); } finally { event.target.value = ''; }
});

$('sync-start').addEventListener('click', () => {
  if (!state.buffer || state.busy) return;
  state.draft = new Map(state.timestamps.map(item => [item.line, item.start])); state.history = [];
  state.target = lyricIndices(state.lines).find(line => !state.draft.has(line)) ?? lyricIndices(state.lines)[0] ?? -1;
  updateControls(); rebuildTimeline(); syncLyrics(); status('Timing started. Play the audio and mark each line with Enter.');
});
function stampLine() {
  if (!state.draft || state.target < 0 || state.busy) return;
  const line = state.target, start = Math.round(player.currentTime * 1000) / 1000;
  state.history.push({ line, previous: state.draft.get(line) }); state.draft.set(line, start);
  state.target = lyricIndices(state.lines).find(index => index > line && !state.draft.has(index)) ?? -1;
  updateControls(); syncLyrics();
}
$('stamp').addEventListener('click', stampLine);
$('undo').addEventListener('click', () => {
  const previous = state.history.pop(); if (!previous) return;
  if (previous.previous === undefined) state.draft.delete(previous.line); else state.draft.set(previous.line, previous.previous);
  state.target = previous.line; updateControls(); syncLyrics();
});
$('sync-save').addEventListener('click', () => {
  try {
    state.timestamps = validateTimestamps([...state.draft].map(([line, start]) => ({ line, start })), state.lines, state.buffer.duration);
    state.draft = null; state.history = []; updateControls(); rebuildTimeline(); syncLyrics(); status('Timing saved. Export a player, video or project.');
  } catch (error) { fail(error); }
});
$('sync-cancel').addEventListener('click', () => { state.draft = null; state.history = []; updateControls(); rebuildTimeline(); syncLyrics(); status('Draft timing discarded. Previous timestamps kept.'); });
$('clear-timings').addEventListener('click', () => { if (confirm('Clear all saved timestamps?')) { state.timestamps = []; rebuildTimeline(); updateControls(); syncLyrics(); status('Timestamps cleared.'); } });
document.addEventListener('keydown', event => {
  // Native media controls already handle Space. Don't toggle playback twice.
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || state.busy || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,button,a,audio,video,[contenteditable]')) return;
  if (event.code === 'Space' && state.buffer) { event.preventDefault(); if (player.paused) player.play().catch(fail); else player.pause(); }
  if (event.key === 'Enter' && state.draft) { event.preventDefault(); stampLine(); }
  if (['ArrowLeft', 'ArrowRight'].includes(event.key) && state.buffer) { event.preventDefault(); player.currentTime = Math.max(0, Math.min(state.buffer.duration, player.currentTime + (event.key === 'ArrowLeft' ? -5 : 5))); }
});
$('fullscreen').addEventListener('click', () => { (document.fullscreenElement ? document.exitFullscreen() : $('performance').requestFullscreen()).catch(fail); });

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
async function mediaData() {
  if (state.data) return state.data;
  const file = state.file;
  const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  if (state.file === file) state.data = data;
  return data;
}
async function withBusy(callback) {
  if (!state.buffer || state.busy || state.draft) return;
  setBusy(true); rebuildTimeline();
  try { await callback(); } catch (error) { fail(error); }
  finally { setBusy(false); rebuildTimeline(); }
}
$('html-export').addEventListener('click', () => withBusy(async () => {
  status('Embedding audio in the original Yue HTML player…');
  const project = projectSnapshot(), source = await mediaData();
  const html = buildAudioPlayerHtml({ ...project, source, lyrics: project.lines });
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), safeFilename(project.title) + '.html');
  status('HTML player exported with embedded audio and saved timestamps.');
}));
$('save-project').addEventListener('click', () => withBusy(async () => {
  const project = projectSnapshot();
  const data = { format: 'studio', version: 1, title: project.title, accent: project.accent, lyrics: $('lyrics').value,
    lyric_timestamps: project.timestamps, media: { name: state.file.name, data: await mediaData() } };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), safeFilename(project.title) + '.studio.json'); status('Project saved, including audio.');
}));
$('open-project').addEventListener('click', () => $('project-file').click());
$('project-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file || state.busy || state.draft) return;
  setBusy(true); status('Opening local project…');
  try {
    const project = readProject(JSON.parse(await file.text()));
    const comma = project.media.data.indexOf(','), raw = atob(project.media.data.slice(comma + 1));
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
    const media = new File([bytes], project.media.name, { type: project.media.data.slice(5, project.media.data.indexOf(';')) });
    const buffer = await decodeFile(media);
    const stamps = validateTimestamps(project.timestamps, project.lines, buffer.duration);
    adoptMedia(media, buffer, { title: project.title, data: project.media.data });
    $('accent').value = project.accent; $('lyrics').value = project.lyrics; state.lines = project.lines; state.timestamps = stamps;
    updateTitle(); rebuildLyrics(); status('Project restored.');
  } catch (error) { fail(error); } finally { event.target.value = ''; setBusy(false); }
});
$('timing-export').addEventListener('click', () => { download(new Blob([JSON.stringify({ lyric_timestamps: state.timestamps }, null, 2)], { type: 'application/json' }), safeFilename($('track-title').value) + '.timing.json'); });
$('lrc-export').addEventListener('click', () => { download(new Blob([toLrc(state.lines, state.timestamps)], { type: 'text/plain' }), safeFilename($('track-title').value) + '.lrc'); });
$('timing-import').addEventListener('click', () => $('timing-file').click());
$('timing-file').addEventListener('change', async event => {
  try {
    const file = event.target.files[0]; if (!file || state.busy || state.draft) return;
    const raw = JSON.parse(await file.text()); state.timestamps = validateTimestamps(Array.isArray(raw) ? raw : raw.lyric_timestamps, state.lines, state.buffer?.duration || Infinity);
    updateControls(); rebuildTimeline(); syncLyrics(); status('Timestamps imported.');
  } catch (error) { fail(error); } finally { event.target.value = ''; }
});

$('video-open').addEventListener('click', () => { $('video-status').textContent = ''; $('video-progress').hidden = true; $('video-dialog').showModal(); });
$('video-export').addEventListener('click', async () => {
  if (state.busy) return;
  state.abort = new AbortController(); const controller = state.abort;
  setBusy(true); player.pause(); $('video-export').disabled = true; $('video-resolution').disabled = true;
  $('video-close').disabled = true; $('video-cancel').hidden = false; $('video-progress').hidden = false; $('video-progress').value = 0;
  try {
    const [width, height] = $('video-resolution').value.split(',').map(Number);
    $('video-status').textContent = 'Preparing encoders…';
    const blob = await exportMp4(state.buffer, projectSnapshot(), { width, height, signal: controller.signal, onProgress: fraction => {
      $('video-progress').value = fraction; $('video-status').textContent = `Encoding ${Math.round(fraction * 100)}%`;
    } });
    download(blob, safeFilename($('track-title').value) + '.mp4');
    $('video-status').textContent = 'MP4 exported.'; status('MP4 exported with audio and lyric timing.');
  } catch (error) {
    $('video-status').textContent = error.name === 'AbortError' ? 'Export cancelled.' : error.message;
    if (error.name !== 'AbortError') fail(error);
  } finally {
    state.abort = null; setBusy(false); $('video-export').disabled = false; $('video-resolution').disabled = false;
    $('video-close').disabled = false; $('video-cancel').hidden = true;
  }
});
$('video-cancel').addEventListener('click', () => state.abort?.abort());
$('video-dialog').addEventListener('cancel', event => { if (state.abort) { event.preventDefault(); state.abort.abort(); } });
$('about-open').addEventListener('click', () => $('about-dialog').showModal());
$('source-download').addEventListener('click', () => {
  const bundle = JSON.parse($('studio-source').textContent);
  download(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }), 'studio-source.json');
});
window.addEventListener('beforeunload', event => {
  if (state.file) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('pagehide', () => { state.abort?.abort(); if (state.url) URL.revokeObjectURL(state.url); });
updateControls(); updateTitle(); paint();
