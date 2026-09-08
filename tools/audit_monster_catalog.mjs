#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { indexCsv, parseCsv } from './lib/csv.mjs'
import { readQuestArchive } from './lib/mhQuestArc.mjs'
import {
  dlcLevelId,
  loadMonsterMappings,
} from './lib/monsterMappings.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const researchIndex = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, researchIndex >= 0 ? args[researchIndex + 1] : '../research')
const generatedRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/data/manifests')
const mappings = loadMonsterMappings(researchRoot)
const STATUS_NAMES = mappings.statusNames
const HIDDEN_STATUS_IDS = mappings.hiddenStatusIds
const TRAP_NAMES = mappings.trapNames
const NATIVE_QUEST_TYPE_TO_DEX = mappings.nativeQuestTypes
const NATIVE_LOCATION_TO_DEX = mappings.nativeLocations
const NATIVE_LARGE_MONSTER_TO_DEX = mappings.nativeLargeMonsters

const games = {
  mh3g: {
    dexCandidates: ['mh3u/dex/mh3g-monster-dex-staging-v2', 'mh3u/dex/mh3g-dex'],
    expected: { monsters: 73, weakness: 476, ailments: 438, traps: 365, drops: 3433, quests: 364 },
    markerIds: new Set([74]), iconDigits: 2, hasSecondaryQuestGoal: false, iconCounts: { small: 76, large: 76, status: 11, trap: 5 },
  },
  mh4g: {
    dexCandidates: ['mh4g/dex/mh4g-monster-dex-staging', 'mh4g/dex/mh4g-dex'],
    expected: { monsters: 106, weakness: 847, ailments: 742, traps: 530, drops: 4336, quests: 572 },
    markerIds: new Set([107, 108, 109]), iconDigits: 3, hasSecondaryQuestGoal: true, iconCounts: { small: 110, large: 106, status: 12, trap: 5 },
  },
  mhgu: {
    dexCandidates: ['mhgu/dex/mhxx-dex'],
    expected: { monsters: 129, weakness: 947, ailments: 1032, traps: 645, drops: 7527, quests: 1307 },
    markerIds: new Set([130]), iconDigits: 3, hasSecondaryQuestGoal: true, iconCounts: { small: 131, large: 131, status: 12, trap: 5 },
  },
}

const integer = (value) => Number.parseInt(String(value ?? ''), 10)
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const fileSha256 = (file) => sha256(fs.readFileSync(file))
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/[\r\n\s]/gu, '').trim()
const normalizedQuestSignature = (title, goal, subGoal) => [normalize(title).replace(/^【日】/u, ''), normalize(goal), normalize(subGoal)].join('\u001f')
const sortedNumbers = (values) => [...values].sort((left, right) => left - right)
const sortedStrings = (values) => [...values].sort((left, right) => left.localeCompare(right, 'en'))

function fail(message) {
  throw new Error(`Monster catalog preflight failed: ${message}`)
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function verifySourceManifest(root) {
  const manifestFile = path.join(root, 'source-manifest.json')
  if (!fs.existsSync(manifestFile)) fail(`missing source manifest ${manifestFile}`)
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const supportedFormats = new Set(['mh-save-edit-research-source-v1', 'mh-save-edit-dex-snapshot-v1'])
  if (!supportedFormats.has(manifest.format) || !Array.isArray(manifest.files)) {
    fail(`invalid source manifest ${manifestFile}`)
  }

  const recorded = new Set()
  for (const entry of manifest.files) {
    const normalized = path.posix.normalize(String(entry.path ?? ''))
    if (!normalized || normalized.startsWith('../') || path.isAbsolute(normalized)) fail(`unsafe source manifest path ${entry.path}`)
    const file = path.join(root, normalized)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`source manifest file is missing: ${file}`)
    if (fs.statSync(file).size !== entry.size) fail(`source manifest size mismatch: ${file}`)
    if (fileSha256(file) !== entry.sha256) fail(`source manifest SHA-256 mismatch: ${file}`)
    recorded.add(normalized)
  }

  const actual = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile() && entry.name !== 'source-manifest.json') actual.push(path.relative(root, absolute).split(path.sep).join('/'))
    }
  }
  visit(root)
  const unrecorded = actual.filter((file) => !recorded.has(file)).sort((left, right) => left.localeCompare(right, 'en'))
  if (unrecorded.length) fail(`source snapshot contains unrecorded files: ${unrecorded.join(', ')}`)

  return {
    format: manifest.format,
    manifest: path.relative(researchRoot, manifestFile).split(path.sep).join('/'),
    sourcePath: manifest.sourcePath,
    exportToolPath: manifest.exportToolPath,
    generatedAtUtc: manifest.generatedAtUtc,
    fileCount: manifest.files.length,
    contentSha256: sha256(JSON.stringify(manifest.files)),
  }
}

function dexRoot(spec) {
  const relative = spec.dexCandidates.find((candidate) => fs.existsSync(path.join(researchRoot, candidate, 'direct_sql')))
  if (!relative) fail(`missing Dex snapshot: ${spec.dexCandidates.join(' or ')}`)
  return { relative, absolute: path.join(researchRoot, relative) }
}

function loadTable(root, name, optional = false) {
  const file = path.join(root, 'direct_sql', `${name}.csv`)
  if (!fs.existsSync(file)) {
    if (optional) return []
    fail(`missing table ${file}`)
  }
  return parseCsv(file)
}

function assertCount(gameId, label, actual, expected) {
  if (actual !== expected) fail(`${gameId} ${label}: expected ${expected}, received ${actual}`)
}

function assertColumns(gameId, table, rows, requiredColumns) {
  const columns = new Set(Object.keys(rows[0] ?? {}))
  const missing = requiredColumns.filter((column) => !columns.has(column))
  if (missing.length) fail(`${gameId} ${table} is missing columns: ${missing.join(', ')}`)
}

function auditGame(gameId, spec) {
  const root = dexRoot(spec)
  const sourceSnapshot = verifySourceManifest(root.absolute)
  const names = loadTable(root.absolute, 'ID_Mon_Name')
  const validMonsters = names.filter((row) => integer(row.Mon_ID) > 0 && !spec.markerIds.has(integer(row.Mon_ID)))
  const validMonsterIds = new Set(validMonsters.map((row) => integer(row.Mon_ID)))
  const allMonsterIds = new Set(names.map((row) => integer(row.Mon_ID)))
  const items = loadTable(root.absolute, 'ID_Itm_Name')
  const parts = loadTable(root.absolute, 'ID_Mon_Part')
  const partConditions = loadTable(root.absolute, 'ID_Mon_PartCond')
  const dropTypes = loadTable(root.absolute, 'ID_Mon_GetItmType')
  const ranks = loadTable(root.absolute, 'ID_Rank')
  const questNames = loadTable(root.absolute, 'ID_Qst_Name')
  const questGoals = loadTable(root.absolute, 'ID_Qst_Goal')
  const secondaryQuestGoals = loadTable(root.absolute, 'ID_Qst_Goal2', !spec.hasSecondaryQuestGoal)
  const questLevels = loadTable(root.absolute, 'ID_Qst_Lv')
  const questTypes = loadTable(root.absolute, 'ID_Qst_Type')
  const locations = loadTable(root.absolute, 'ID_Loc_Name')
  const itemIds = new Set(items.map((row) => integer(row.Itm_ID)))
  const partIds = new Set(parts.map((row) => integer(row.Mon_Part_ID)))
  const partConditionIds = new Set(partConditions.map((row) => integer(row.Mon_Part_ID)))
  const dropTypeIds = new Set(dropTypes.map((row) => integer(row.Mon_GetItmType_ID)))
  const rankIds = new Set(ranks.map((row) => integer(row.Rank_ID)))
  const questNameIds = new Set(questNames.map((row) => integer(row.Qst_ID)))
  const questGoalIds = new Set(questGoals.map((row) => integer(row.Qst_ID)))
  const secondaryQuestGoalIds = new Set(secondaryQuestGoals.map((row) => integer(row.Qst_ID)))
  const questLevelIds = new Set(questLevels.map((row) => integer(row.Qst_Lv_ID)))
  const questTypeIds = new Set(questTypes.map((row) => integer(row.Qst_Type_ID)))
  const locationIds = new Set(locations.map((row) => integer(row.Loc_ID)))
  const stars = loadTable(root.absolute, 'ID_Star')
  const weakness = loadTable(root.absolute, 'DB_Mon_Weak')
  const ailments = loadTable(root.absolute, 'DB_Mon_Ail')
  const traps = loadTable(root.absolute, 'DB_Mon_Trap')
  const drops = loadTable(root.absolute, 'DB_ItmtoMon')
  const quests = loadTable(root.absolute, 'DB_Qst')

  assertColumns(gameId, 'ID_Mon_Name', names, ['Mon_ID', 'Mon_Name_1'])
  assertColumns(gameId, 'ID_Mon_Part', parts, ['Mon_Part_ID', 'Mon_Part_1'])
  assertColumns(gameId, 'ID_Mon_PartCond', partConditions, ['Mon_Part_ID', 'Mon_PartCond_1'])
  assertColumns(gameId, 'DB_Mon_Weak', weakness, ['MonPart_ID', 'Mon_ID', 'MonPart_Num', 'Cut', 'Impact', 'Shot', 'Fir', 'Wtr', 'Ice', 'Thd', 'Drg', 'Diz'])
  assertColumns(gameId, 'DB_Mon_Ail', ailments, ['ID', 'Mon_ID', 'Stat_ID', 'TolInitial', 'TolIncrease', 'TolMax', 'Duration', 'Damage'])
  assertColumns(gameId, 'DB_Mon_Trap', traps, ['ID', 'Mon_ID', 'Trap_ID', 'IsEffect', 'Duration', 'DurationEnraged', 'DurationFatigued'])
  assertColumns(gameId, 'DB_ItmtoMon', drops, ['ID', 'Mon_ID', 'Mon_GetItmType_ID', 'Itm_ID', 'Qty', 'Pct', 'Rank_ID'])
  assertColumns(gameId, 'DB_Qst', quests, ['Qst_ID', 'Qst_Lv_ID', 'Qst_Type_ID', 'Loc_ID', 'Time', 'Fee', 'Reward', 'HRP', ...Array.from({ length: 8 }, (_, index) => `Mon${index + 1}_ID`)])
  if (spec.hasSecondaryQuestGoal) assertColumns(gameId, 'DB_Qst', quests, ['Reward2', 'HRP2'])
  assertColumns(gameId, 'ID_Qst_Name', questNames, ['Qst_ID', 'Qst_Name_1'])
  assertColumns(gameId, 'ID_Qst_Goal', questGoals, ['Qst_ID', 'Qst_Goal_1'])
  if (spec.hasSecondaryQuestGoal) assertColumns(gameId, 'ID_Qst_Goal2', secondaryQuestGoals, ['Qst_ID', 'Qst_Goal2_1'])
  assertColumns(gameId, 'ID_Qst_Lv', questLevels, ['Qst_Lv_ID', 'Qst_Lv_1'])
  assertColumns(gameId, 'ID_Qst_Type', questTypes, ['Qst_Type_ID', 'Qst_Type_1'])
  assertColumns(gameId, 'ID_Rank', ranks, ['Rank_ID', 'Rank_1'])
  assertColumns(gameId, 'ID_Loc_Name', locations, ['Loc_ID', 'Loc_Name_1'])
  assertColumns(gameId, 'ID_Star', stars, ['Star_ID', 'Star_White', 'Star_Black'])

  assertCount(gameId, 'valid monsters', validMonsters.length, spec.expected.monsters)
  assertCount(gameId, 'weakness rows', weakness.length, spec.expected.weakness)
  assertCount(gameId, 'ailment rows', ailments.length, spec.expected.ailments)
  assertCount(gameId, 'trap rows', traps.length, spec.expected.traps)
  assertCount(gameId, 'drop rows', drops.length, spec.expected.drops)
  assertCount(gameId, 'quest rows', quests.length, spec.expected.quests)

  if (!stars.length) fail(`${gameId} has no ID_Star rows`)
  const unknown = { weaknessMonsters: [], parts: [], ailments: [], traps: [], dropMonsters: [], dropTypes: [], dropItems: [], ranks: [], quests: [], questGoals: [], secondaryQuestGoals: [], questLevels: [], questTypes: [], locations: [], questMonsters: [] }
  for (const row of weakness) {
    if (!validMonsterIds.has(integer(row.Mon_ID))) unknown.weaknessMonsters.push(integer(row.Mon_ID))
    if (!partIds.has(integer(row.MonPart_ID)) || !partConditionIds.has(integer(row.MonPart_ID))) unknown.parts.push(integer(row.MonPart_ID))
  }
  for (const row of ailments) {
    if (!validMonsterIds.has(integer(row.Mon_ID))) unknown.ailments.push(`monster:${row.Mon_ID}`)
    const statusId = integer(row.Stat_ID)
    if (!STATUS_NAMES.has(statusId) && !HIDDEN_STATUS_IDS.has(statusId)) unknown.ailments.push(`status:${statusId}`)
  }
  for (const row of traps) {
    if (!validMonsterIds.has(integer(row.Mon_ID))) unknown.traps.push(`monster:${row.Mon_ID}`)
    if (!TRAP_NAMES.has(integer(row.Trap_ID))) unknown.traps.push(`trap:${row.Trap_ID}`)
  }
  for (const row of drops) {
    if (!validMonsterIds.has(integer(row.Mon_ID))) unknown.dropMonsters.push(integer(row.Mon_ID))
    if (!dropTypeIds.has(integer(row.Mon_GetItmType_ID))) unknown.dropTypes.push(integer(row.Mon_GetItmType_ID))
    if (!itemIds.has(integer(row.Itm_ID))) unknown.dropItems.push(integer(row.Itm_ID))
    if (!rankIds.has(integer(row.Rank_ID))) unknown.ranks.push(integer(row.Rank_ID))
  }
  for (const row of quests) {
    if (!questNameIds.has(integer(row.Qst_ID))) unknown.quests.push(integer(row.Qst_ID))
    if (!questGoalIds.has(integer(row.Qst_ID))) unknown.questGoals.push(integer(row.Qst_ID))
    if (spec.hasSecondaryQuestGoal && !secondaryQuestGoalIds.has(integer(row.Qst_ID))) unknown.secondaryQuestGoals.push(integer(row.Qst_ID))
    if (!questLevelIds.has(integer(row.Qst_Lv_ID))) unknown.questLevels.push(integer(row.Qst_Lv_ID))
    if (!questTypeIds.has(integer(row.Qst_Type_ID))) unknown.questTypes.push(integer(row.Qst_Type_ID))
    if (!locationIds.has(integer(row.Loc_ID))) unknown.locations.push(integer(row.Loc_ID))
    for (let slot = 1; slot <= 8; slot += 1) {
      const monsterId = integer(row[`Mon${slot}_ID`])
      if (monsterId > 0 && !allMonsterIds.has(monsterId)) unknown.questMonsters.push(monsterId)
    }
  }
  for (const [key, values] of Object.entries(unknown)) {
    unknown[key] = [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right), 'en'))
    if (unknown[key].length) fail(`${gameId} has unknown ${key}: ${unknown[key].join(', ')}`)
  }

  const iconFile = path.join(generatedRoot, `${gameId}-monster-icons.json`)
  if (!fs.existsSync(iconFile)) fail(`missing icon manifest ${iconFile}`)
  const manifest = JSON.parse(fs.readFileSync(iconFile, 'utf8'))
  const iconEntries = Object.entries(manifest.icons ?? {})
  const iconKeys = new Set(iconEntries.map(([key]) => key))
  const prefixCount = (prefix) => [...iconKeys].filter((key) => key.startsWith(prefix)).length
  assertCount(gameId, 'small monster icons', prefixCount('Mon_S_'), spec.iconCounts.small)
  assertCount(gameId, 'large monster icons', prefixCount('Mon_B_'), spec.iconCounts.large)
  assertCount(gameId, 'status icons', prefixCount('Stat_'), spec.iconCounts.status)
  assertCount(gameId, 'trap icons', prefixCount('Trap_'), spec.iconCounts.trap)
  const smallMissing = []
  const largeMissing = []
  for (const monsterId of validMonsterIds) {
    const suffix = String(monsterId).padStart(spec.iconDigits, '0')
    if (!iconKeys.has(`Mon_S_${suffix}`)) smallMissing.push(monsterId)
    if (!iconKeys.has(`Mon_B_${suffix}`)) largeMissing.push(monsterId)
  }
  if (smallMissing.length) fail(`${gameId} missing list icons: ${smallMissing.join(', ')}`)

  const iconAssetsRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/ui-public-assets/icons')
  const missingFiles = []
  const hashMismatches = []
  const keysByAsset = new Map()
  for (const [key, relativeAsset] of iconEntries) {
    const filename = path.basename(relativeAsset)
    const file = path.join(iconAssetsRoot, filename)
    if (!fs.existsSync(file)) {
      missingFiles.push({ key, relativeAsset })
      continue
    }
    const actualHash = fileSha256(file)
    if (filename !== `${actualHash}.png`) hashMismatches.push({ key, relativeAsset, actualHash })
    keysByAsset.set(relativeAsset, [...(keysByAsset.get(relativeAsset) ?? []), key])
  }
  if (missingFiles.length) fail(`${gameId} icon files are missing: ${missingFiles.map(({ key }) => key).join(', ')}`)
  if (hashMismatches.length) fail(`${gameId} icon content hashes do not match filenames: ${hashMismatches.map(({ key }) => key).join(', ')}`)
  const duplicateAssets = [...keysByAsset.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([asset, keys]) => ({ asset, keys: sortedStrings(keys) }))
    .sort((left, right) => left.asset.localeCompare(right.asset, 'en'))

  return {
    gameId,
    dexRoot: root.relative,
    sourceSnapshot,
    counts: { monsters: validMonsters.length, weakness: weakness.length, ailments: ailments.length, traps: traps.length, drops: drops.length, quests: quests.length },
    schema: { status: 'pass', validatedTables: spec.hasSecondaryQuestGoal ? 15 : 14 },
    placeholders: { monsterIds: sortedNumbers(spec.markerIds) },
    statusIds: sortedNumbers(new Set(ailments.map((row) => integer(row.Stat_ID)))),
    hiddenStatusIds: sortedNumbers(new Set(ailments.map((row) => integer(row.Stat_ID)).filter((id) => HIDDEN_STATUS_IDS.has(id)))),
    trapIds: sortedNumbers(new Set(traps.map((row) => integer(row.Trap_ID)))),
    icons: {
      manifest: path.relative(researchRoot, iconFile),
      manifestSha256: fileSha256(iconFile),
      keys: iconEntries.length,
      uniqueAssets: keysByAsset.size,
      duplicateAssets,
      missingFiles,
      hashMismatches,
      smallMissing,
      largeMissing,
    },
    unknown,
  }
}

function questArchives(directory, language) {
  if (!fs.existsSync(directory)) fail(`missing quest archive directory ${directory}`)
  return fs.readdirSync(directory)
    .filter((file) => /^q\d+\.arc$/u.test(file))
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((file) => readQuestArchive(path.join(directory, file), language))
}

function isValidGuOnlyTask(archive) {
  if (!archive.quest || !archive.text || archive.file.startsWith('q009') || archive.file === 'q0000000.arc') return false
  const { title, client, description, goal } = archive.text
  if (!title.trim() || /dummy|预备|缺号|未使用|暂定/iu.test(title)) return false
  return ![client, description, goal].some((value) => !value.trim() || /^(?:dummy|@)$/iu.test(value.trim()))
}

function auditGuQuests() {
  const guDirectory = path.join(researchRoot, 'mhgu/romfs/mhgu-quests')
  const xxDirectory = path.join(researchRoot, 'mhgu/romfs/mhxx-quests')
  const gu = questArchives(guDirectory, 'chS')
  const xx = questArchives(xxDirectory, 'jpn')
  const guByFile = new Map(gu.map((archive) => [archive.file, archive]))
  const xxByFile = new Map(xx.map((archive) => [archive.file, archive]))
  const commonFiles = sortedStrings([...guByFile.keys()].filter((file) => xxByFile.has(file)))
  const guOnlyFiles = sortedStrings([...guByFile.keys()].filter((file) => !xxByFile.has(file)))
  const xxOnlyFiles = sortedStrings([...xxByFile.keys()].filter((file) => !guByFile.has(file)))
  assertCount('mhgu', 'common native quest files', commonFiles.length, 1330)
  assertCount('mhgu', 'GU-only native quest files', guOnlyFiles.length, 524)
  if (xxOnlyFiles.length !== 1 || xxOnlyFiles[0] !== 'q0000000.arc') fail(`unexpected XX-only quest files: ${xxOnlyFiles.join(', ')}`)

  const commonCoreMismatches = commonFiles.filter((file) => {
    const left = guByFile.get(file)?.quest?.core
    const right = xxByFile.get(file)?.quest?.core
    return !left || !right || !left.equals(right)
  })
  if (commonCoreMismatches.length) fail(`GU/XX common quest core mismatches: ${commonCoreMismatches.join(', ')}`)

  const dexRoot = path.join(researchRoot, 'mhgu/dex/mhxx-dex/direct_sql')
  const dexQuests = parseCsv(path.join(dexRoot, 'DB_Qst.csv'))
  const dexNames = indexCsv(parseCsv(path.join(dexRoot, 'ID_Qst_Name.csv')), 'Qst_ID')
  const dexGoals = indexCsv(parseCsv(path.join(dexRoot, 'ID_Qst_Goal.csv')), 'Qst_ID')
  const dexSubGoals = indexCsv(parseCsv(path.join(dexRoot, 'ID_Qst_Goal2.csv')), 'Qst_ID')
  const monsterNames = parseCsv(path.join(dexRoot, 'ID_Mon_Name.csv'))
  const monsterByChineseName = new Map(monsterNames.filter((row) => integer(row.Mon_ID) > 0 && integer(row.Mon_ID) !== 130).map((row) => [row.Mon_Name_1.trim(), integer(row.Mon_ID)]))
  const validDexMonsterIds = new Set(monsterByChineseName.values())
  const dexLocationIds = new Set(parseCsv(path.join(dexRoot, 'ID_Loc_Name.csv')).map((row) => integer(row.Loc_ID)))
  const dexTypeIds = new Set(parseCsv(path.join(dexRoot, 'ID_Qst_Type.csv')).map((row) => integer(row.Qst_Type_ID)))
  const dexLevelIds = new Set(parseCsv(path.join(dexRoot, 'ID_Qst_Lv.csv')).map((row) => integer(row.Qst_Lv_ID)))

  const guSignatureIndex = new Map()
  for (const archive of gu.filter((entry) => entry.text)) {
    const signature = normalizedQuestSignature(archive.text.title, archive.text.goal, archive.text.subGoal)
    guSignatureIndex.set(signature, [...(guSignatureIndex.get(signature) ?? []), archive.file])
  }
  const dexSignatureIndex = new Map()
  const dexCrosswalk = []
  for (const row of dexQuests) {
    const questId = integer(row.Qst_ID)
    const signature = normalizedQuestSignature(dexNames.get(questId)?.Qst_Name_1, dexGoals.get(questId)?.Qst_Goal_1, dexSubGoals.get(questId)?.Qst_Goal2_1)
    dexSignatureIndex.set(signature, [...(dexSignatureIndex.get(signature) ?? []), questId])
    const nativeFiles = sortedStrings(guSignatureIndex.get(signature) ?? [])
    if (!nativeFiles.length) fail(`MHXX Dex quest ${questId} has no MHGU signature match`)
    dexCrosswalk.push({ dexQuestId: questId, availability: 'common', mhguNativeFiles: nativeFiles })
  }
  assertCount('mhgu', 'Dex quest crosswalk', dexCrosswalk.length, 1307)

  const guOnlyValid = guOnlyFiles.map((file) => guByFile.get(file)).filter(isValidGuOnlyTask)
  assertCount('mhgu', 'valid GU-only native quest files', guOnlyValid.length, 189)
  const usedNativeMonsterIds = new Set()
  const tasks = guOnlyValid.map((archive) => {
    const native = archive.quest
    const typeId = NATIVE_QUEST_TYPE_TO_DEX.get(native.nativeTypeId)
    const locationId = NATIVE_LOCATION_TO_DEX.get(native.nativeLocationId)
    const levelId = dlcLevelId(native.nativeStar)
    if (!dexTypeIds.has(typeId)) fail(`${archive.file} unknown native quest type ${native.nativeTypeId}`)
    if (!dexLocationIds.has(locationId)) fail(`${archive.file} unknown native location ${native.nativeLocationId}`)
    if (!dexLevelIds.has(levelId)) fail(`${archive.file} unknown native DLC star ${native.nativeStar}`)
    const largeMonsterIds = native.nativeLargeMonsterIds.map((nativeId) => {
      usedNativeMonsterIds.add(nativeId)
      const dexId = NATIVE_LARGE_MONSTER_TO_DEX.get(nativeId)
      if (!validDexMonsterIds.has(dexId)) fail(`${archive.file} unknown native monster ${nativeId}`)
      return dexId
    })
    const smallNames = archive.text.appearingMonsters.split(/[\r\n、,/／・＆&]+/u).map((value) => value.trim()).filter((value) => value && value !== '无')
    const smallMonsterIds = smallNames.map((name) => {
      const dexId = monsterByChineseName.get(name)
      if (!dexId) fail(`${archive.file} unknown appearing monster ${name}`)
      return dexId
    })
    const signature = normalizedQuestSignature(archive.text.title, archive.text.goal, archive.text.subGoal)
    const dexQuestIds = sortedNumbers(dexSignatureIndex.get(signature) ?? [])
    return {
      nativeQuestId: `mhgu:${archive.file.replace(/\.arc$/u, '')}`,
      nativeFile: archive.file,
      availability: dexQuestIds.length ? 'common' : 'mhgu',
      dexQuestIds,
      titleCn: archive.text.title,
      goalCn: archive.text.goal,
      subGoalCn: archive.text.subGoal,
      typeId,
      locationId,
      levelId,
      star: native.nativeStar >= 11 ? native.nativeStar - 10 : native.nativeStar,
      rank: native.nativeStar >= 11 ? 'g' : native.nativeStar >= 4 ? 'high' : 'low',
      timeMinutes: native.timeMinutes,
      fee: native.fee,
      reward: native.reward,
      reward2: native.reward2,
      hrp: native.hrp,
      hrp2: native.hrp2,
      largeMonsterIds,
      smallMonsterIds,
    }
  })
  if (NATIVE_LARGE_MONSTER_TO_DEX.size !== 94) fail(`expected 94 native monster mappings, received ${NATIVE_LARGE_MONSTER_TO_DEX.size}`)
  assertCount('mhgu', 'native monster IDs used by GU-only tasks', usedNativeMonsterIds.size, 91)

  const semanticCommon = tasks.filter((task) => task.availability === 'common').length
  const semanticGuOnly = tasks.filter((task) => task.availability === 'mhgu').length
  const sample = (file, predicate, label) => {
    const task = tasks.find((entry) => entry.nativeFile === file)
    if (!task || !predicate(task)) fail(`fixed ${label} sample no longer matches: ${file}`)
    return {
      nativeFile: task.nativeFile,
      availability: task.availability,
      typeId: task.typeId,
      levelId: task.levelId,
      rank: task.rank,
      largeMonsterIds: task.largeMonsterIds,
    }
  }
  const fixedSamples = {
    gathering: sample('q1010002.arc', (task) => task.typeId === 1 && task.levelId === 37, 'gathering quest'),
    multiMonster: sample('q1011043.arc', (task) => task.typeId === 7 && task.largeMonsterIds.length === 5, 'multi-monster quest'),
    elderDragonAndDlcG: sample('q1011008.arc', (task) => task.rank === 'g' && task.levelId === 45 && task.largeMonsterIds.includes(120), 'elder dragon DLC G quest'),
    deviant: sample('q1020016.arc', (task) => task.levelId === 44 && task.largeMonsterIds.includes(116), 'deviant quest'),
    prowlerRange: sample('q1111005.arc', (task) => task.nativeFile.startsWith('q111') && task.largeMonsterIds.includes(102), 'Prowler quest range'),
  }
  const report = {
    format: 'mh-save-edit-mhgu-native-quest-audit-v1',
    counts: {
      mhguQuestFiles: gu.length,
      mhxxQuestFiles: xx.length,
      commonNativeFiles: commonFiles.length,
      commonCoreMismatches: commonCoreMismatches.length,
      physicalGuOnlyFiles: guOnlyFiles.length,
      validPhysicalGuOnlyFiles: tasks.length,
      semanticCommonAmongPhysicalGuOnly: semanticCommon,
      semanticMhguOnly: semanticGuOnly,
      dexQuestCrosswalk: dexCrosswalk.length,
      nativeMonsterMappings: NATIVE_LARGE_MONSTER_TO_DEX.size,
      nativeMonsterIdsUsedByGuOnlyTasks: usedNativeMonsterIds.size,
    },
    rules: {
      coreBytesCompared: 235,
      largeMonsterOffsets: [100, 113, 126, 139, 152],
      availability: 'All MHXX Dex tasks are XX content; signature matches are common even when the ARC is not present in the base MHXX RomFS.',
      appearanceRole: 'not inferred',
    },
    fixedSamples,
    dexCrosswalk,
    tasks,
  }
  writeJson(path.join(generatedRoot, 'mhgu-native-quest-crosswalk.json'), report)
  return report.counts
}

const gameAudits = Object.entries(games).map(([gameId, spec]) => auditGame(gameId, spec))
const questAudit = auditGuQuests()
const output = {
  format: 'mh-save-edit-monster-catalog-preflight-v1',
  status: 'pass',
  mappings: {
    source: path.relative(researchRoot, mappings.sourceFile).split(path.sep).join('/'),
    sourceSha256: fileSha256(mappings.sourceFile),
    statuses: Object.fromEntries(STATUS_NAMES),
    hiddenStatuses: sortedNumbers(HIDDEN_STATUS_IDS),
    traps: Object.fromEntries(TRAP_NAMES),
    nativeQuestTypes: Object.fromEntries(NATIVE_QUEST_TYPE_TO_DEX),
    nativeLocations: Object.fromEntries(NATIVE_LOCATION_TO_DEX),
    nativeLargeMonsters: Object.fromEntries(NATIVE_LARGE_MONSTER_TO_DEX),
  },
  games: gameAudits,
  mhguQuests: questAudit,
}
writeJson(path.join(generatedRoot, 'monster-catalog-preflight.json'), output)
console.log(JSON.stringify({ status: output.status, games: gameAudits.map(({ gameId, counts, icons }) => ({ gameId, counts, icons: { smallMissing: icons.smallMissing.length, largeMissing: icons.largeMissing.length } })), mhguQuests: questAudit }, null, 2))
