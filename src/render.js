import { activeLine, formatTime, isSection } from './core.js';

// A 256-sample FFT mirrors the original performance view's analyser resolution.
// Offline frames use decoded samples rather than recording a playing browser tab.
export function spectrumAt(buffer, time, previous = new Float32Array(128)) {
  const n = 256, re = new Float64Array(n), im = new Float64Array(n);
  const center = Math.floor(time * buffer.sampleRate);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < n; i++) {
    const frame = center + i - n / 2;
    const sample = channels.reduce((sum, channel) => sum + (channel[frame] || 0), 0) / channels.length;
    re[i] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let size = 2; size <= n; size <<= 1) {
    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < size / 2; j++) {
        const angle = -2 * Math.PI * j / size, cosine = Math.cos(angle), sine = Math.sin(angle);
        const even = start + j, odd = even + size / 2;
        const r = re[odd] * cosine - im[odd] * sine, imaginary = re[odd] * sine + im[odd] * cosine;
        re[odd] = re[even] - r; im[odd] = im[even] - imaginary;
        re[even] += r; im[even] += imaginary;
      }
    }
  }
  for (let i = 0; i < n / 2; i++) {
    const magnitude = Math.hypot(re[i], im[i]) / (n / 4);
    const level = Math.max(0, Math.min(1, (20 * Math.log10(Math.max(magnitude, 1e-6)) + 80) / 80));
    previous[i] = previous[i] * 0.82 + level * 0.18;
  }
  return previous;
}

export function drawBars(ctx, bins, width, height, color = '#e9eeeb') {
  const count = 72, gap = width * 0.003, bar = Math.max(1, (width - (count - 1) * gap) / count);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const amplitude = bins[Math.floor(i / count * bins.length)] || 0;
    const level = Math.max(2, amplitude * height);
    ctx.fillRect(i * (bar + gap), height - level, bar, level);
  }
}

function wrap(ctx, text, width) {
  const rows = [], words = text.split(/\s+/);
  let row = '';
  for (const word of words) {
    if (row && ctx.measureText(row + ' ' + word).width > width) { rows.push(row); row = ''; }
    // Handle long unbroken text too; don't paint outside the lyric column.
    for (const char of (row ? ' ' : '') + word) {
      if (row && ctx.measureText(row + char).width > width) { rows.push(row); row = ''; }
      row += char;
    }
  }
  if (row) rows.push(row);
  return rows;
}

export function drawPerformance(canvas, project, time, duration, bins) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  const unit = Math.min(w / 1280, h / 720), pad = 52 * unit;
  ctx.fillStyle = '#050706'; ctx.fillRect(0, 0, w, h);
  const portrait = w < h, column = portrait ? pad : w * 0.42, top = portrait ? h * 0.24 : pad;
  const lyricWidth = w - column - pad;
  ctx.font = `${12 * unit}px monospace`; ctx.fillStyle = '#718079';
  ctx.fillText('STUDIO / PERFORMANCE', pad, pad);
  ctx.font = `600 ${26 * unit}px sans-serif`; ctx.fillStyle = '#e9eeeb';
  const titleRows = wrap(ctx, project.title || 'Untitled', portrait ? w - 2 * pad : column - 2 * pad);
  titleRows.slice(0, 3).forEach((row, i) => ctx.fillText(row, pad, pad + (48 + i * 34) * unit));
  ctx.font = `${13 * unit}px monospace`; ctx.fillStyle = project.accent;
  ctx.fillText(formatTime(time) + ' / ' + formatTime(duration), pad, pad + (70 + Math.min(3, titleRows.length) * 34) * unit);
  const selected = activeLine(project.lines, project.timestamps, time, duration);
  const rowHeight = 35 * unit, viewport = h - top - 160 * unit;
  const laidOut = project.lines.map((text, index) => {
    ctx.font = `${(isSection(text) ? 13 : 20) * unit}px sans-serif`;
    return { index, section: isSection(text), rows: wrap(ctx, text, lyricWidth) };
  });
  let selectedY = 0, total = 0;
  laidOut.forEach(item => { if (item.index === selected) selectedY = total; total += item.rows.length * rowHeight + 12 * unit; });
  let y = top - Math.max(0, Math.min(selectedY - viewport * 0.38, total - viewport));
  ctx.save(); ctx.beginPath(); ctx.rect(column, top - rowHeight, lyricWidth, viewport + rowHeight); ctx.clip();
  for (const item of laidOut) {
    ctx.fillStyle = item.section ? '#64756a' : item.index === selected ? project.accent : '#87928c';
    ctx.font = `${item.index === selected ? '600 ' : ''}${(item.section ? 13 : 20) * unit}px ${item.section ? 'monospace' : 'sans-serif'}`;
    for (const row of item.rows) { ctx.fillText(row, column, y + rowHeight); y += rowHeight; }
    y += 12 * unit;
  }
  ctx.restore();
  ctx.save(); ctx.translate(pad, h - 115 * unit);
  drawBars(ctx, bins, w - pad * 2, 75 * unit); ctx.restore();
}
