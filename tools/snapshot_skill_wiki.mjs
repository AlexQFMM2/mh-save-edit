#!/usr/bin/env node
// Preparation only: snapshot explicitly versioned Wiki tables outside the repository.
// Never imports rows into runtime data or equates Wiki row numbers with game IDs.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { JSDOM } from 'jsdom'
import { pathToFileURL } from 'node:url'

export function extractTables(html) {
  const document = new JSDOM(html).window.document
  const tables = []
  for (const table of document.querySelectorAll('table')) {
    const rows = []; const pending = new Map()
    for (const tr of table.rows) {
      if (tr.closest('table') !== table) continue
      const row = []; const next = new Map()
      for (const [col, item] of pending) {
        row[col] = item.text
        if (item.remaining > 1) next.set(col, { ...item, remaining: item.remaining - 1 })
      }
      let col = 0
      for (const cell of tr.cells) {
        while (row[col] !== undefined) col++
        const copy = cell.cloneNode(true)
        for (const br of copy.querySelectorAll('br')) br.replaceWith('\n')
        const text = copy.textContent.replace(/\u00a0/g, ' ').replace(/[\t ]+/g, ' ').trim()
        const span = Math.max(1, cell.colSpan)
        for (let offset = 0; offset < span; offset++) {
          row[col + offset] = text
          if (cell.rowSpan > 1) next.set(col + offset, {text, remaining: cell.rowSpan - 1})
        }
        col += span
      }
      pending.clear(); for (const entry of next) pending.set(...entry)
      if (row.some(Boolean)) rows.push(row)
    }
    // Ignore navigation, equipment lists, comments, and layout tables.
    const headerIndex = rows.findIndex(row => row.some(c => /効果|效果/.test(c)) && row.some(c => /ポイント|点数/.test(c)))
    if (headerIndex >= 0) tables.push({header: rows[headerIndex], rows: rows.slice(headerIndex + 1)})
  }
  return tables
}

export const sources = [
  {game: 'mh3g', version: 'MH3G', url: 'http://wiki.gotvg.cn/mh3g/index.php?title=%E6%8A%80%E8%83%BD'},
  ...[1447,1448,1449,1450,1451,1452,1700].map(id => ({game: 'mh4g', version: 'MH4G', url: `http://wiki.mh4g.org/data/${id}.html`})),
  ...[2201,2202,2203,2204,2205,2206,2207].map(id => ({game: 'mhgu', version: 'MHXX', url: `http://wiki.mhxg.org/data/${id}.html`, caveat: 'MHXX Wiki reference; not independently verified MHGU executable evidence'})),
]

async function main() {
  const output = process.argv[2]
  if (!output) throw new Error('Usage: node tools/snapshot_skill_wiki.mjs PRIVATE_NEW_OUTPUT_DIRECTORY')
  const root = path.resolve(output)
  if (fs.existsSync(root)) throw new Error('Refusing to overwrite an existing snapshot directory')
  fs.mkdirSync(root, {recursive: true})
  const records = []
  const selected = process.argv.includes('--mh3g-reference')
    ? [1007,1008,1010,1011,1013,1012].map(id => ({game:'mh3g',version:'MH3G',url:`http://mh3g.trigwiki.jp/data/${id}.html`}))
    : sources
  for (const [index, source] of selected.entries()) {
    try {
      const response = await fetch(source.url, {signal: AbortSignal.timeout(30000)})
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      const html = bytes.toString('utf8')
      const tables = extractTables(html)
      if (!tables.length) throw new Error('No skill effect table found; do not treat as an empty successful source')
      const file = `${source.game}-${index}.html`
      fs.writeFileSync(path.join(root, file), bytes)
      const record = {...source, file, retrievedAt: new Date().toISOString(), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), tables}
      records.push(record)
      console.log(source.game, source.url, tables.reduce((n,t) => n+t.rows.length,0), 'rows')
    } catch (error) {
      records.push({...source, error: String(error)})
      console.error(source.url, String(error))
    }
    fs.writeFileSync(path.join(root, 'snapshot.json'), JSON.stringify({format:'skill-wiki-snapshot-v1', records},null,2)+'\n')
  }
  if (records.some(r => r.error)) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main()
