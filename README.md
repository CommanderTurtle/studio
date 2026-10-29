# studio

Standalone, browser-local audio and lyric timing, derived from the [mm-tools Yue2 studio](https://github.com/CommanderTurtle/mm-tools/tree/main/music/yue2). No Python server, model runtime, account or CDN.

Try it out : at [app.shel.sh/studio](https://app.shel.sh/studio)

## Build and open

With [Bun](https://bun.sh/) installed, run from this directory:

```sh
bun install --frozen-lockfile && bun run dev
```

Open **http://127.0.0.1:8194**. To build without starting a server:

```sh
bun run build
```

The deliverable is **`dist/index.html`**. Copy that one file anywhere or serve `dist/` at any path; it has no absolute asset routes. JavaScript, the AAC encoder's WASM, licenses and corresponding studio source are embedded. Opening the HTML directly works for lyric editing and HTML/project exports; MP4 needs a browser with WebCodecs/H.264 encoding in a secure context (localhost or HTTPS recommended). No cross-origin isolation headers are required. `PORT=8195 bun run start` changes the preview port on Unix; in PowerShell use `$env:PORT=8195; bun run start`.

## Use

1. Choose or drop audio. WAV, MP3, FLAC and M4A are supported when the browser can decode their contained codec. Other browser-decodable audio and video files can be used for their audio; this is not an arbitrary-codec transcoder. Files never leave the browser.
2. Import `lyrics.md` / `.txt`, or type into Lyrics. Any nonempty line is one entry; repeated blank lines are ignored. `[Verse]`-style headings remain section headings, not timed lyrics. Markdown is plain text, not executed HTML. Timed `.lrc` import is also available.
3. Click **Start timing**, play the track, then **Mark line** or press **Enter** as each lyric begins. Click a lyric to choose a different target. Undo reverses the last mark. **Save timing** commits; **Cancel** discards only the draft. Space toggles playback and arrows seek five seconds when not typing in a field.
4. Expand **Timeline** to edit seconds, remove individual marks, or import/export timestamps and LRC. Imported JSON accepts either an array or `{ "lyric_timestamps": [{ "line": 1, "start": 0.5 }] }`. Row indices are zero-based **including section headings**, exactly as in Yue. Entries must be in chronological lyric order. Editing words retains timing only for unchanged matching lines; moved lines that would make the timeline run backwards lose their mark.
5. **Save project** includes the original media, lyrics, title, accent and timestamps in a `.studio.json` file. **Open project** restores it. Nothing is silently persisted; save before closing or reloading.

## Exports

- **HTML:** calls the **unchanged** `buildAudioPlayerHtml` from mm-tools at `789efc7778e4c05a948bffb3c96ea91c03844c44`. It produces the original Yue player layout, styles and highlighting logic, with embedded media substituted for its source URL. The original MM-TOOLS footer is retained. No Blob URLs or remote media dependencies leak into the export. Without saved timings it retains Yue's evenly spaced preview highlighting.
- **MP4:** renders the black performance view at 30 fps with the saved timeline, an audio-derived spectrum, H.264 video and AAC audio. 720p/1080p landscape and 1080p portrait are offered. Encoding is offline, not real-time screen recording. A bundled AAC WASM encoder is used only when native AAC encoding is unavailable. Browser H.264 availability varies; a missing encoder is reported without disabling HTML export. Very long tracks/high resolutions can exhaust memory because decoded audio and the completed MP4 are held in memory. Cancel stops the job without downloading a partial file.
- **Project / timing JSON / LRC:** local, editable interchange files.

The editor uses mm-tools's manual timing model and performance presentation to sync lyrics with a rendered view

## Source and updates

`src/vendor/upstream.json` records the original revision and SHA-256 for every vendored function. `bun test` checks those hashes. The player builder is not reimplemented. To intentionally re-vendor from a checked-out mm-tools tree, review its diff and update the pinned revision in `scripts/vendor-yue.ts`, then run:

```sh
bun scripts/vendor-yue.ts /absolute/path/to/mm-tools
```

## Checks

```sh
bun test
bun run build
bun test
```

`scripts/fixtures.ts` generates a six-second WAV, Markdown lyrics and timing JSON under ignored `.work/fixtures`. Pass a local FFmpeg executable as its first argument to additionally generate FLAC, MP3 and M4A for manual browser checks. FFmpeg is not a runtime dependency of studio.

The implementation pass checked WAV/FLAC/MP3/M4A import, manual timing/undo/save/cancel, project round-trip, original HTML output parity, native and bundled-software AAC exports, MP4 cancellation/restart, and 720p landscape / 1080p portrait video. Both audio and video streams were decoded independently after export. The embedded source download was restored and rebuilt successfully.

License: AGPL-3.0-only for this standalone player implementation project.
