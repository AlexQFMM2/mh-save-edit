#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { GMD_TYPE, parseArc } from './lib/mhQuestArc.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)

function option(name, required = true) {
  const index = args.indexOf(name)
  const value = index >= 0 ? args[index + 1] : undefined
  if (required && !value) throw new Error(`缺少参数 ${name}`)
  return value
}

const researchRoot = path.resolve(projectRoot, option('--research-root'))
const residentFile = path.resolve(option('--resident'))
const residentCnFile = path.resolve(option('--resident-cn'))
const residentXxFile = path.resolve(option('--resident-xx'))
const supportEnFile = path.resolve(option('--support-en'))
const wikiFile = option('--wiki', false)
const sourceLabels = {
  resident: option('--resident-source', false) ?? residentFile,
  residentCn: option('--resident-cn-source', false) ?? residentCnFile,
  residentXx: option('--resident-xx-source', false) ?? residentXxFile,
  supportEn: option('--support-en-source', false) ?? supportEnFile,
  wiki: option('--wiki-source', false) ?? wikiFile ?? null,
}

const outputRoot = path.join(researchRoot, 'mhgu/palico')
const nativeRoot = path.join(outputRoot, 'native/resident')
const localizationRoot = path.join(outputRoot, 'localization')
const wikiRoot = path.join(outputRoot, 'wiki')
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

for (const file of [residentFile, residentCnFile, residentXxFile, supportEnFile, wikiFile].filter(Boolean)) {
  if (!fs.existsSync(file)) throw new Error(`输入不存在：${file}`)
}

const resident = parseArc(residentFile)
const residentCn = parseArc(residentCnFile)
const residentXx = parseArc(residentXxFile)

function entry(archive, name, type) {
  const value = archive.entries.find(candidate => candidate.name === name && candidate.type === type)
  if (!value) throw new Error(`${archive.file} 缺少 ${name}`)
  return value.data
}

const support = entry(resident, 'otomo\\support\\spt_act_base', 0x7a395cb7)
const skills = entry(resident, 'otomo\\ot_skl', 0x0f86c052)
const supportXx = entry(residentXx, 'otomo\\support\\spt_act_base', 0x7a395cb7)
const skillsXx = entry(residentXx, 'otomo\\ot_skl', 0x0f86c052)
const supportCn = entry(residentCn, 'chS\\otomo\\support\\spt_act_base_chS', GMD_TYPE)
const supportJp = entry(residentXx, 'otomo\\support\\spt_act_base_jpn', GMD_TYPE)
const supportEn = fs.readFileSync(supportEnFile)

if (!support.equals(supportXx)) throw new Error('MHGU/MHXX spt_act_base 原生表不一致')
if (!skills.equals(skillsXx)) throw new Error('MHGU/MHXX ot_skl 原生表不一致')
if (support.readUInt32LE(4) !== 58 || support.length !== 8 + 58 * 24) throw new Error('spt_act_base 结构不符合 58 × 24 字节')
if (skills.readUInt32LE(4) !== 96 || skills.length !== 8 + 96 * 11) throw new Error('ot_skl 结构不符合 96 × 11 字节')

function validateGmd(data, name, expectedCount) {
  if (data.length < 40 || data.subarray(0, 3).toString('ascii') !== 'GMD') throw new Error(`${name} 不是有效 GMD`)
  if (data.readUInt32LE(24) !== expectedCount) throw new Error(`${name} 字符串数量不是 ${expectedCount}`)
}

validateGmd(supportCn, 'spt_act_base_chS', 116)
validateGmd(supportEn, 'spt_act_base_eng', 116)
validateGmd(supportJp, 'spt_act_base_jpn', 116)

const outputs = [
  ['native/resident/spt_act_base.sab', support, 'resident', 'otomo\\support\\spt_act_base'],
  ['native/resident/ot_skl.oskl', skills, 'resident', 'otomo\\ot_skl'],
  ['localization/chS/spt_act_base_chS.gmd', supportCn, 'residentCn', 'chS\\otomo\\support\\spt_act_base_chS'],
  ['localization/eng/spt_act_base_eng.gmd', supportEn, 'supportEn', 'eng\\otomo\\support\\spt_act_base_eng.gmd'],
  ['localization/jpn/spt_act_base_jpn.gmd', supportJp, 'residentXx', 'otomo\\support\\spt_act_base_jpn'],
]

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}`
  fs.writeFileSync(temporary, data)
  fs.renameSync(temporary, file)
}

for (const [relativePath, data] of outputs) writeAtomic(path.join(outputRoot, relativePath), data)
if (wikiFile) {
  fs.mkdirSync(wikiRoot, { recursive: true })
  writeAtomic(path.join(wikiRoot, 'support-moves.html'), fs.readFileSync(wikiFile))
}

const inputs = [
  ['resident', residentFile],
  ['residentCn', residentCnFile],
  ['residentXx', residentXxFile],
  ['supportEn', supportEnFile],
  ...(wikiFile ? [['wiki', wikiFile]] : []),
].map(([key, file]) => ({ key, source: sourceLabels[key], size: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)) }))

const manifest = {
  format: 'mh-save-edit-palico-resident-extract-v1',
  extractedAtUtc: new Date().toISOString(),
  inputs,
  entries: outputs.map(([relativePath, data, inputKey, entryName]) => ({ relativePath, inputKey, entryName, size: data.length, sha256: sha256(data) })),
  crossVersion: {
    supportTableSha256: sha256(support),
    skillTableSha256: sha256(skills),
    mhguMhxxIdentical: true,
  },
}
writeAtomic(path.join(nativeRoot, 'source-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest, null, 2))
