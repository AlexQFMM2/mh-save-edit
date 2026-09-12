import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const allowedFontSize = /^var\(--global-typography-font-size-(caption|small|body|title|display)\)$/
const allowedRawColorFiles = new Set([
  'ui/components/CemuLogo/CemuLogo.css',
  'ui/components/GuildBackdrop/GuildBackdrop.css',
  'ui/components/PlatformBadgeList/PlatformBadgeList.css',
  'ui/components/WeaponAttributeList/WeaponAttributeList.css',
  'ui/components/WeaponTreeCanvas/WeaponTreeCanvas.css',
  'ui/pages/HomePage/HomePage.css',
])

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? cssFiles(path) : entry.isFile() && entry.name.endsWith('.css') ? [path] : []
  })
}

describe('global design tokens', () => {
  it('defines the shared surface, border, spacing, radius, control and motion scales', () => {
    const styles = readFileSync(join(projectRoot, 'ui/styles.css'), 'utf8')
    const required = [
      '--global-theme-color-surface-table-header:',
      '--global-theme-color-surface-row-hover:',
      '--global-theme-color-surface-row-selected:',
      '--global-theme-color-border-subtle:',
      '--global-theme-color-border-row:',
      '--global-theme-color-text-weak:',
      '--global-spacing-1:',
      '--global-spacing-8:',
      '--global-state-min-height:',
      '--global-state-min-height-compact:',
      '--global-state-min-height-inline:',
      '--global-state-padding:',
      '--global-state-padding-compact:',
      '--global-state-padding-inline:',
      '--global-state-color:',
      '--global-state-error-color:',
      '--global-state-line-height:',
      '--global-radius-sm:',
      '--global-radius-pill:',
      '--global-control-height-compact:',
      '--global-control-height-tall:',
      '--global-scrollbar-size:',
      '--global-motion-fast:',
      '--global-motion-normal:',
      '--global-shadow-inset-soft:',
      '--global-shadow-inset-strong:',
      '--global-text-shadow-highlight:',
    ]
    for (const token of required) expect(styles).toContain(token)
  })

  it('keeps the application scrollbar contract in the global stylesheet', () => {
    const styles = readFileSync(join(projectRoot, 'ui/styles.css'), 'utf8')
    expect(styles).toContain('*::-webkit-scrollbar')
    expect(styles).toContain('scrollbar-color: var(--global-scrollbar-thumb) var(--global-scrollbar-track)')
    expect(styles).toContain('scrollbar-width: thin')
  })

  it('keeps exactly five global typography sizes', () => {
    const styles = readFileSync(join(projectRoot, 'ui/styles.css'), 'utf8')
    const definitions = [...styles.matchAll(/--global-typography-font-size-([a-z]+)\s*:/g)].map((match) => match[1])
    expect(definitions).toEqual(['caption', 'small', 'body', 'title', 'display'])
  })

  it('requires every page and component font size to use the global scale', () => {
    const invalid = cssFiles(join(projectRoot, 'ui'))
      .filter((path) => !path.endsWith('/styles.css'))
      .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/font-size\s*:\s*([^;}]+)/g)]
        .map((match) => ({ path: path.slice(projectRoot.length + 1), value: match[1].trim() })))
      .filter(({ value }) => !allowedFontSize.test(value))
    expect(invalid).toEqual([])
  })

  it('defines and uses the semantic data color', () => {
    const styles = readFileSync(join(projectRoot, 'ui/styles.css'), 'utf8')
    expect(styles).toContain('--global-theme-color-data:')
    const usageCount = cssFiles(join(projectRoot, 'ui/components'))
      .reduce((count, path) => count + (readFileSync(path, 'utf8').match(/var\(--global-theme-color-data\)/g)?.length ?? 0), 0)
    expect(usageCount).toBeGreaterThan(10)
  })

  it('keeps raw component colors limited to the registered visual exceptions', () => {
    const rawColor = /(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/
    const rawFiles = cssFiles(join(projectRoot, 'ui'))
      .filter((path) => !path.endsWith('/styles.css'))
      .filter((path) => rawColor.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(projectRoot.length + 1))
      .sort()
    expect(rawFiles).toEqual([...allowedRawColorFiles].sort())
  })

  it('uses the shared state contract for core list and detail states', () => {
    const stateFiles = [
      'ui/components/ItemList/ItemList.css',
      'ui/components/WeaponList/WeaponList.css',
      'ui/components/ArmorList/ArmorList.css',
      'ui/components/DecorationList/DecorationList.css',
      'ui/components/HunterArtList/HunterArtList.css',
      'ui/components/QuestList/QuestList.css',
      'ui/components/MonsterSearchList/MonsterSearchList.css',
      'ui/components/PalicoEntryList/PalicoEntryList.css',
      'ui/components/WeaponMotionTable/WeaponMotionTable.css',
      'ui/components/ArmorDetailPanel/ArmorDetailPanel.css',
      'ui/components/DecorationDetailPanel/DecorationDetailPanel.css',
      'ui/components/ItemDetailPanel/ItemDetailPanel.css',
      'ui/components/MonsterDetailPanel/MonsterDetailPanel.css',
      'ui/components/QuestDetailPanel/QuestDetailPanel.css',
      'ui/components/SkillDetailPanel/SkillDetailPanel.css',
      'ui/components/WeaponDetailPanel/WeaponDetailPanel.css',
      'ui/components/PalicoEquipmentDetailPanel/PalicoEquipmentDetailPanel.css',
      'ui/components/PalicoAbilityDetailPanel/PalicoAbilityDetailPanel.css',
      'ui/components/PalicoTypeDetailPanel/PalicoTypeDetailPanel.css',
      'ui/components/AutoLoadoutHistoryDrawer/AutoLoadoutHistoryDrawer.css',
      'ui/components/EquipmentPickerContent/EquipmentPickerContent.css',
      'ui/components/DecorationMaterialList/DecorationMaterialList.css',
      'ui/components/SkillComponentList/SkillComponentList.css',
      'ui/components/QuestRewardsSection/QuestRewardsSection.css',
      'ui/components/QuestUnlockSection/QuestUnlockSection.css',
      'ui/components/LoadoutLegalitySummary/LoadoutLegalitySummary.css',
      'ui/components/SaveEnvironmentPicker/SaveEnvironmentPicker.css',
      'ui/components/CatalogWriteControl/CatalogWriteControl.css',
      'ui/components/SaveEquipmentEmbeddedDetail/SaveEquipmentEmbeddedDetail.css',
      'ui/components/DecorationSkillSection/DecorationSkillSection.css',
      'ui/components/LoadoutStatsPanel/LoadoutStatsPanel.css',
      'ui/components/LoadoutSkillMatrix/LoadoutSkillMatrix.css',
      'ui/components/SearchableSelect/SearchableSelect.css',
      'ui/components/AutoLoadoutDrawer/AutoLoadoutDrawer.css',
    ]
    for (const relativePath of stateFiles) {
      const styles = readFileSync(join(projectRoot, relativePath), 'utf8')
      expect(styles, relativePath).toContain('var(--global-state-')
    }
  })

  it('keeps transition durations on the shared motion scale', () => {
    const rawDuration = /transition\s*:[^;}]*(?:\d+ms|\d+(?:\.\d+)?s)/
    const invalid = cssFiles(join(projectRoot, 'ui'))
      .filter((path) => !path.endsWith('/styles.css'))
      .filter((path) => rawDuration.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(projectRoot.length + 1))
      .sort()
    expect(invalid).toEqual([])
  })
})
