import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { P3ArmorCatalogRepository } from '../catalog/p3ArmorRepository'
import { P3DecorationCatalogRepository } from '../catalog/p3DecorationRepository'
import { P3ItemCatalogRepository } from '../catalog/p3ItemRepository'
import { P3SkillCatalogRepository } from '../catalog/p3SkillRepository'
import { P3WeaponCatalogRepository } from '../catalog/p3WeaponRepository'
import { p3ArmorCandidate, p3WeaponCandidate } from './p3Candidates'
import { checkP3Charm, P3_CHARM_RANK_MAX, P3_CHARM_RANK_SCALE, type P3CharmGradeRule, type P3CharmRules, type P3CharmSlotRow } from './p3CharmRules'
import type {
  CharmValidationResult, LoadoutArmorFilters, LoadoutCalculationSnapshot, LoadoutCatalogSnapshot, LoadoutCharm,
  LoadoutCharmClass, LoadoutCharmRange, LoadoutDecoration, LoadoutDecorationFilters, LoadoutFacets, LoadoutPage,
  LoadoutSkillDefinition, LoadoutWeaponFilters,
} from './types'

function collect<T>(read: (page: number) => LoadoutPage<T>): T[] {
  const result: T[] = []
  for (let page = 1; ; page++) {
    const next = read(page)
    result.push(...next.items)
    if (!next.hasNext) return result
  }
}

const DATA_KEYS = ['data_version', 'catalog_schema', 'skill_schema', 'charm_generation_schema', 'charm_generation_data_version', 'armor_schema', 'weapon_schema']

/** Read-only adapter for the installed P3 content library; no second data store. */
export class P3LoadoutCatalogRepository {
  private readonly weapons: P3WeaponCatalogRepository
  private readonly armors: P3ArmorCatalogRepository
  private readonly decorations: P3DecorationCatalogRepository
  private readonly skills: P3SkillCatalogRepository
  private bootstrap?: LoadoutCalculationSnapshot
  private snapshot?: LoadoutCatalogSnapshot

  constructor(private readonly db: Database.Database) {
    const meta = Object.fromEntries((db.prepare('SELECT key,value FROM meta').all() as { key: string; value: string }[]).map(row => [row.key, row.value]))
    if (meta.charm_generation_schema !== 'mhp3-charm-generation-v1') throw new Error('P3 配装资料缺少护石生成规则，请安装新版 P3 资料')
    const items = new P3ItemCatalogRepository(db)
    this.decorations = new P3DecorationCatalogRepository(db, items)
    this.skills = new P3SkillCatalogRepository(db, this.decorations)
    this.weapons = new P3WeaponCatalogRepository(db)
    this.armors = new P3ArmorCatalogRepository(db)
  }

  private charmRules(): P3CharmRules {
    const sources = (this.db.prepare('SELECT * FROM p3_charm_generation_sources ORDER BY item_id').all() as {
      source_key: string; item_id: number; label_jp: string; skill1_pool: string; skill2_pool: string | null
      second_skill_threshold: number; slot_table_key: string; evidence: string
    }[]).map(row => ({ sourceKey: row.source_key, itemId: row.item_id, labelJp: row.label_jp, skill1Pool: row.skill1_pool, skill2Pool: row.skill2_pool, secondSkillThreshold: row.second_skill_threshold, slotTableKey: row.slot_table_key, evidence: row.evidence }))
    const slotTables: Record<string, P3CharmSlotRow[]> = {}
    for (const row of this.db.prepare('SELECT source_key,rank,slot,cumulative,width FROM p3_charm_slot_tables ORDER BY source_key,rank,slot').all() as {
      source_key: string; rank: number; slot: number; cumulative: number; width: number
    }[]) (slotTables[row.source_key] ??= []).push({ rank: row.rank, slot: row.slot, cumulative: row.cumulative, width: row.width })
    const grades: P3CharmGradeRule[] = (this.db.prepare('SELECT source_key,grade,min_f,max_f,name_cn,name_jp FROM p3_charm_grade_rules ORDER BY grade').all() as {
      source_key: string; grade: number; min_f: number; max_f: number; name_cn: string; name_jp: string
    }[]).map(row => ({ sourceKey: row.source_key, grade: row.grade, minF: row.min_f, maxF: row.max_f, nameCn: row.name_cn, nameJp: row.name_jp }))
    const pools: P3CharmRules['pools'] = {}
    for (const row of this.db.prepare("SELECT source_key,skill_id,detail_json FROM p3_skill_charm_sources WHERE source_key LIKE 'mhp3:pool:%' ORDER BY source_key").all() as {
      source_key: string; skill_id: number; detail_json: string
    }[]) {
      const detail = JSON.parse(row.detail_json) as { position: 'A' | 'B'; label: string; minPoints: number; maxPoints: number }
      const poolKey = row.source_key.split(':')[2]
      const pool = pools[poolKey] ??= { poolKey, position: detail.position, label: detail.label, rows: [] }
      pool.rows.push({ skillId: row.skill_id, min: detail.minPoints, max: detail.maxPoints })
    }
    for (const pool of Object.values(pools)) pool.rows.sort((a, b) => a.skillId - b.skillId)
    return { sources, slotTables, grades, pools, rankScale: P3_CHARM_RANK_SCALE, rankMax: P3_CHARM_RANK_MAX }
  }

  private charmClasses(rules: P3CharmRules): LoadoutCharmClass[] {
    return rules.grades.map(rule => ({ classId: rule.grade, nameCn: rule.nameCn, nameEn: '', maxSlots: 3, iconPath: null }))
  }

  private charmRanges(rules: P3CharmRules): LoadoutCharmRange[] {
    const ranges: LoadoutCharmRange[] = []
    for (const source of rules.sources) {
      const grades = rules.grades.filter(rule => rule.sourceKey === source.sourceKey)
      for (const [position, poolKey] of [['A', source.skill1Pool], ['B', source.skill2Pool]] as const) {
        if (!poolKey) continue
        for (const row of rules.pools[poolKey]?.rows ?? []) {
          for (const grade of grades) {
            ranges.push({ rangeKey: `mhp3:${source.sourceKey}:${position}:${row.skillId}`, classId: grade.grade, skillId: row.skillId,
              position, minPoints: row.min, maxPoints: row.max, slotCount: null, maxSlots: 3, status: 'rule', source: `${source.sourceKey}:${poolKey}` })
          }
        }
      }
    }
    return ranges
  }

  getBootstrap(): LoadoutCalculationSnapshot {
    if (this.bootstrap) return this.bootstrap
    const meta = Object.fromEntries((this.db.prepare('SELECT key,value FROM meta').all() as { key: string; value: string }[]).map(row => [row.key, row.value]))
    if (!meta.data_version) throw new Error('P3 内容库缺少数据版本')
    const dataVersion = createHash('sha256').update('p3-loadout-v1:').update(JSON.stringify(DATA_KEYS.map(key => [key, meta[key] ?? null]))).digest('hex').slice(0, 16)
    const rules = this.charmRules()
    const skills = (this.db.prepare('SELECT skill_id FROM p3_skills ORDER BY skill_id').all() as { skill_id: number }[]).map(({ skill_id: skillId }): LoadoutSkillDefinition => {
      const skill = this.skills.getSkill(skillId)
      if (!skill) throw new Error(`P3 技能资料缺失：${skillId}`)
      return {
        skillId: skill.skillId, nameCn: skill.nameCn, nameEn: skill.nameEn ?? '', nameJp: skill.nameJp ?? '',
        specialRule: skill.specialRule?.descriptionCn,
        activations: skill.activations.map(activation => ({
          activationKey: activation.activationKey, skillId: skill.skillId, threshold: activation.threshold,
          direction: activation.direction, nameCn: activation.nameCn, nameJp: activation.nameJp,
          description: activation.descriptionCn,
          components: activation.components.map(component => ({ activationKey: component.activationKey, skillId: component.skillId ?? skill.skillId, nameCn: component.nameCn })),
        })),
      }
    })
    return this.bootstrap = {
      gameId: 'mhp3', dataVersion,
      decorations: collect(page => this.searchDecorations({ gameId: 'mhp3', page, pageSize: 100 })),
      skills,
      charmClasses: this.charmClasses(rules),
      charmRanges: this.charmRanges(rules),
      charmSlotRules: [],
      relicLookups: [],
      p3CharmRules: rules,
    }
  }

  getSnapshot(): LoadoutCatalogSnapshot {
    return this.snapshot ??= {
      ...this.getBootstrap(),
      weapons: collect(page => this.searchWeapons({ gameId: 'mhp3', page, pageSize: 100 })),
      armors: (['head', 'chest', 'arms', 'waist', 'legs'] as const).flatMap(part => collect(page => this.searchArmors({ gameId: 'mhp3', part, page, pageSize: 100 }))),
    }
  }

  getFacets(): LoadoutFacets {
    const weapons = this.weapons.getWeaponFacets(), armors = this.armors.getArmorFacets()
    return {
      skills: this.getBootstrap().skills.map(({ skillId, nameCn, nameEn, nameJp }) => ({ skillId, nameCn, nameEn, nameJp })),
      weaponTypes: weapons.weaponTypes.map(type => ({ typeId: type.typeId, nameCn: type.nameCn })),
      weaponRarities: weapons.rarities, armorRarities: armors.rarities, charmClasses: this.getBootstrap().charmClasses,
    }
  }

  searchWeapons(filters: LoadoutWeaponFilters): LoadoutPage<import('./types').LoadoutWeaponCandidate> {
    this.checkFilters(filters)
    const page = this.weapons.searchWeapons({
      gameId: 'mhp3', query: filters.query, weaponTypeId: filters.typeId, rarity: filters.rarity, slots: filters.slots,
      directlyProducible: filters.directlyProducible, finalOnly: filters.finalOnly,
      sort: !filters.sort || filters.sort === 'source' ? 'nativeId' : filters.sort,
      direction: !filters.sort || filters.sort === 'source' ? 'asc' : 'desc',
      page: filters.page, pageSize: filters.pageSize,
    })
    return { ...page, items: page.items.map(p3WeaponCandidate) }
  }

  searchArmors(filters: LoadoutArmorFilters): LoadoutPage<import('./types').LoadoutArmorCandidate> {
    this.checkFilters(filters)
    const sort = filters.sort === 'defense' ? 'maxDefense' : filters.sort === 'skill' ? 'skillPoints' : !filters.sort || filters.sort === 'source' ? 'nativeId' : filters.sort
    const page = this.armors.searchArmors({
      gameId: 'mhp3', part: filters.part, query: filters.query, skillId: filters.skillId, rarity: filters.rarity,
      slots: filters.slots, combat: filters.combat, gender: filters.gender, sort,
      direction: !filters.sort || filters.sort === 'source' ? 'asc' : 'desc', page: filters.page, pageSize: filters.pageSize,
    })
    return { ...page, items: page.items.map(p3ArmorCandidate) }
  }

  searchDecorations(filters: LoadoutDecorationFilters): LoadoutPage<LoadoutDecoration> {
    if (filters.gameId !== 'mhp3') throw new Error('装饰品游戏版本不一致')
    const page = this.decorations.searchDecorations({ gameId: 'mhp3', query: filters.query, skillId: filters.skillId, page: filters.page, pageSize: filters.pageSize })
    return {
      ...page,
      items: page.items.map(decoration => ({
        gameId: 'mhp3', itemId: decoration.itemId as number, nameCn: decoration.nameCn, nameJp: decoration.nameJp ?? '',
        iconPath: decoration.iconPath, slots: decoration.slots,
        skills: decoration.skills.map(skill => ({ skillId: skill.skillId, nameCn: skill.nameCn, points: skill.points })),
      })),
    }
  }

  getRelicLookups(): [] { return [] }

  validateCharm(charm: LoadoutCharm): CharmValidationResult {
    if (charm.gameId !== 'mhp3') throw new Error('护石游戏版本不一致')
    const rules = this.getBootstrap().p3CharmRules!
    const check = checkP3Charm(rules, charm)
    const ranges = [charm.skill1, charm.skill2].flatMap((skill, index) => skill
      ? this.getBootstrap().charmRanges.filter(range => range.classId === charm.classId && range.skillId === skill.skillId && range.position === (index === 0 ? 'A' : 'B'))
        .map(range => ({ position: range.position, min: range.minPoints, max: range.maxPoints, source: range.source }))
      : [])
    return { legality: check.legality, encoding: check.encoding, issues: check.issues, ranges }
  }

  private checkFilters(filters: LoadoutWeaponFilters | LoadoutArmorFilters) {
    if (filters.gameId !== 'mhp3' || filters.saveId != null || filters.saveType != null || (filters.sourceKind && filters.sourceKind !== 'all' && filters.sourceKind !== 'catalog')) {
      throw new Error('P3 配装使用原生图鉴身份，不支持存档编号或发掘模板')
    }
  }
}
