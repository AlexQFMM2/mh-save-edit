import { applyCharmValidation } from '../../api/loadout/charm'
import { ARMOR_LOADOUT_SLOTS, createEmptyLogicalLoadout, type AutoLoadoutTarget, type LoadoutCatalogSnapshot } from '../../api/loadout/types'

// User-provided regression identifiers only; all game records come from the
// caller's private catalog. No extracted game tables are embedded here.
export const GU_SAMPLE_TOTALS = [['达人', 20], ['匠', 15], ['锋利度', 11], ['痛击', 10], ['会心强化', 10]] as const
const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`GU five-skill fixture missing ${label}`)
  return value
}

export function guFiveSkillFixture(snapshot: LoadoutCatalogSnapshot) {
  const loadout = createEmptyLogicalLoadout('mhgu', snapshot.dataVersion)
  const weapon = required(snapshot.weapons.find(row => row.weaponKey === '10:1:0' && row.sourceKind === 'catalog'), 'Bherna Lance Lv.1')
  if (weapon.slots !== 0) throw new Error('GU fixture must use a zero-slot weapon')
  loadout.weapon = { ...weapon, decorations: [], lock: 'equipment' }
  const jewel = (name: string) => required(snapshot.decorations.find(row => row.nameCn.normalize('NFKC') === name), name)
  const armorIds = [4940, 4027, 4942, 4029, 4944]
  const jewels = ['会心珠【3】', '会心珠【1】', '痛击珠【3】', '会心珠【1】', '会心珠【3】']
  ARMOR_LOADOUT_SLOTS.forEach((part, i) => {
    const armor = required(snapshot.armors.find(row => row.part === part && row.dexId === armorIds[i] && row.sourceKind === 'catalog'), `armor ${armorIds[i]}`)
    loadout.armor[part] = { ...armor, decorations: [jewel(jewels[i])], lock: 'unlocked' }
  })
  const skill = (name: string) => required(snapshot.skills.find(row => row.nameCn === name), name)
  const cls = required(snapshot.charmClasses.find(row => row.nameCn === '天之护石'), '天之护石')
  loadout.charm = applyCharmValidation(snapshot, {
    kind: 'charm', gameId: 'mhgu', classId: cls.classId, classNameCn: cls.nameCn, iconPath: cls.iconPath, slots: 3,
    skill1: { skillId: skill('痛击').skillId, nameCn: '痛击', points: 6 },
    skill2: { skillId: skill('达人').skillId, nameCn: '达人', points: 10 },
    decorations: [jewel('达人珠【2】')], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'unlocked' as const,
  })
  // Select actual UI activation thresholds. The screenshot's Sharpness 11 is
  // an achieved total, not necessarily the activation threshold of Razor Sharp.
  const targets: AutoLoadoutTarget[] = GU_SAMPLE_TOTALS.map(([name, total]) => {
    const definition = skill(name)
    const activation = required(definition.activations.filter(row => row.direction === 'positive' && row.threshold <= total).sort((a, b) => b.threshold - a.threshold)[0], `${name} activation`)
    return { activationKey: activation.activationKey, skillId: definition.skillId, threshold: activation.threshold, nameCn: activation.nameCn }
  })
  const strictTargets = targets.map((target, i) => ({ ...target, threshold: GU_SAMPLE_TOTALS[i][1] }))
  return { loadout, targets, strictTargets }
}
