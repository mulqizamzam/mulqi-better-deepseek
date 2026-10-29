import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = p => fs.readFileSync(path.join(root, p), 'utf8')
const packageJson = JSON.parse(read('package.json'))
const patch = read('cordis.patch.yml')
const entry = read('index.js')
const readme = read('README.md')

test('package metadata targets the requested DSH release', () => {
  assert.equal(packageJson.version, '0.2.1-rc.2')
  assert.equal(packageJson.engines.dsh, '>=0.2.1-rc.2 <0.2.2')
  assert.equal(packageJson.repository.url, 'https://github.com/mulqizamzam/mulqi-better-deepseek.git')
})

test('bundle patch registers one enabled bridge row with CORS default', () => {
  assert.match(patch, /id: mulqi-better-deepseek/)
  assert.match(patch, /name: 'mulqi-better-deepseek'/)
  assert.match(patch, /enableCors: true/)
})

test('HTTP bridge surface and event families remain present', () => {
  for (const route of ['/ping', '/events', '/session.create', '/session.prompt', '/session.cancel', '/session.result']) {
    assert.ok(entry.includes(route), `route ${route} is represented`)
  }
  for (const event of ['assistant/chunk', 'assistant/message', 'tool/call', 'tool/result', 'turn/complete', 'turn/stopping']) {
    assert.ok(entry.includes(event), `event ${event} is represented`)
  }
})

test('bridge validates JSON bodies and caps payload size', () => {
  assert.match(entry, /MAX_BODY_BYTES = 1024 \* 1024/)
  assert.match(entry, /Request body must be valid JSON/)
  assert.match(entry, /Request body must be a JSON object/)
})

test('beginner documentation includes install, verification, and network safety guidance', () => {
  assert.match(readme, /dsh plugin --profile web add/)
  assert.match(readme, /\/api\/better-deepseek\/ping/)
  assert.match(readme, /no authentication/i)
})
