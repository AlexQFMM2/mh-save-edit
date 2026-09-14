#!/usr/bin/env node
/*
 * Read-only skill-effect evidence inspector.
 *
 * This command intentionally does not produce catalog data or infer binary
 * field meanings. It resolves a user query to Dex skill rows, then prints the
 * native GU/XX records (when available) and any separately reviewed numeric
 * references. The output is evidence for the audit workflow, not a gameplay
 * calculator.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const here = path.dirname(new URL(import.meta.url).pathname)
const projectRoot = path.resolve(here, '..')

const args = process.argv.slice(2)
const option = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback
}

const game = option('game')
const query = option('skill') ?? option('query')
const researchRoot = path.resolve(option('research-root', path.resolve(projectRoot, '../research')))

if (!game || !['mh3g', 'mh4g', 'mhgu', 'mhxx'].includes(game) || !query?.trim()) {
  console.error('Usage: node tools/inspect_skill_effect.mjs --game <mh3g|mh4g|mhgu|mhxx> --skill <name-or-id> [--research-root <path>]')
  process.exit(2)
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '').trimEnd()
  const lines = text.split(/\r?\n/)
  if (!lines.length) return []
  const parse = (line) => {
    const values = []
    let value = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i += 1 } else quoted = !quoted
      } else if (char === ',' && !quoted) { values.push(value); value = '' } else value += char
    }
    values.push(value)
    return values
  }
  const headers = parse(lines[0])
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parse(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function normalize(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/[\s_\-+【】［］:：]/g, '')
}

function numericQuery(value) {
  const raw = String(value).trim().toLocaleLowerCase()
  if (/^0x[0-9a-f]+$/.test(raw)) return Number.parseInt(raw.slice(2), 16)
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10)
  return null
}

function dexDirectory(selectedGame) {
  if (selectedGame === 'mh3g') return path.join(researchRoot, 'mh3u/dex/mh3g-dex/direct_sql')
  if (selectedGame === 'mh4g') return path.join(researchRoot, 'mh4g/dex/mh4g-dex/direct_sql')
  return path.join(researchRoot, 'mhgu/dex/mhxx-dex/direct_sql')
}

function gmdMessages(file) {
  if (!fs.existsSync(file)) return []
  const data = fs.readFileSync(file)
  if (data.subarray(0, 4).toString('ascii') !== 'GMD\0') return []
  const count = data.readUInt32LE(0x18)
  const payloadSize = data.readUInt32LE(0x20)
  const labelLength = data.readUInt32LE(0x24)
  const start = 0x29 + labelLength
  const payload = data.subarray(start, start + payloadSize)
  const values = payload.toString('utf8').split('\0')
  if (values.at(-1) === '') values.pop()
  if (values.length !== count) return []
  return values
}

function countedRecords(file) {
  const data = fs.readFileSync(file)
  const count = data.readUInt32LE(4)
  const recordSize = count && (data.length - 8) % count === 0 ? (data.length - 8) / count : null
  return { data, count, recordSize }
}

const dex = dexDirectory(game)
const treeRows = readCsv(path.join(dex, 'ID_SklTree_Name.csv')).filter((row) => Number(row.SklTree_ID) > 0)
const activationRows = readCsv(path.join(dex, 'ID_Skl_Name.csv')).filter((row) => Number(row.Skl_ID) > 0)
const descriptions = new Map(readCsv(path.join(dex, 'ID_Skl_Des.csv')).map((row) => [Number(row.Skl_ID), row]))
const points = readCsv(path.join(dex, 'DB_Skl.csv')).filter((row) => Number(row.Skl_ID) > 0)
const numeric = numericQuery(query)
const needle = normalize(query)

const matchingTrees = treeRows.filter((row) => numeric === Number(row.SklTree_ID) || Object.values(row).some((value) => normalize(value).includes(needle)))
const treeIds = new Set(matchingTrees.map((row) => Number(row.SklTree_ID)))
const matchingActivations = activationRows.filter((row) => numeric === Number(row.Skl_ID) || treeIds.has(Number(points.find((point) => Number(point.Skl_ID) === Number(row.Skl_ID))?.SklTree_ID)) || Object.values(row).some((value) => normalize(value).includes(needle)))
const matchedTreeIds = new Set([
  ...treeIds,
  ...matchingActivations.map((row) => Number(points.find((point) => Number(point.Skl_ID) === Number(row.Skl_ID))?.SklTree_ID)).filter(Number.isFinite),
])
const matchedTreeJapaneseNames = new Set(treeRows.filter((row) => matchedTreeIds.has(Number(row.SklTree_ID))).map((row) => normalize(row.SklTree_Name_3)))

const result = {
  query,
  game,
  sourcePolicy: 'read-only evidence; native binary fields are not semantically decoded unless explicitly reviewed',
  dex: {
    directory: dex,
    skillTrees: matchingTrees.map((row) => ({
      id: Number(row.SklTree_ID),
      names: { en: row.SklTree_Name_0, cn: row.SklTree_Name_1, jp: row.SklTree_Name_3 },
    })),
    activations: matchingActivations.map((row) => {
      const point = points.find((candidate) => Number(candidate.Skl_ID) === Number(row.Skl_ID))
      const description = descriptions.get(Number(row.Skl_ID))
      return {
        id: Number(row.Skl_ID),
        skillTreeId: point ? Number(point.SklTree_ID) : null,
        threshold: point ? Number(point.Pt) : null,
        names: { en: row.Skl_Name_0, cn: row.Skl_Name_1, jp: row.Skl_Name_3 },
        descriptions: description ? { en: description.Skl_Des_0, cn: description.Skl_Des_1, jp: description.Skl_Des_3 } : null,
      }
    }),
  },
  native: null,
  reviewedReferences: [],
}

if (game === 'mhgu' || game === 'mhxx') {
  const nativeRoot = path.join(researchRoot, 'mhgu/romfs', game === 'mhgu' ? 'mhgu-table' : 'mhxx-table')
  const nativeNamesRoot = fs.existsSync(path.join(nativeRoot, 'skillTypeData_jpn.gmd'))
    ? nativeRoot
    : path.join(researchRoot, 'mhgu/romfs/mhxx-table')
  const typeBinary = path.join(nativeRoot, 'skillTypeData.skt')
  const typeGmd = path.join(nativeRoot, 'skillTypeData_jpn.gmd')
  const effectBinary = path.join(nativeRoot, 'skillData.skd')
  const effectGmd = path.join(nativeRoot, 'skillData_jpn.gmd')
  const type = countedRecords(typeBinary)
  const effect = countedRecords(effectBinary)
  const typeNames = gmdMessages(path.join(nativeNamesRoot, 'skillTypeData_jpn.gmd'))
  const effectNames = gmdMessages(path.join(nativeNamesRoot, 'skillData_jpn.gmd'))
  const nativeNeedle = normalize(query)
  const dexJapaneseNames = new Set([
    ...matchedTreeJapaneseNames,
    ...matchingActivations.map((row) => normalize(row.Skl_Name_3)),
  ])
  const nativeTypes = []
  for (let id = 0; id < type.count; id += 1) {
    const name = typeNames[id * 2] ?? ''
    const subtitle = typeNames[id * 2 + 1] ?? ''
    if (id === numeric || dexJapaneseNames.has(normalize(name)) || (nativeNeedle && (normalize(name).includes(nativeNeedle) || normalize(subtitle).includes(nativeNeedle)))) {
      const record = type.data.subarray(8 + id * type.recordSize, 8 + (id + 1) * type.recordSize)
      nativeTypes.push({ saveSkillId: id, name, subtitle, recordSize: type.recordSize, recordHex: record.toString('hex'), semanticStatus: 'raw-only' })
    }
  }
  const nativeEffects = []
  const dexJapaneseActivationNames = new Set(matchingActivations.map((row) => normalize(row.Skl_Name_3)))
  for (let id = 0; id < effect.count; id += 1) {
    const name = effectNames[id * 2] ?? ''
    const subtitle = effectNames[id * 2 + 1] ?? ''
    if (id === numeric || dexJapaneseActivationNames.has(normalize(name)) || (nativeNeedle && (normalize(name).includes(nativeNeedle) || normalize(subtitle).includes(nativeNeedle)))) {
      const record = effect.data.subarray(8 + id * effect.recordSize, 8 + (id + 1) * effect.recordSize)
      nativeEffects.push({ nativeEffectId: id, name, subtitle, recordSize: effect.recordSize, recordHex: record.toString('hex'), semanticStatus: 'raw-only' })
    }
  }
  result.native = {
    root: nativeRoot,
    files: { skillTypeData: typeBinary, skillData: effectBinary, skillTypeNames: path.join(nativeNamesRoot, 'skillTypeData_jpn.gmd'), skillDataNames: path.join(nativeNamesRoot, 'skillData_jpn.gmd') },
    skillTypes: nativeTypes,
    effects: nativeEffects,
    guAndXxBinaryComparison: game === 'mhgu' ? 'verified separately: matching MHGU/MHXX research copies are byte-identical' : 'compare with mhgu path before treating as a shared fact',
    interpretation: 'The record bytes prove native IDs and version presence. Field meanings and gameplay formulas require a reviewed parser or executable-logic evidence.',
  }
}

const reviewed = [
  { match: /attackup\(s\)|攻击力up小|攻击力提升小/, value: '+10 raw attack', source: 'research/mhgu/motion-values/references/damage-calculator/BowCalculation.java', status: 'reference_implementation' },
  { match: /attackup\(m\)|攻击力up中|攻击力提升中/, value: '+15 raw attack', source: 'research/mhgu/motion-values/references/damage-calculator/BowCalculation.java', status: 'reference_implementation' },
  { match: /attackup\(l\)|攻击力up大|攻击力提升大/, value: '+20 raw attack', source: 'research/mhgu/motion-values/references/damage-calculator/BowCalculation.java', status: 'reference_implementation' },
  { match: /criticaleye\+1|看破\+1/, value: '+10 affinity', source: 'research/mhgu/motion-values/references/damage-calculator/BowCalculation.java', status: 'reference_implementation' },
  { match: /criticaleye\+2|看破\+2/, value: '+20 affinity', source: 'research/mhgu/motion-values/references/damage-calculator/BowCalculation.java', status: 'reference_implementation' },
  { match: /criticaleye\+3|看破\+3/, value: '+30 affinity', source: 'research/mhgu/motion-values/references/damage-calculator/BowCalculation.java', status: 'reference_implementation' },
  { match: /weaknessexploit|弱点特效|痛击/, value: 'conditional weak-zone handling is referenced, but the trigger/formula is not present in the committed calculator subset', source: 'research/mhgu/motion-values/references/damage-calculator/BowCalculation.java', status: 'logic_incomplete' },
  { match: /evasion|回避性能|闪避性能/, value: 'no exact invulnerability-frame value found in the reviewed local source subset', source: 'Dex descriptions + native records', status: 'description_or_raw_only' },
]
for (const item of reviewed) if (item.match.test(normalize(query))) result.reviewedReferences.push({ value: item.value, source: item.source, status: item.status })

console.log(JSON.stringify(result, null, 2))
