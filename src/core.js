export const parseLyrics = text => String(text ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
export const isSection = line => /^\[.+\]$/.test(line);
export const lyricIndices = lines => lines.flatMap((line, index) => isSection(line) ? [] : [index]);
export const formatTime = seconds => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};
export const safeFilename = title => (title || 'studio').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 140) || 'studio';
export const validAccent = value => /^#[\da-f]{6}$/i.test(value) ? value : '#90efb8';

// Keep the Yue row-index contract, including section headings in the row count.
// Construct fresh numeric records: project data must never reach the HTML script verbatim.
export function validateTimestamps(raw, lines, duration = Infinity) {
  if (!Array.isArray(raw)) throw Error('Timestamps must be an array.');
  const seen = new Set();
  const stamps = raw.map(record => {
    const line = record?.line, start = record?.start;
    if (!Number.isInteger(line) || line < 0 || line >= lines.length || isSection(lines[line])) {
      throw Error('A timestamp refers to a missing lyric or section heading.');
    }
    if (typeof start !== 'number' || !Number.isFinite(start) || start < 0 || start > duration + 0.05) {
      throw Error('Timestamp seconds must be within the audio duration.');
    }
    if (seen.has(line)) throw Error('Each lyric can have only one timestamp.');
    seen.add(line);
    return { line, start: Math.round(start * 1000) / 1000 };
  }).sort((a, b) => a.line - b.line);
  for (let i = 1; i < stamps.length; i++) {
    if (stamps[i].start < stamps[i - 1].start) throw Error('Lyric timestamps must run in order.');
  }
  return stamps;
}

export function activeLine(lines, stamps, time, duration) {
  const candidates = lyricIndices(lines);
  if (!candidates.length || !(duration > 0)) return -1;
  if (!stamps.length) return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, time) / duration * candidates.length))];
  let selected = -1;
  for (const stamp of stamps) if (stamp.start <= time + 0.15) selected = stamp.line;
  return selected;
}

export function remapTimestamps(oldLines, newLines, stamps) {
  const occurrences = new Map();
  for (const stamp of stamps) {
    const text = oldLines[stamp.line];
    if (!occurrences.has(text)) occurrences.set(text, []);
  }
  const byLine = new Map(stamps.map(stamp => [stamp.line, stamp.start]));
  oldLines.forEach((text, line) => {
    if (occurrences.has(text)) occurrences.get(text).push(byLine.get(line));
  });
  const offsets = new Map();
  const next = [];
  newLines.forEach((text, line) => {
    const occurrence = offsets.get(text) || 0;
    offsets.set(text, occurrence + 1);
    const start = occurrences.get(text)?.[occurrence];
    if (start !== undefined && !isSection(text)) next.push({ line, start });
  });
  // Reordering lyrics must not silently apply an out-of-order timeline.
  return next.filter((stamp, index) => !next.slice(0, index).some(previous => previous.start > stamp.start));
}

export function readProject(raw) {
  if (raw?.format !== 'studio' || raw.version !== 1) throw Error('Not a studio project (version 1).');
  if (typeof raw.lyrics !== 'string' || typeof raw.title !== 'string') throw Error('Project text is missing.');
  if (raw.lyrics.length > 2_000_000 || raw.title.length > 2000) throw Error('Project text is too large.');
  if (typeof raw.media?.data !== 'string' || !/^data:(?:audio|video|application\/octet-stream)[^,]*;base64,[a-z\d+/=\r\n]+$/i.test(raw.media.data)) {
    throw Error('The project must contain embedded audio or video, not an external URL.');
  }
  const lines = parseLyrics(raw.lyrics);
  return { title: raw.title, accent: validAccent(raw.accent), lyrics: raw.lyrics, lines,
    timestamps: validateTimestamps(raw.lyric_timestamps, lines),
    media: { data: raw.media.data, name: String(raw.media.name || 'audio') } };
}

export function toLrc(lines, timestamps) {
  return timestamps.map(({ line, start }) => {
    const centiseconds = Math.round(start * 100);
    const minutes = Math.floor(centiseconds / 6000), seconds = ((centiseconds % 6000) / 100).toFixed(2).padStart(5, '0');
    return `[${String(minutes).padStart(2, '0')}:${seconds}]${lines[line]}`;
  }).join('\n') + '\n';
}
