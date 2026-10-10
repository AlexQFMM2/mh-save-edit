#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'
import { parseCsv } from './lib/csv.mjs'
import { createItemDictionary } from './terminology/itemDictionary.mjs'
import { catalogIdentityRows } from '../api/terminology/catalogIdentity.mjs'
import { applyItemJapaneseEvidence } from './mhp2g/itemJapaneseEvidence.mjs'

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
export function repairItemJapanese(db, names) {
  const byDex = new Map(names.map(row => [Number(row.Itm_ID), row]))
  if (names.some(row => !Object.hasOwn(row, 'Itm_Name_3'))) throw new Error('Dex item Japanese column Itm_Name_3 is missing')
  const rows = db.prepare('SELECT save_id,dex_id,name_jp FROM catalog_items WHERE dex_id IS NOT NULL').all()
  const update = db.prepare('UPDATE catalog_items SET name_jp=? WHERE save_id=? AND dex_id=?')
  let changed = 0
  db.transaction(() => {
    for (const row of rows) {
      const source = byDex.get(row.dex_id)
      if (!source) throw new Error(`Missing Dex item ${row.dex_id}`)
      const jp = source.Itm_Name_3.trim()
      if (row.name_jp === jp) continue
      if (row.name_jp && row.name_jp !== source.Itm_Name_2.trim()) throw new Error(`Unexpected existing Japanese at item ${row.save_id}; review required`)
      update.run(jp, row.save_id, row.dex_id); changed++
    }
  })()
  return changed
}

// Immutable output: source catalogs and research snapshots are never changed.
export function buildItemTerminology({ inputDir, researchDir, outputDir, p2gJapanese }) {
  if (fs.existsSync(outputDir)) throw new Error(`Output already exists: ${outputDir}`)
  const snapshot = path.join(researchDir, 'generated/mh-save-edit/terminology/versions/gu-pass-02')
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json'), 'utf8'))
  for (const file of ['terminology.sqlite', 'audit.json']) {
    if (hash(path.join(snapshot, file)) !== manifest.outputs[file]) throw new Error(`GU snapshot hash mismatch: ${file}`)
  }
  const audit = JSON.parse(fs.readFileSync(path.join(snapshot, 'audit.json'), 'utf8'))
  const sourceDb = new Database(path.join(snapshot, 'terminology.sqlite'), { readonly: true })
  let guTerms
  try {
    guTerms = sourceDb.prepare("SELECT * FROM terms WHERE kind='item'").all().map(term => {
      const chosen = audit.state.chosen[term.id]?.zhHans
      const evidence = audit.state.evidence[chosen?.evidenceKey]
      if (evidence?.value !== term.zhHans || evidence?.termId !== term.id) throw new Error(`GU Chinese evidence mismatch: ${term.id}`)
      return { ...term, chineseSource: chosen.sourceClass }
    })
  } finally { sourceDb.close() }
  fs.mkdirSync(outputDir, { recursive: true })
  const catalogs = [], inputs = [], repairs = {}
  const dexPaths = { mhgu: 'mhgu/dex/mhxx-dex', mh4g: 'mh4g/dex/mh4g-dex', mh3g: 'mh3u/dex/mh3g-dex' }
  try {
    for (const gameId of ['mhgu', 'mh4g', 'mh3g', 'mhp2g']) {
      const input = path.join(inputDir, `${gameId}.sqlite`), output = path.join(outputDir, `${gameId}.sqlite`)
      inputs.push({ path: input, sha256: hash(input) })
      // VACUUM INTO captures a consistent committed SQLite snapshot, including WAL.
      const original = new Database(input, { readonly: true })
      try { original.prepare('VACUUM INTO ?').run(output) } finally { original.close() }
      const db = new Database(output), dexAliases = new Map()
      try {
        if (gameId === 'mhp2g' && p2gJapanese) {
          const evidence = JSON.parse(fs.readFileSync(p2gJapanese, 'utf8'))
          if (!evidence.inputs?.length) throw new Error('P2G Japanese evidence needs source fingerprints')
          for (const source of evidence.inputs) {
            if (hash(source.path) !== source.sha256) throw new Error(`P2G Japanese input hash mismatch: ${source.path}`)
          }
          inputs.push({ path: p2gJapanese, sha256: hash(p2gJapanese) })
          repairs.mhp2g = applyItemJapaneseEvidence(db, evidence)
        }
        if (dexPaths[gameId]) {
          const file = path.join(researchDir, dexPaths[gameId], 'direct_sql/ID_Itm_Name.csv')
          inputs.push({ path: file, sha256: hash(file) })
          const names = parseCsv(file)
          repairs[gameId] = repairItemJapanese(db, names)
          for (const row of names) dexAliases.set(Number(row.Itm_ID), [row.Itm_Name_0, row.Itm_Name_1, row.Itm_Name_2])
        }
        catalogs.push({ gameId, rows: catalogIdentityRows(db, gameId), dexAliases })
        if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error(`Invalid catalog: ${gameId}`)
      } finally { db.close() }
    }
    const output = path.join(outputDir, 'item-terminology.sqlite'), db = new Database(output)
    let report
    try { report = createItemDictionary(db, guTerms, catalogs) } finally { db.close() }
    fs.writeFileSync(path.join(outputDir, 'audit.json'), JSON.stringify({ repairs, ...report }, null, 2))
    const outputs = Object.fromEntries(fs.readdirSync(outputDir).map(file => [file, hash(path.join(outputDir, file))]))
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify({ schema: 'item-terminology-v1', created: new Date().toISOString(), guSnapshot: manifest.outputs['terminology.sqlite'], inputs, outputs }, null, 2))
    return { repairs, ...report }
  } catch (error) {
    fs.writeFileSync(path.join(outputDir, 'FAILED.txt'), String(error))
    throw error
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [inputDir, researchDir, outputDir, p2gJapanese] = process.argv.slice(2)
  if (!outputDir) throw new Error('Usage: node tools/build_item_terminology.mjs <catalog-dir> <research-dir> <new-output-dir> [p2g-japanese-evidence.json]')
  const { reviews, ...report } = buildItemTerminology({ inputDir: path.resolve(inputDir), researchDir: path.resolve(researchDir), outputDir: path.resolve(outputDir), p2gJapanese: p2gJapanese && path.resolve(p2gJapanese) })
  console.log(JSON.stringify({ ...report, reviewCount: reviews.length }, null, 2))
}
