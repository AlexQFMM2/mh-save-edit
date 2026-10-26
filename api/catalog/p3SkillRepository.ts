import type Database from 'better-sqlite3'
import type { P3DecorationCatalogRepository } from './p3DecorationRepository'
import type { P3SkillArmorDetail, P3SkillArmorRelation, P3SkillCharmSource, P3SkillPoint } from './p3SkillTypes'
import type { DecorationSummary, PageResult, SkillCatalogFacets, SkillCatalogFilters, SkillDecorationRelation, SkillDetail, SkillSummary } from './types'
import { p3SkillArmorIdentitySchema, skillCatalogFiltersSchema, skillIdentitySchema } from './schemas'

type StoredSkill = Pick<SkillDetail, 'skillId' | 'nameCn' | 'nameEn' | 'nameJp' | 'descriptionCn' | 'descriptionJp' | 'descriptionEn' | 'activations' | 'specialRule'> & { aliases: string[] }
type StoredArmor = Omit<P3SkillArmorDetail, 'skills'> & { skills: P3SkillPoint[] }
type Hit = { text: string; label: string }
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
const decode = <T,>(rows: unknown[]): T[] => (rows as { detail_json: string }[]).map(r => JSON.parse(r.detail_json) as T)

/** Only this adapter owns the P3 native skill domain; no save identities are synthesized. */
export class P3SkillCatalogRepository {
  private readonly skills: Map<number, StoredSkill>
  private readonly armors: Map<string, StoredArmor>
  private readonly details = new Map<number, SkillDetail>()
  private readonly hits = new Map<number, Hit[]>()

  constructor(db: Database.Database, decorations: P3DecorationCatalogRepository) {
    if (!(db.prepare("SELECT value FROM meta WHERE key='skill_schema' AND value='mhp3-skills-v1'").get())) {
      throw new Error('P3 技能资料尚未安装，请构建并安装技能资料后重启应用；道具和装饰品图鉴仍可使用。')
    }
    const aliases = new Map((db.prepare('SELECT item_id,aliases_json FROM catalog_items').all() as {item_id:number;aliases_json:string}[]).map(r => [r.item_id, JSON.parse(r.aliases_json) as string[]]))
    this.skills = new Map(decode<StoredSkill>(db.prepare('SELECT detail_json FROM p3_skills ORDER BY skill_id').all()).map(s => [s.skillId, s]))
    this.armors = new Map(decode<StoredArmor>(db.prepare('SELECT detail_json FROM p3_skill_armors ORDER BY armor_key').all()).map(a => [a.armorKey, a]))
    const charms = decode<P3SkillCharmSource>(db.prepare('SELECT detail_json FROM p3_skill_charm_sources ORDER BY source_key').all())
    const jewels: DecorationSummary[] = []
    for (let page = 1; ; page++) {
      const result = decorations.searchDecorations({ gameId: 'mhp3', page, pageSize: 100 })
      jewels.push(...result.items)
      if (!result.hasNext) break
    }
    for (const s of this.skills.values()) {
      const hits: Hit[] = []
      const add = (text: string, label: string) => hits.push({ text: normalize(text), label })
      add(`${s.skillId} 0x${s.skillId.toString(16)} ${s.nameCn} ${s.nameEn} ${s.nameJp} ${s.aliases.join(' ')}`, `技能系·${s.nameCn}`)
      add(`${s.descriptionCn ?? ''} ${s.descriptionJp ?? ''} ${s.specialRule?.descriptionCn ?? ''}`, `效果说明·${s.nameCn}`)
      for (const a of s.activations) {
        add(`${a.nativeActivationId ?? ''} ${a.nameCn} ${a.nameEn} ${a.nameJp} ${(a as typeof a & { aliases?: string[] }).aliases?.join(' ') ?? ''}`, `发动技能·${a.nameCn}`)
        add(`${a.descriptionCn} ${a.descriptionJp}`, `效果说明·${a.nameCn}`)
      }
      const armors: P3SkillArmorRelation[] = []
      for (const a of this.armors.values()) for (const point of a.skills) if (point.skillId === s.skillId && point.points !== 0) {
        const { skills: _, ...summary } = a
        armors.push({ ...summary, points: point.points, kind: point.kind })
        add(`${a.nameCn} ${a.nameJp} ${a.nameEn} ${a.armorKey}`, `相关防具·${a.nameCn || a.nameJp}`)
      }
      const linkedJewels: SkillDecorationRelation[] = []
      for (const d of jewels) for (const point of d.skills) if (point.skillId === s.skillId && point.points !== 0 && d.gameId === 'mhp3') {
        linkedJewels.push({ gameId: 'mhp3', itemId: d.itemId, nameCn: d.nameCn, nameJp: d.nameJp, nameEn: d.nameEn, points: point.points, slots: d.slots, iconPath: d.iconPath })
        add(`${d.nameCn} ${d.nameJp} ${d.nameEn} ${d.itemId} ${(aliases.get(d.itemId) ?? []).join(' ')}`, `相关装饰品·${d.nameCn}`)
      }
      const sources = charms.filter(c => c.skillId === s.skillId)
      for (const c of sources) add(`${c.label} ${c.nameJp} ${c.sourceKind === 'special-gift' ? '特殊赠送' : '随机候选'}`, `相关护石·${c.label}`)
      this.details.set(s.skillId, { ...s, gameId: 'mhp3', armors, decorations: linkedJewels, talismans: [], components: [],
        p3: { charmSources: sources, source: 'P3 日版原生说明；中文按本作原文整理。' } })
      this.hits.set(s.skillId, hits)
    }
  }

  getSkill(skillId: number): SkillDetail | null {
    skillIdentitySchema.parse({ gameId: 'mhp3', skillId })
    return this.details.get(skillId) ?? null
  }

  getArmor(armorKey: string): P3SkillArmorDetail | null {
    p3SkillArmorIdentitySchema.parse({ gameId: 'mhp3', armorKey })
    const armor = this.armors.get(armorKey)
    return armor ? { ...armor, skills: armor.skills.map(p => {
      const s = this.skills.get(p.skillId)
      if (!s) throw new Error(`P3 防具技能关联缺失：${p.skillId}`)
      return { ...p, nameCn: s.nameCn, nameJp: s.nameJp, nameEn: s.nameEn }
    }) } : null
  }

  searchSkills(request: SkillCatalogFilters): PageResult<SkillSummary> {
    const f = skillCatalogFiltersSchema.parse(request)
    if (f.gameId !== 'mhp3') throw new Error('P3 技能身份与游戏不匹配')
    const query = normalize(f.query ?? ''), page = f.page ?? 1, pageSize = f.pageSize ?? 100
    const rows: SkillSummary[] = []
    for (const s of this.details.values()) {
      const match = query ? this.hits.get(s.skillId)?.find(h => h.text.includes(query)) : undefined
      const row: SkillSummary = { gameId: 'mhp3', skillId: s.skillId, nameCn: s.nameCn, nameEn: s.nameEn, nameJp: s.nameJp,
        activationCount: s.activations.length, positiveActivationCount: s.activations.filter(a => a.direction === 'positive').length,
        negativeActivationCount: s.activations.filter(a => a.direction === 'negative').length, specialActivationCount: s.specialRule ? 1 : 0,
        armorCount: s.armors.length, decorationCount: s.decorations.length, talismanCount: s.p3!.charmSources.length, isPlaceholder: false,
        ...(match ? { match: `命中：${match.label}` } : {}) }
      if (f.targetSkillId != null) { if (row.skillId === f.targetSkillId) rows.push(row); continue }
      if (query && !match) continue
      if (f.direction && row[`${f.direction}ActivationCount`] === 0) continue
      if (f.source && f.source !== 'all' && row[`${f.source}Count`] === 0) continue
      rows.push(row)
    }
    rows.sort((a, b) => f.sort === 'name' ? a.nameCn.localeCompare(b.nameCn, 'zh-CN') || a.skillId - b.skillId
      : f.sort === 'activationCount' ? b.activationCount - a.activationCount || a.skillId - b.skillId : a.skillId - b.skillId)
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, hasNext: page * pageSize < rows.length }
  }

  getSkillFacets(): SkillCatalogFacets { return { directions: ['positive', 'negative', 'special'], sources: ['armor', 'decoration', 'talisman'] } }
}
