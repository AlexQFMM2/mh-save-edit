#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const value = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}
const rootArgument = value('--root')
const sourcePath = value('--source-path')
const exportToolPath = value('--export-tool-path')
const generatedAtUtc = value('--generated-at')
if (!rootArgument || !sourcePath || !exportToolPath || !generatedAtUtc) {
  console.error('usage: create_research_manifest --root <dir> --source-path <path> --export-tool-path <path> --generated-at <ISO date>')
  process.exit(2)
}

const root = path.resolve(rootArgument)
if (!fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`)
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name)
  if (entry.isDirectory()) return walk(absolute)
  if (!entry.isFile() || entry.name === 'source-manifest.json') return []
  return [absolute]
})
const files = walk(root).sort((left, right) => left.localeCompare(right, 'en')).map((file) => ({
  path: path.relative(root, file).split(path.sep).join('/'),
  size: fs.statSync(file).size,
  sha256: sha256(file),
}))
const manifest = {
  format: 'mh-save-edit-research-source-v1',
  sourcePath,
  exportToolPath,
  generatedAtUtc: new Date(generatedAtUtc).toISOString(),
  files,
}
fs.writeFileSync(path.join(root, 'source-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ root, fileCount: files.length, contentSha256: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex') }, null, 2))
