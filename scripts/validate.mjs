import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))
const checks = []
const check = (label, ok, detail = '') => checks.push({ label, ok: Boolean(ok), detail })

check('package identity', pkg.name === 'mulqi-better-deepseek')
check('requested package version', pkg.version === '0.2.1-rc.2', `found ${pkg.version}`)
check('DSH compatibility range', pkg.engines?.dsh === '>=0.2.1-rc.2 <0.2.2', `found ${pkg.engines?.dsh}`)
check('bundle patch declared', pkg.dsh?.bundle?.patch === './cordis.patch.yml')
check('runtime entry exists', fs.statSync(path.join(root, 'index.js')).isFile())
check('icon exists', fs.statSync(path.join(root, 'assets/icon.svg')).isFile())
const runtime = read('index.js')
check('bridge API markers', ['/ping', '/events', '/session.create', '/session.prompt', '/session.cancel', '/session.result'].every(s => runtime.includes(s)))
check('readme install instructions', read('README.md').includes('dsh plugin --profile web add'))
check('notice credits source', read('NOTICE').includes('EdgeTypE/dsh-better-deepseek'))
const svg = read('assets/icon.svg')
check('square SVG icon', /<svg\b[^>]*width="256"[^>]*height="256"[^>]*viewBox="0 0 256 256"/.test(svg))

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)
console.log(`\n${checks.filter(c => c.ok).length}/${checks.length} checks passed`)
if (checks.some(c => !c.ok)) process.exitCode = 1
