import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'design-preview', '防具幻化-压缩.png')
const target = path.join(root, 'ui/public/assets/catalog/appearance/hunter.png')
const bytes = fs.readFileSync(source)
if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.readUInt32BE(16) !== 256 || bytes.readUInt32BE(20) !== 1024) throw new Error('Unexpected user appearance sprite: expected original 256×1024 PNG')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.copyFileSync(source, target)
if (!fs.readFileSync(target).equals(bytes)) throw new Error('Appearance sprite copy changed the source artwork')
console.log(`Appearance sprite prepared unchanged: ${createHash('sha256').update(bytes).digest('hex')}`)
