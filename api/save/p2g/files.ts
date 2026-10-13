import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const names = ['MHP2NDG.BIN', 'PARAM.SFO'] as const
const extras = ['ICON0.PNG', 'PIC1.PNG'] as const
const journalName = '.mhp2g-save-pending'
type Pair = { bin: Buffer; sfo: Buffer }
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const buffers = (pair: Pair) => [pair.bin, pair.sfo]
function syncDirectory(path: string) {
  if (process.platform === 'win32') return
  const fd = openSync(path, 'r'); try { fsyncSync(fd) } finally { closeSync(fd) }
}
function durableWrite(path: string, bytes: Buffer) {
  const fd = openSync(path, 'wx', 0o600)
  try { writeFileSync(fd, bytes); fsyncSync(fd) } finally { closeSync(fd) }
}
function replace(path: string, bytes: Buffer) {
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try { durableWrite(temp, bytes); renameSync(temp, path); syncDirectory(dirname(path)) }
  finally { if (existsSync(temp)) rmSync(temp) }
}
function readPair(dir: string): Pair { return { bin: readFileSync(join(dir, names[0])), sfo: readFileSync(join(dir, names[1])) } }

/** A durable rollback journal is needed: two independent file renames are not a transaction. */
export class P2gSaveFiles {
  readonly directory: string
  private baseline: Pair
  constructor(binPath: string) {
    if (basename(binPath).toUpperCase() !== names[0]) throw new Error('请选择存档目录中的 MHP2NDG.BIN')
    this.directory = resolve(dirname(binPath))
    P2gSaveFiles.recover(this.directory)
    try { this.baseline = readPair(this.directory) } catch { throw new Error('读取 P2G 存档需要同目录下完整的 MHP2NDG.BIN 和 PARAM.SFO') }
  }
  get pair(): Pair { return { bin: Buffer.from(this.baseline.bin), sfo: Buffer.from(this.baseline.sfo) } }
  static recover(directory: string) {
    const pending = join(directory, journalName)
    if (!existsSync(pending)) return
    let hashes: { before: string[]; after: string[] }
    try {
      hashes = JSON.parse(readFileSync(join(pending, 'journal.json'), 'utf8'))
      if (![hashes.before, hashes.after].every(list => Array.isArray(list) && list.length === 2 && list.every(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h)))) throw new Error()
      for (const [i, name] of names.entries()) {
        const old = readFileSync(join(pending, `${name}.before`)), next = readFileSync(join(pending, `${name}.after`)), current = readFileSync(join(directory, name))
        if (digest(old) !== hashes.before[i] || digest(next) !== hashes.after[i] || ![hashes.before[i], hashes.after[i]].includes(digest(current))) throw new Error()
      }
    } catch { throw new Error('P2G 保存恢复记录不完整，或文件再次被外部修改。已保留恢复目录和备份，请勿覆盖原件') }
    for (const name of names) replace(join(directory, name), readFileSync(join(pending, `${name}.before`)))
    // Rename first: a crash while removing a retired journal must not make recovery ambiguous.
    const retired = join(directory, `.mhp2g-save-recovered-${randomUUID()}`)
    renameSync(pending, retired); syncDirectory(directory); rmSync(retired, { recursive: true })
  }
  save(pair: Pair, verify: (pair: Pair) => void, targetPath?: string, afterWrite?: (index: number) => void): { files: P2gSaveFiles; backup?: string } {
    verify(pair)
    const destination = targetPath ? resolve(dirname(targetPath)) : this.directory
    if (targetPath && basename(targetPath).toUpperCase() !== names[0]) throw new Error('P2G 副本文件名必须为 MHP2NDG.BIN')
    // An explicit target always means Save As, including the current directory.
    // saveAs rejects existing directories rather than silently replacing the source.
    if (targetPath) return this.saveAs(destination, pair, verify)
    const current = readPair(this.directory)
    if (!current.bin.equals(this.baseline.bin) || !current.sfo.equals(this.baseline.sfo)) throw new Error('磁盘上的 BIN 或 SFO 已被外部修改，请另存为或重新读取')
    const backup = join(this.directory, `.mhp2g-backup-${Date.now()}-${randomUUID()}`)
    mkdirSync(backup)
    for (const [i, name] of names.entries()) durableWrite(join(backup, name), buffers(current)[i])
    for (const name of extras) if (existsSync(join(this.directory, name))) durableWrite(join(backup, name), readFileSync(join(this.directory, name)))
    syncDirectory(backup); syncDirectory(this.directory)
    const pending = join(this.directory, journalName), staging = join(this.directory, `.mhp2g-save-stage-${randomUUID()}`)
    if (existsSync(pending)) throw new Error('存在待恢复的 P2G 保存，请重新读取')
    mkdirSync(staging)
    let journalPublished = false
    try {
      for (const [i, name] of names.entries()) { durableWrite(join(staging, `${name}.before`), buffers(current)[i]); durableWrite(join(staging, `${name}.after`), buffers(pair)[i]) }
      durableWrite(join(staging, 'journal.json'), Buffer.from(JSON.stringify({ before: buffers(current).map(digest), after: buffers(pair).map(digest) })))
      syncDirectory(staging); renameSync(staging, pending); journalPublished = true; syncDirectory(this.directory)
      // Check again after staging; never restore over an independently changed save.
      const latest = readPair(this.directory)
      if (!latest.bin.equals(current.bin) || !latest.sfo.equals(current.sfo)) throw new Error('准备保存期间文件被外部修改')
      for (const [i, name] of names.entries()) {
        const atWrite = buffers(readPair(this.directory))
        if (atWrite.some((bytes, index) => !bytes.equals(buffers(index < i ? pair : current)[index]))) throw new Error('写入期间文件被外部修改，已停止后续写入')
        replace(join(this.directory, name), buffers(pair)[i]); afterWrite?.(i)
      }
      const written = readPair(this.directory)
      if (!written.bin.equals(pair.bin) || !written.sfo.equals(pair.sfo)) throw new Error('P2G 成对写入复核失败')
      verify(written)
      const retired = join(this.directory, `.mhp2g-save-committed-${randomUUID()}`)
      renameSync(pending, retired); journalPublished = false; syncDirectory(this.directory)
      // Commit point passed. Cleanup is best effort; its failure must not report a failed save.
      try { rmSync(retired, { recursive: true }) } catch { /* Complete backup remains available. */ }
      this.baseline = written
      return { files: this, backup }
    } catch (error) {
      if (journalPublished) P2gSaveFiles.recover(this.directory)
      throw error
    } finally { if (existsSync(staging)) rmSync(staging, { recursive: true }) }
  }
  private saveAs(directory: string, pair: Pair, verify: (pair: Pair) => void) {
    if (existsSync(directory)) throw new Error('P2G 另存为需要新的 ULJM05500 子目录；目标目录已存在，请选择其他位置')
    const staging = join(dirname(directory), `.mhp2g-copy-${randomUUID()}`)
    mkdirSync(staging)
    try {
      for (const [i, name] of names.entries()) durableWrite(join(staging, name), buffers(pair)[i])
      for (const name of extras) if (existsSync(join(this.directory, name))) durableWrite(join(staging, name), readFileSync(join(this.directory, name)))
      const written = readPair(staging)
      if (!written.bin.equals(pair.bin) || !written.sfo.equals(pair.sfo)) throw new Error('P2G 副本写入与输出不一致')
      verify(written); syncDirectory(staging)
      if (existsSync(directory)) throw new Error('目标目录已存在')
      renameSync(staging, directory); syncDirectory(dirname(directory))
      return { files: new P2gSaveFiles(join(directory, names[0])) }
    } finally { if (existsSync(staging)) rmSync(staging, { recursive: true }) }
  }
}
