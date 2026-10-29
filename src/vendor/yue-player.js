// Unmodified functions from CommanderTurtle/mm-tools @ 789efc7778e4c05a948bffb3c96ea91c03844c44
// music/yue2/local_app/web/app.js — AGPL-3.0-only.

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hexToRgb(value) {
  const hex = String(value || "#90efb8").replace("#", "");
  const full = hex.length === 3 ? [...hex].map((x) => x + x).join("") : hex;
  const parsed = Number.parseInt(full, 16);
  if (!Number.isFinite(parsed)) return "144, 239, 184";
  return `${(parsed >> 16) & 255}, ${(parsed >> 8) & 255}, ${parsed & 255}`;
}

function buildAudioPlayerHtml({ title, source, accent, lyrics, timestamps }) {
  const accentRgb = hexToRgb(accent);
  const rows = lyrics.map((line) => '<p' + (/^\[.+\]$/.test(line) ? ' class="section" data-section="1"' : "") + ">" + escapeHtml(line) + "</p>").join("\n    ");
  const css = [
    ":root{--accent:" + accent + ";--pulse:0}",
    "*{box-sizing:border-box}",
    "html,body{margin:0;min-height:100%}",
    "body{display:grid;place-items:center;padding:28px 20px;background:radial-gradient(120% 90% at 50% 0%,#101513 0%,#070908 60%);color:#e9eeeb;font:14px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif}",
    "main{position:relative;width:min(880px,100%);border:1px solid rgba(" + accentRgb + ",.16);border-radius:16px;background:linear-gradient(150deg,rgba(" + accentRgb + ",.07),transparent 52%),#0e1110;padding:26px 26px 16px;overflow:hidden}",
    "h1{margin:0;font-size:19px;font-weight:650;letter-spacing:-.01em}",
    ".source{margin:6px 0 0}",
    ".source a{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#98a29c;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;text-decoration:none;border-bottom:1px dotted rgba(152,162,156,.4)}",
    ".source a:hover{color:var(--accent)}",
    ".stage{position:relative;margin-top:20px}",
    ".orbit{position:absolute;top:-42%;left:12%;width:76%;aspect-ratio:1;border:1px solid rgba(" + accentRgb + ",.18);border-radius:50%;box-shadow:0 0 70px rgba(" + accentRgb + ",calc(.1 + var(--pulse) * .22)),inset 0 0 50px rgba(" + accentRgb + ",calc(.05 + var(--pulse) * .08));opacity:calc(.5 + var(--pulse) * .5);transform:scale(calc(1 + var(--pulse) * .05));pointer-events:none}",
    "canvas{display:block;width:100%;height:170px;opacity:.92}",
    ".lyrics{position:relative;max-height:190px;overflow:auto;margin-top:14px;padding:14px 4px 6px;-webkit-mask-image:linear-gradient(transparent,black 14%,black 86%,transparent);mask-image:linear-gradient(transparent,black 14%,black 86%,transparent);scrollbar-width:thin;scrollbar-color:rgba(" + accentRgb + ",.35) transparent;text-align:center}",
    ".lyrics p{margin:4px 0;color:#98a29c;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;transition:color .2s ease,transform .2s ease,font-size .2s ease}",
    ".lyrics p.section{margin-top:12px;color:rgba(" + accentRgb + ",.6);font-size:10px;letter-spacing:.14em;text-transform:uppercase}",
    ".lyrics p.active{color:#e9eeeb;font-size:14px;transform:translateX(10px)}",
    "audio{display:block;width:100%;margin-top:16px}",
    "footer{display:flex;justify-content:space-between;gap:12px;margin-top:10px;color:#98a29c;font:10px ui-monospace,monospace;letter-spacing:.1em}",
  ].join("\n");
  const script = [
    '"use strict";',
    "(() => {",
    "  var $ = function (id) { return document.getElementById(id); };",
    "  var audio = $(\"player\");",
    "  var canvas = $(\"spectrum\");",
    "  var clock = $(\"clock\");",
    "  var rows = Array.prototype.slice.call(document.querySelectorAll(\".lyrics p\"));",
    "  var candidates = rows.filter(function (row) { return row.dataset.section !== \"1\"; });",
    "  var times = (function () {",
    "    var map = {};",
    "    var data = " + JSON.stringify(Array.isArray(timestamps) ? timestamps : []) + ";",
    "    for (var i = 0; i < data.length; i += 1) {",
    "      if (data[i] && isFinite(Number(data[i].start))) map[Number(data[i].line)] = Number(data[i].start);",
    "    }",
    "    return map;",
    "  })();",
    "  var context = null;",
    "  var analyser = null;",
    "  var animation = 0;",
    "  var activeIndex = -1;",
    "  var ACCENT = \"" + accent + "\";",
    "  function formatTime(seconds) {",
    "    if (!isFinite(seconds)) return \"00:00\";",
    "    var whole = Math.max(0, Math.floor(seconds));",
    "    var m = Math.floor(whole / 60);",
    "    var s = whole % 60;",
    "    return (m < 10 ? \"0\" + m : m) + \":\" + (s < 10 ? \"0\" + s : s);",
    "  }",
    "  function paint() {",
    "    var ratio = Math.min(window.devicePixelRatio || 1, 2);",
    "    var width = Math.max(canvas.clientWidth, 1);",
    "    var height = Math.max(canvas.clientHeight, 1);",
    "    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) { canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio); }",
    "    var draw = canvas.getContext(\"2d\");",
    "    draw.setTransform(ratio, 0, 0, ratio, 0, 0);",
    "    draw.clearRect(0, 0, width, height);",
    "    var bins = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);",
    "    if (analyser) analyser.getByteFrequencyData(bins);",
    "    var lowCount = Math.min(8, bins.length);",
    "    var low = 0;",
    "    for (var i = 0; i < lowCount; i += 1) low += bins[i];",
    "    low = lowCount ? low / lowCount : 0;",
    "    document.documentElement.style.setProperty(\"--pulse\", String(Math.min(1, low / 80)));",
    "    var count = 46;",
    "    var gap = 3;",
    "    var bar = Math.max(2, (width - gap * (count - 1)) / count);",
    "    for (var index = 0; index < count; index += 1) {",
    "      var sample = bins[Math.floor((index / count) * bins.length)] || (audio.paused ? 18 + Math.sin(index * 0.65) * 9 : 0);",
    "      var level = Math.max(3, (sample / 255) * (height - 8));",
    "      var x = index * (bar + gap);",
    "      var y = height - level;",
    "      var gradient = draw.createLinearGradient(0, y, 0, height);",
    "      gradient.addColorStop(0, ACCENT);",
    "      gradient.addColorStop(1, ACCENT + \"33\");",
    "      draw.fillStyle = gradient;",
    "      draw.beginPath();",
    "      if (draw.roundRect) draw.roundRect(x, y, bar, level, Math.min(bar / 2, 3)); else draw.rect(x, y, bar, level);",
    "      draw.fill();",
    "    }",
    "    if (!audio.paused && !audio.ended) animation = requestAnimationFrame(paint);",
    "  }",
    "  function syncLyrics() {",
    "    if (!candidates.length || !isFinite(audio.duration) || audio.duration <= 0) return;",
    "    var known = Object.keys(times).length > 0;",
    "    var selected = null;",
    "    if (known) {",
    "      for (var k = 0; k < candidates.length; k += 1) {",
    "        var rowIndex = rows.indexOf(candidates[k]);",
    "        if (times[rowIndex] != null && times[rowIndex] <= audio.currentTime + 0.15) selected = candidates[k];",
    "      }",
    "    } else {",
    "      selected = candidates[Math.min(candidates.length - 1, Math.floor((audio.currentTime / audio.duration) * candidates.length))];",
    "    }",
    "    if (!selected) return;",
    "    var index = rows.indexOf(selected);",
    "    if (index === activeIndex) return;",
    "    activeIndex = index;",
    "    rows.forEach(function (row, i) { row.classList.toggle(\"active\", i === index); });",
    "    var panel = selected.parentElement;",
    "    panel.scrollTo({ top: Math.max(0, selected.offsetTop - panel.clientHeight / 2), behavior: \"smooth\" });",
    "  }",
    "  audio.addEventListener(\"play\", async function () {",
    "    var AudioContextType = window.AudioContext || window.webkitAudioContext;",
    "    if (!AudioContextType) return;",
    "    if (!context) {",
    "      context = new AudioContextType();",
    "      analyser = context.createAnalyser();",
    "      analyser.fftSize = 256;",
    "      analyser.smoothingTimeConstant = 0.84;",
    "      var node = context.createMediaElementSource(audio);",
    "      node.connect(analyser);",
    "      analyser.connect(context.destination);",
    "    }",
    "    await context.resume();",
    "    cancelAnimationFrame(animation);",
    "    paint();",
    "  });",
    "  audio.addEventListener(\"pause\", function () { cancelAnimationFrame(animation); paint(); });",
    "  audio.addEventListener(\"ended\", function () { cancelAnimationFrame(animation); paint(); });",
    "  audio.addEventListener(\"timeupdate\", function () {",
    "    clock.textContent = formatTime(audio.currentTime) + \" / \" + formatTime(audio.duration);",
    "    syncLyrics();",
    "  });",
    "  requestAnimationFrame(paint);",
    "})();",
  ].join("\n");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>" + escapeHtml(title) + "</title>",
    "<style>",
    css,
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    "<h1>" + escapeHtml(title) + "</h1>",
    '<p class="source"><a href="' + escapeHtml(source) + '" target="_blank" rel="noopener">' + escapeHtml(source) + "</a></p>",
    '<div class="stage"><div class="orbit"></div><canvas id="spectrum" aria-label="Live audio spectrum"></canvas></div>',
    (lyrics.length ? '<section class="lyrics">\n    ' + rows + "\n</section>" : ""),
    '<audio id="player" src="' + escapeHtml(source) + '" crossorigin="anonymous" controls preload="metadata"></audio>',
    '<footer><span>SELF-CONTAINED PLAYER &middot; MM-TOOLS</span><time id="clock">00:00 / 00:00</time></footer>',
    "</main>",
    "<script>",
    script,
    "</scr" + "ipt>",
    "</body>",
    "</html>",
  ].join("\n");
}

function audioBufferToWav(buffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  const writeString = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
  writeString(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); writeString(8, "WAVE");
  writeString(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true);
  writeString(36, "data"); view.setUint32(40, dataSize, true);
  let offset = 44;
  const channelData = [...Array(channels)].map((_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(arrayBuffer);
}

export { escapeHtml, hexToRgb, buildAudioPlayerHtml, audioBufferToWav };
