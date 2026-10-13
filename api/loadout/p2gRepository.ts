import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { P2gArmorCatalogRepository } from '../catalog/p2gArmorRepository'
import { P2gWeaponCatalogRepository } from '../catalog/p2gWeaponRepository'
import { P2gDecorationCatalogRepository } from '../catalog/p2gDecorationRepository'
import { P2gSkillCatalogRepository } from '../catalog/p2gSkillRepository'
import { p2gArmorCandidate, p2gWeaponCandidate } from './p2gCandidates'
import type { LoadoutArmorFilters, LoadoutCalculationSnapshot, LoadoutCatalogSnapshot, LoadoutDecoration, LoadoutDecorationFilters, LoadoutFacets, LoadoutPage, LoadoutWeaponFilters } from './types'

function collect<T>(read: (page: number) => LoadoutPage<T>): T[] {
  const result: T[] = []
  for (let page = 1; ; page++) {
    const next = read(page)
    result.push(...next.items)
    if (!next.hasNext) return result
  }
}

/** Adapts the installed native catalogs; no second equipment database or save IDs. */
export class P2gLoadoutCatalogRepository {
  private readonly weapons: P2gWeaponCatalogRepository
  private readonly armors: P2gArmorCatalogRepository
  private readonly decorations: P2gDecorationCatalogRepository
  private readonly skills: P2gSkillCatalogRepository
  private bootstrap?: LoadoutCalculationSnapshot
  private snapshot?: LoadoutCatalogSnapshot

  constructor(private readonly db: Database.Database) {
    this.weapons = new P2gWeaponCatalogRepository(db)
    this.armors = new P2gArmorCatalogRepository(db)
    this.decorations = new P2gDecorationCatalogRepository(db)
    this.skills = new P2gSkillCatalogRepository(db)
  }

  getBootstrap(): LoadoutCalculationSnapshot {
    if (this.bootstrap) return this.bootstrap
    const sources = this.db.prepare("SELECT domain,source_sha256,builder_sha256 FROM catalog_build_metadata WHERE game_id='mhp2g' ORDER BY domain").all()
    const skills = (this.db.prepare('SELECT skill_id FROM p2g_skills ORDER BY skill_id').all() as { skill_id: number }[]).map(({ skill_id }) => {
      const s = this.skills.getSkill(skill_id)!
      return {
        skillId: s.skillId, nameCn: s.nameCn, nameEn: s.nameEn, nameJp: s.nameJp ?? '',
        specialRule: s.p2g?.specialRule?.descriptionCn,
        activations: s.activations.map(a => ({ activationKey: a.activationKey, skillId: s.skillId, nameCn: a.nameCn, nameJp: a.nameJp ?? '', threshold: a.threshold, direction: a.direction, description: a.wikiDetail?.descriptionCn, components: a.components?.map(c => { if (c.skillId == null) throw new Error('复合技能缺少系统身份'); return { activationKey: c.activationKey, skillId: c.skillId, nameCn: c.nameCn } }) })),
      }
    })
    return this.bootstrap = {
      gameId: 'mhp2g', dataVersion: createHash('sha256').update('p2g-loadout-v1:').update(JSON.stringify(sources)).digest('hex').slice(0, 16),
      decorations: collect(page => this.searchDecorations({ gameId: 'mhp2g', page, pageSize: 100 })), skills,
      charmClasses: [], charmRanges: [], relicLookups: [],
    }
  }

  getSnapshot(): LoadoutCatalogSnapshot {
    return this.snapshot ??= {
      ...this.getBootstrap(), weapons: collect(page => this.searchWeapons({ gameId: 'mhp2g', page, pageSize: 100 })),
      armors: (['head', 'chest', 'arms', 'waist', 'legs'] as const).flatMap(part => collect(page => this.searchArmors({ gameId: 'mhp2g', part, page, pageSize: 100 }))),
    }
  }

  getFacets(): LoadoutFacets {
    const w = this.weapons.getWeaponFacets(), a = this.armors.getArmorFacets()
    return { skills: this.getBootstrap().skills.map(({ skillId, nameCn, nameEn, nameJp }) => ({ skillId, nameCn, nameEn, nameJp })), weaponTypes: w.weaponTypes, weaponRarities: w.rarities, armorRarities: a.rarities, charmClasses: [] }
  }

  searchWeapons(f: LoadoutWeaponFilters) {
    this.checkFilters(f)
    const page = this.weapons.searchWeapons({ gameId: 'mhp2g', query: f.query, weaponTypeId: f.typeId, rarity: f.rarity, slots: f.slots, directlyProducible: f.directlyProducible, finalOnly: f.finalOnly, sort: !f.sort || f.sort === 'source' ? 'nativeId' : f.sort, direction: !f.sort || f.sort === 'source' ? 'asc' : 'desc', page: f.page, pageSize: f.pageSize })
    return { ...page, items: page.items.map(p2gWeaponCandidate) }
  }

  searchArmors(f: LoadoutArmorFilters) {
    this.checkFilters(f)
    const page = this.armors.searchArmors({ gameId: 'mhp2g', part: f.part, query: f.query, skillId: f.skillId, rarity: f.rarity, slots: f.slots, combat: f.combat, gender: f.gender, sort: f.sort === 'defense' ? 'maxDefense' : f.sort === 'skill' ? 'skillPoints' : !f.sort || f.sort === 'source' ? 'nativeId' : f.sort, direction: !f.sort || f.sort === 'source' ? 'asc' : 'desc', page: f.page, pageSize: f.pageSize })
    return { ...page, items: page.items.map(p2gArmorCandidate) }
  }

  searchDecorations(f: LoadoutDecorationFilters): LoadoutPage<LoadoutDecoration> {
    if (f.gameId !== 'mhp2g') throw new Error('装饰品游戏版本不一致')
    const page = this.decorations.searchDecorations(f)
    return { ...page, items: page.items.map(d => {
      if (d.gameId !== 'mhp2g') throw new Error('装饰品身份不属于 P2G')
      return { gameId: 'mhp2g', itemId: d.itemId, nameCn: d.nameCn, nameJp: d.nameJp ?? '', iconPath: d.iconPath, slots: d.slots, skills: d.skills.map(({ skillId, nameCn, points }) => ({ skillId, nameCn, points })) }
    }) }
  }

  getRelicLookups(): [] { return [] }
  validateCharm(): never { throw new Error('P2G 没有护石') }

  private checkFilters(f: LoadoutWeaponFilters | LoadoutArmorFilters) {
    if (f.gameId !== 'mhp2g' || f.saveId != null || f.saveType != null || f.sourceKind === 'relicTemplate') throw new Error('P2G 配装使用原生图鉴身份，不支持存档编号或发掘模板')
  }
}
