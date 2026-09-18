import path from 'node:path'
import { parseArgs } from 'node:util'
import { verifyPackagedRuntime } from './runtime/verifyPackagedRuntime.mjs'

const { values } = parseArgs({ options: { 'source-data': { type: 'string' }, 'packaged-data': { type: 'string' } }, strict: true, allowPositionals: false })
for (const [name, value] of Object.entries(values)) if (!value.trim()) throw new Error(`--${name} must name a directory`)
const source = values['source-data'] ? path.resolve(values['source-data']) : path.resolve(import.meta.dirname, '../data')
const packaged = values['packaged-data'] ? path.resolve(values['packaged-data']) : path.resolve(import.meta.dirname, '../release/win-unpacked/resources/data')
console.log(JSON.stringify(verifyPackagedRuntime(source, packaged), null, 2))
