import { createHash } from 'node:crypto'

// Explicit crosswalk for the reviewed appraisal path. Reference source numbers
// are HTML column identities, NOT native group indices or final talisman IDs.
export const MH4G_APPRAISAL_GROUPS = [
  { sourceItemId: 36, classes: [[1, 0, 8], [2, 8, null]], aSource: 1, bSource: null, counts: [57, 0], attempt: 0 },
  { sourceItemId: 37, classes: [[3, 0, 8], [4, 8, null]], aSource: 2, bSource: 1, counts: [59, 60], attempt: 65 },
  { sourceItemId: 38, classes: [[5, 0, 8], [6, 8, 13], [7, 13, null]], aSource: 3, bSource: 2, counts: [38, 56], attempt: 75 },
  { sourceItemId: 39, classes: [[8, 0, 16], [9, 16, null]], aSource: 4, bSource: 3, counts: [55, 76], attempt: 80 },
  { sourceItemId: 1648, classes: [[10, 0, 8], [11, 8, 13], [12, 13, null]], aSource: 5, bSource: 4, counts: [58, 75], attempt: 85 },
  { sourceItemId: 1649, classes: [[13, 0, 16], [14, 16, null]], aSource: 6, bSource: 5, counts: [41, 58], attempt: 75 },
]
export const MH4G_CODE_SHA256 = 'd94ec346cc265fa971101a29193ab377103ed0b677b1d309a5f847019d765604'
export const MH4G_EXPANDED_SHA256 = 'b3cf0ad1f9abca6cd007f5bb5d560b9302576f457bee9baaf2cdf12c0ce8156a'
export const MH4G_REFERENCE_SOURCE = 'mh4g_talisman_legality.html:03f020c1e109b07dc1aeecfe43bb4e4b65fedb0302afc2d0224aef3c5f941367'
export const sha256 = value => createHash('sha256').update(value).digest('hex')
const requireValue = (condition, message) => { if (!condition) throw new Error(`MH4G charm native: ${message}`) }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function validateMh4gNativeInput(input) {
  requireValue(input?.format === 'mh4g-charm-native-v1' && input.gameId === 'mh4g' && input.algorithm === 'appraisal-f32-v1', 'unsupported format')
  requireValue(input.source?.codeSha256 === MH4G_CODE_SHA256 && input.source?.expandedSha256 === MH4G_EXPANDED_SHA256, 'unreviewed executable identity')
  requireValue(input.evidence?.kind === 'native-static' && input.evidence.scope === 'reviewed-appraisal-path', 'unsupported evidence scope')
  requireValue(same(input.evidence.limitations, ['other-acquisition-paths', 'rng-reachability', 'fpscr-runtime-state']), 'evidence limitations must not be removed')
  requireValue(Array.isArray(input.groups) && input.groups.length === 6, 'six groups required')
  input.groups.forEach((group, index) => {
    const spec = MH4G_APPRAISAL_GROUPS[index]
    requireValue(group.groupIndex === index && group.sourceItemId === spec.sourceItemId, 'invalid source crosswalk')
    requireValue(same(group.classes, spec.classes.map(([classId, minScore, maxScore]) => ({ classId, minScore, maxScore }))), 'invalid class bands')
    requireValue(group.secondSkillAttemptPercent === spec.attempt, 'invalid B attempt rate')
    for (const [position, count] of [['A', spec.counts[0]], ['B', spec.counts[1]]]) {
      const pool = group.pools?.[position]
      requireValue(Array.isArray(pool?.rows) && pool.rows.length === count, `invalid ${position} pool length`)
      const ids = new Set()
      const bytes = Buffer.alloc(count * 4)
      pool.rows.forEach((row, i) => {
        requireValue(Array.isArray(row) && row.length === 3 && row.every(Number.isInteger), 'non-integer skill range')
        const [id, min, max] = row
        requireValue(id > 0 && id <= 255 && !ids.has(id) && min >= -128 && min <= max && max > 0 && max <= 127 && (position !== 'A' || min > 0), 'invalid skill range')
        ids.add(id)
        bytes[i * 4] = id; bytes[i * 4 + 1] = 1
        bytes.writeInt8(min, i * 4 + 2); bytes.writeInt8(max, i * 4 + 3)
      })
      requireValue(pool.sha256 === sha256(bytes), 'skill pool digest mismatch')
    }
    requireValue(Array.isArray(group.slotWeights) && group.slotWeights.length === 21, 'invalid slot row count')
    for (const row of group.slotWeights) requireValue(Array.isArray(row) && row.length === 4 && row.every(value => Number.isInteger(value) && value >= 0 && value <= 100) && row.reduce((a, b) => a + b, 0) === 100, 'invalid slot weights')
    requireValue(group.slotSha256 === sha256(Buffer.from(group.slotWeights.flat())), 'slot digest mismatch')
  })
  return input
}

export function readStoredMh4gNative(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_mh4g_charm_native'").get()) return null
  const row = db.prepare('SELECT payload_json,payload_sha256 FROM catalog_mh4g_charm_native WHERE id=1').get()
  if (!row) return null
  requireValue(sha256(row.payload_json) === row.payload_sha256, 'stored payload digest mismatch')
  return validateMh4gNativeInput(JSON.parse(row.payload_json))
}

export function mh4gTalismanRows(db, skills, native = readStoredMh4gNative(db)) {
  if (native) validateMh4gNativeInput(native)
  const valid = new Set(skills.map(row => row.skill_id))
  const classes = new Map(db.prepare('SELECT save_id,name_cn,name_en FROM charm_classes WHERE save_id>0').all().map(row => [row.save_id, row]))
  const references = native ? [] : db.prepare('SELECT skill_tree_id,position,charm_source,min_points,max_points,source FROM charm_skill_ranges').all()
  if (!native) requireValue(references.every(row => row.source === MH4G_REFERENCE_SOURCE), 'unreviewed reference snapshot; explicit crosswalk review required')
  const result = []
  for (const [index, spec] of MH4G_APPRAISAL_GROUPS.entries()) {
    for (const [position, column] of [['A', spec.aSource], ['B', spec.bSource]]) {
      const ranges = native ? native.groups[index].pools[position].rows : references.filter(row => row.position === (position === 'A' ? 1 : 2) && column != null && row.charm_source === column).map(row => [row.skill_tree_id, row.min_points, row.max_points])
      for (const [classId] of spec.classes) {
        const cls = classes.get(classId)
        requireValue(Boolean(cls), `missing class ${classId}`)
        for (const [skillId, min, max] of ranges) {
          requireValue(valid.has(skillId), `missing skill ${skillId}`)
          if (min === 0 && max === 0) continue
          // Source-pool bounds are not a guarantee for every final class/slot combination.
          const source = native ? `mh4g-native-appraisal:${native.source.expandedSha256}:item=${spec.sourceItemId}` : `${MH4G_REFERENCE_SOURCE}+native-reviewed-source-crosswalk:item=${spec.sourceItemId}`
          result.push({ key: `${classId}:${position}:${skillId}:${min}:${max}`, skillId, talismanId: classId, nameCn: cls.name_cn, nameEn: cls.name_en, position, slotCount: null, min, max, maxSlots: Math.min(3, index + 1), status: 'rule', source })
        }
      }
    }
  }
  return result
}

export function replaceMh4gTalismanRanges(db, rows) {
  db.prepare("DELETE FROM catalog_skill_talisman_ranges WHERE game_id='mh4g'").run()
  const insert = db.prepare(`INSERT INTO catalog_skill_talisman_ranges(game_id,range_key,skill_id,talisman_id,talisman_name_cn,talisman_name_en,position,slot_count,min_points,max_points,max_slots,range_status,source) VALUES('mh4g',?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const row of rows) insert.run(row.key, row.skillId, row.talismanId, row.nameCn, row.nameEn, row.position, row.slotCount, row.min, row.max, row.maxSlots, row.status, row.source)
}
