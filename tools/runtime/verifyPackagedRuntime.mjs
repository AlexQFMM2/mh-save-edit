import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { assertNoMh4gReportBytes } from './mh4gRuntimePrivacy.mjs'

/** Pure file-identity check after packaging. The source must already have passed
 * audit_runtime_catalog; do not load SQLite here because packaging may rebuild
 * native dependencies for Electron's ABI rather than the host Node ABI. */
export function verifyPackagedRuntime(sourceData, packagedData) {
  const source = fs.realpathSync(sourceData)
  const packaged = fs.realpathSync(packagedData)
  if (source === packaged) throw new Error('Packaged runtime verification requires a separate output directory')
  const databases = ['mh3g.sqlite', 'mh4g.sqlite', 'mhgu.sqlite', 'mhp2g.sqlite', 'item-terminology.sqlite']
  const allowed = new Set(databases)
  for (const directory of [source, packaged]) {
    for (const name of fs.readdirSync(directory)) {
      if (name.toLowerCase().endsWith('.sqlite') && !allowed.has(name)) throw new Error(`Unexpected SQLite runtime asset: ${name}`)
    }
    for (const name of allowed) {
      const wal = path.join(directory, `${name}-wal`)
      if (fs.existsSync(wal) && fs.statSync(wal).size > 0) throw new Error(`Runtime asset has a live WAL; checkpoint a consistent database before packaging: ${name}`)
    }
  }
  const files = [...databases, 'mhp2g-save-profile.json'].map(name => {
    const input = fs.readFileSync(path.join(source, name))
    const output = fs.readFileSync(path.join(packaged, name))
    if (name === 'mh4g.sqlite') { assertNoMh4gReportBytes(input); assertNoMh4gReportBytes(output) }
    const sha256 = createHash('sha256').update(input).digest('hex')
    if (input.length !== output.length || sha256 !== createHash('sha256').update(output).digest('hex')) throw new Error(`Packaged runtime differs from audited source: ${name}`)
    return { name, bytes: input.length, sha256 }
  })
  return { source, packaged, files }
}
