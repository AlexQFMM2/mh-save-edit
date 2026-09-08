import fs from 'node:fs'
import path from 'node:path'

const MAPPINGS_RELATIVE_PATH = 'mhgu/crosswalks/monster-catalog-mappings.json'

function numberMap(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid monster mapping: ${label}`)
  return new Map(Object.entries(value).map(([key, entry]) => {
    const numericKey = Number.parseInt(key, 10)
    if (!Number.isInteger(numericKey)) throw new Error(`Invalid monster mapping key in ${label}: ${key}`)
    return [numericKey, entry]
  }))
}

export function loadMonsterMappings(researchRoot) {
  const file = path.join(researchRoot, MAPPINGS_RELATIVE_PATH)
  if (!fs.existsSync(file)) throw new Error(`Missing private monster mapping input: ${file}`)
  const input = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (input.format !== 'mh-save-edit-monster-mappings-v1') throw new Error(`Unsupported monster mapping format: ${input.format}`)
  if (!Array.isArray(input.hiddenStatusIds) || input.hiddenStatusIds.some((id) => !Number.isInteger(id))) {
    throw new Error('Invalid monster mapping: hiddenStatusIds')
  }
  return {
    sourceFile: file,
    statusNames: numberMap(input.statuses, 'statuses'),
    hiddenStatusIds: new Set(input.hiddenStatusIds),
    trapNames: numberMap(input.traps, 'traps'),
    nativeQuestTypes: numberMap(input.nativeQuestTypes, 'nativeQuestTypes'),
    nativeLocations: numberMap(input.nativeLocations, 'nativeLocations'),
    nativeLargeMonsters: numberMap(input.nativeLargeMonsters, 'nativeLargeMonsters'),
  }
}

export function dlcLevelId(nativeStar) {
  if (nativeStar >= 1 && nativeStar <= 7) return 34 + nativeStar
  if (nativeStar >= 11 && nativeStar <= 14) return 31 + nativeStar
  return null
}
