// Mechanical, pinned extraction. The player builder is deliberately unchanged.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'

const revision = '789efc7778e4c05a948bffb3c96ea91c03844c44'
const checkout = resolve(process.argv[2] ?? '../../scratch/mm-tools-studio-reference')
const actualRevision = Bun.spawnSync(['git', '-C', checkout, 'rev-parse', 'HEAD']);
if (actualRevision.exitCode || actualRevision.stdout.toString().trim() !== revision) {
  throw Error('Checkout must be at the pinned revision ' + revision + '. Review updates before changing the pin.');
}
const root = resolve(import.meta.dir, '..')
const file = 'music/yue2/local_app/web/app.js'
const app = await readFile(join(checkout, file), 'utf8')
const ranges = [
  ['escapeHtml', 'function escapeHtml(', '\nfunction formatBytes('],
  ['hexToRgb', 'function hexToRgb(', '\nfunction setPage('],
  ['buildAudioPlayerHtml', 'function buildAudioPlayerHtml(', '\nfunction exportAudioPlayer('],
  ['audioBufferToWav', 'function audioBufferToWav(', '\nfunction authHeaders('],
]
const functions = ranges.map(([name, start, end]) => {
  const from = app.indexOf(start!), to = app.indexOf(end!, from)
  if (from < 0 || to < 0) throw Error('Missing original function: ' + name)
  return { name, source: app.slice(from, to).trimEnd() }
})
await mkdir(join(root, 'src/vendor'), { recursive: true })
await writeFile(join(root, 'src/vendor/yue-player.js'),
  `// Unmodified functions from CommanderTurtle/mm-tools @ ${revision}\n// ${file} — AGPL-3.0-only; see LICENSE and THIRD_PARTY_NOTICES.md.\n\n`
  + functions.map(f => f.source).join('\n\n')
  + '\n\nexport { ' + functions.map(f => f.name).join(', ') + ' };\n')
await writeFile(join(root, 'src/vendor/upstream.json'), JSON.stringify({
  repository: 'https://github.com/CommanderTurtle/mm-tools', revision, file,
  functions: functions.map(f => ({ name: f.name, sha256: createHash('sha256').update(f.source).digest('hex') })),
}, null, 2) + '\n')
await copyFile(join(checkout, 'LICENSE'), join(root, 'LICENSE'))
console.log('Vendored the original Yue player builder and WAV encoder at ' + revision)
