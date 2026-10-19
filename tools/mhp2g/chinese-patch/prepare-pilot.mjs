#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { hash, nativeKey, validateRows, encodeTextPackage, decodeTextPackage, fontCharacters } from './text-package.mjs'
import { readJson } from './equipment-evidence.mjs'

export function preparePilot({ nativeDirectory, localizationDirectory, reviewFile, dialogueFile, output }) {
  assert(!fs.existsSync(output), 'Use a new output directory')
  const nativeFile = path.join(nativeDirectory, 'texts.json'), native = readJson(nativeFile)
  const nativeManifest = readJson(path.join(nativeDirectory, 'manifest.json'))
  assert.equal(hash(fs.readFileSync(nativeFile)), nativeManifest.files['texts.json'].sha256, 'Native manifest mismatch')
  assert.equal(native.expandedFilesMatchRelevantIsoRanges, true)
  const localizationFile = path.join(localizationDirectory, 'localization.json'), localization = readJson(localizationFile)
  const localizationManifest = readJson(path.join(localizationDirectory, 'manifest.json'))
  assert.equal(hash(fs.readFileSync(localizationFile)), localizationManifest.outputs['localization.json'], 'Localization manifest mismatch')
  assert(localizationManifest.inputs.some(x => x.sha256 === hash(fs.readFileSync(nativeFile))), 'Different native snapshot')
  const review = readJson(reviewFile), dialogue = readJson(dialogueFile)
  assert.equal(review.schema, 'p2g-pilot-review-v1')
  assert.equal(hash(fs.readFileSync(dialogueFile)), review.dialogueEvidenceSha256, 'Dialogue evidence mismatch')
  assert.equal(dialogue.member, 5370); assert.equal(dialogue.table, 8)
  const rows = [], bound = new Set()
  for (const item of review.catalog) {
    const binding = localization.bindings[item.identity]
    assert(binding && item.name === binding.name && item.description === binding.description, 'Changed identity')
    for (const [kind, key] of [['name', item.name], ['description', item.description]]) {
      assert(!bound.has(key), 'Unexpected shared pilot entry'); bound.add(key)
      const [table, index] = key.split(':').map(Number)
      const source = native.tables.find(t => t.tableId === table)?.rows.find(r => r.index === index)
      assert(source && source.text === localization.units[key].japanese, 'Native text mismatch')
      const decision = review.units[key]
      assert(decision && decision.original === source.text, 'Stale review')
      if (kind === 'name') assert.equal(decision.translated, localization.units[key].chinese, 'Changed established pilot name')
      rows.push({ ...decision, member: 15, table, index, offset: source.pointer, resourceBytes: native.textContainer.paddedBytes,
        flag: 0 })
    }
  }
  assert.equal(review.catalog.length, 9); assert.equal(rows.length, 18)
  assert.equal(Object.keys(review.units).length, 18)
  for (let index = 86; index <= 90; index++) {
    const source = dialogue.rows.find(r => r.index === index), decision = review.dialogue.find(r => r.index === index)
    assert(source && decision && source.flag === (index === 90 ? 0 : 2), 'Dialogue sequence mismatch')
    assert.equal(decision.original, source.text); assert.equal(decision.sourceSha256, source.sha256)
    rows.push({ ...decision, member: 5370, table: 8, index, offset: source.offset, flag: source.flag, resourceBytes: 186368 })
  }
  assert.equal(review.dialogue.length, 5)
  const sorted = validateRows(rows), packet = encodeTextPackage(sorted), decoded = decodeTextPackage(packet)
  assert.deepEqual(decoded.map(r => [nativeKey(r), r.original, r.translated]), sorted.map(r => [nativeKey(r), r.original, r.translated]))
  const evidence = { schema: 'p2g-pilot-texts-v1', bootSha256: native.boot.sha256, isoSha256: native.isoSha256,
    rows: sorted, codepoints: fontCharacters(sorted), dialogue: { member: 5370, table: 8, first: 86, last: 90,
      resourceSha256: dialogue.sha256, runtimeAccepted: false },
    inputs: Object.fromEntries([nativeFile, path.join(nativeDirectory, 'manifest.json'), localizationFile,
      path.join(localizationDirectory, 'manifest.json'), reviewFile, dialogueFile].map(file => [path.resolve(file), hash(fs.readFileSync(file))])) }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
  const temporary = fs.mkdtempSync(path.join(path.dirname(path.resolve(output)), '.p2g-texts-'))
  try {
    fs.writeFileSync(path.join(temporary, 'texts.bin'), packet)
    fs.writeFileSync(path.join(temporary, 'prepared.json'), JSON.stringify(evidence, null, 2) + '\n')
    fs.writeFileSync(path.join(temporary, 'characters.json'), JSON.stringify({ codepoints: evidence.codepoints }) + '\n')
    fs.writeFileSync(path.join(temporary, 'manifest.json'), JSON.stringify({ schema: 'p2g-pilot-text-build-v1',
      files: Object.fromEntries(['texts.bin', 'prepared.json', 'characters.json'].map(name => [name, hash(fs.readFileSync(path.join(temporary, name)))])), runtimeAccepted: false }, null, 2) + '\n')
    fs.renameSync(temporary, output)
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
  return { output, entries: rows.length, characters: evidence.codepoints.length }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [nativeDirectory, localizationDirectory, reviewFile, dialogueFile, output] = process.argv.slice(2)
  assert(output, 'Usage: prepare-pilot.mjs <native-dir> <localization-dir> <review> <dialogue-evidence> <new-output>')
  console.log(preparePilot({ nativeDirectory, localizationDirectory, reviewFile, dialogueFile, output }))
}
