import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { validateCharm } from './charm'
import { readFinalWeaponKeys } from '../catalog/finalWeapons'
import { armorFallbackIconPath, charmIconPath, weaponFallbackIconPath } from '../save/catalogIconPaths'
import type { ArmorLoadoutSlot, CharmValidationResult, LoadoutArmorCandidate, LoadoutArmorFilters, LoadoutCalculationSnapshot, LoadoutCatalogSnapshot, LoadoutCharm, LoadoutCharmClass, LoadoutDecoration, LoadoutDecorationFilters, LoadoutFacets, LoadoutPage, LoadoutSkillDefinition, LoadoutWeaponCandidate, LoadoutWeaponFilters } from './types'

type Row = Record<string, unknown>
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const text = (value: unknown) => value == null ? '' : String(value)
const bool = (value: unknown) => value === true || value === 1 || value === '1'
const armorPartBySaveType: Record<number, ArmorLoadoutSlot> = { 1: 'chest', 2: 'arms', 3: 'waist', 4: 'legs', 5: 'head' }

function page<T>(items: T[], requestedPage = 1, requestedSize = 100): LoadoutPage<T> {
  const pageSize = Math.min(Math.max(requestedSize, 1), 100)
  const current = Math.max(requestedPage, 1)
  const offset = (current - 1) * pageSize
  return { items: items.slice(offset, offset + pageSize), page: current, pageSize, total: items.length, hasNext: offset + pageSize < items.length }
}

function groupRows(rows: Row[], key: string): Map<number, Row[]> {
  const grouped = new Map<number, Row[]>()
  for (const row of rows) {
    const id = number(row[key])
    const values = grouped.get(id)
    if (values) values.push(row)
    else grouped.set(id, [row])
  }
  return grouped
}

function freshRecord(saveType: number, saveId: number, slots: number, rarity: number | null): string {
  const record = new Uint8Array(28)
  record[0] = saveType & 0xff
  record[2] = saveId & 0xff; record[3] = (saveId >>> 8) & 0xff
  record[0x10] = (Math.min(Math.max(slots, 0), 3) & 3) << 2
  record[0x11] = Math.max(0, (rarity ?? 1) - 1) & 0xff
  return [...record].map(value => value.toString(16).padStart(2, '0')).join('')
}

export class LoadoutCatalogRepository {
  private bootstrapCache?: LoadoutCalculationSnapshot
  private snapshotCache?: LoadoutCatalogSnapshot
  private weaponsCache?: LoadoutWeaponCandidate[]
  private finalWeaponKeys?: Set<string>
  private armorsCache?: LoadoutArmorCandidate[]
  private relicLookupsCache?: LoadoutCalculationSnapshot['relicLookups']
  constructor(private readonly db: Database.Database, private readonly gameId: LoadoutCatalogSnapshot['gameId']) {}

  getBootstrap(): LoadoutCalculationSnapshot {
    if (this.bootstrapCache) return this.bootstrapCache
    const bootstrap: LoadoutCalculationSnapshot = {
      gameId: this.gameId,
      dataVersion: this.dataVersion(),
      decorations: this.getDecorations(),
      skills: this.getSkills(),
      charmClasses: this.getCharmClasses(),
      charmRanges: (this.db.prepare('SELECT * FROM catalog_skill_talisman_ranges WHERE game_id=? ORDER BY talisman_id,position,skill_id,min_points').all(this.gameId) as Row[]).map(row => ({ rangeKey: text(row.range_key), classId: number(row.talisman_id), skillId: number(row.skill_id), position: row.position === 'B' ? 'B' : 'A', minPoints: number(row.min_points), maxPoints: number(row.max_points), slotCount: row.slot_count == null ? null : number(row.slot_count), maxSlots: row.max_slots == null ? null : number(row.max_slots), status: row.range_status === 'exact' || row.range_status === 'unknown' ? row.range_status : 'rule', source: text(row.source) })),
      charmSlotRules: this.readCharmSlotRules(),
      charmCombinations: this.gameId === 'mh3g' && this.tableExists('charm_combinations') ? (this.db.prepare('SELECT class_id,slots,skill1_id,skill1_points,skill2_id,skill2_points FROM charm_combinations ORDER BY class_id,slots,skill1_id,skill1_points,skill2_id,skill2_points').all() as Row[]).map(row => [number(row.class_id), number(row.slots), number(row.skill1_id), number(row.skill1_points), number(row.skill2_id), number(row.skill2_points)]) : undefined,
      relicLookups: this.readRelicLookups(false),
    }
    this.bootstrapCache = bootstrap
    return bootstrap
  }

  getSnapshot(): LoadoutCatalogSnapshot {
    if (this.snapshotCache) return this.snapshotCache
    const snapshot: LoadoutCatalogSnapshot = {
      ...this.getBootstrap(),
      weapons: this.getWeapons(),
      armors: this.getArmors(),
    }
    this.snapshotCache = snapshot
    return snapshot
  }

  getRelicLookups(): LoadoutCalculationSnapshot['relicLookups'] {
    if (this.relicLookupsCache) return this.relicLookupsCache
    return this.relicLookupsCache = this.readRelicLookups(true)
  }

  getFacets(): LoadoutFacets {
    const bootstrap = this.getBootstrap()
    const weaponTypes = (this.db.prepare('SELECT type_id,name_cn FROM catalog_weapon_types WHERE game_id=? ORDER BY sort_order,type_id').all(this.gameId) as Row[]).map(row => ({ typeId: number(row.type_id), nameCn: text(row.name_cn) }))
    const weaponRarities = (this.db.prepare('SELECT DISTINCT rarity FROM catalog_weapons WHERE game_id=? AND is_placeholder=0 AND rarity IS NOT NULL ORDER BY rarity').all(this.gameId) as Row[]).map(row => number(row.rarity))
    const armorRarities = (this.db.prepare('SELECT DISTINCT rarity FROM catalog_armors WHERE game_id=? AND is_placeholder=0 AND rarity IS NOT NULL ORDER BY rarity').all(this.gameId) as Row[]).map(row => number(row.rarity))
    return { skills: bootstrap.skills.map(value => ({ skillId: value.skillId, nameCn: value.nameCn, nameEn: value.nameEn, nameJp: value.nameJp })), weaponTypes, weaponRarities, armorRarities, charmClasses: bootstrap.charmClasses }
  }

  searchWeapons(filters: LoadoutWeaponFilters): LoadoutPage<LoadoutWeaponCandidate> {
    const query = filters.query?.trim().toLocaleLowerCase() ?? ''
    const finals = filters.finalOnly ? (this.finalWeaponKeys ??= readFinalWeaponKeys(this.db, this.gameId)) : undefined
    const items = this.getWeapons().filter(value => (!finals || (value.sourceKind === 'catalog' && value.weaponKey != null && finals.has(value.weaponKey))) && (!filters.typeId || value.typeId === filters.typeId) && (!filters.sourceKind || filters.sourceKind === 'all' || value.sourceKind === filters.sourceKind) && (filters.rarity == null || value.rarity === filters.rarity) && (filters.slots == null || value.slots === filters.slots) && (filters.directlyProducible == null || Boolean(value.directlyProducible) === filters.directlyProducible) && (!query || `${value.nameCn} ${value.nameEn} ${value.saveId} 0x${value.saveId.toString(16)}`.toLocaleLowerCase().includes(query))).sort((a, b) => filters.sort === 'rarity' ? (b.rarity ?? -1) - (a.rarity ?? -1) || a.candidateKey.localeCompare(b.candidateKey) : filters.sort === 'slots' ? b.slots - a.slots || a.candidateKey.localeCompare(b.candidateKey) : filters.sort === 'attack' ? (b.attack ?? -1) - (a.attack ?? -1) || a.candidateKey.localeCompare(b.candidateKey) : a.candidateKey.localeCompare(b.candidateKey))
    return page(items, filters.page, filters.pageSize)
  }

  searchArmors(filters: LoadoutArmorFilters): LoadoutPage<LoadoutArmorCandidate> {
    const query = filters.query?.trim().toLocaleLowerCase() ?? ''
    const skillPoints = (value: LoadoutArmorCandidate) => value.skills.find(skill => skill.skillId === filters.skillId)?.points ?? -32768
    const items = this.getArmors().filter(value => value.part === filters.part && (!filters.sourceKind || filters.sourceKind === 'all' || value.sourceKind === filters.sourceKind) && (filters.skillId == null || value.skills.some(skill => skill.skillId === filters.skillId && skill.points > 0)) && (filters.rarity == null || value.rarity === filters.rarity) && (filters.slots == null || value.slots === filters.slots) && (!filters.combat || value.combat === filters.combat || value.combat === 'both') && (!filters.gender || value.gender === filters.gender || value.gender === 'both') && (!query || `${value.nameCn} ${value.nameEn} ${value.dexId ?? ''} ${value.saveId ?? ''}`.toLocaleLowerCase().includes(query))).sort((a, b) => filters.sort === 'rarity' ? (b.rarity ?? -1) - (a.rarity ?? -1) || a.candidateKey.localeCompare(b.candidateKey) : filters.sort === 'slots' ? b.slots - a.slots || a.candidateKey.localeCompare(b.candidateKey) : filters.sort === 'defense' ? b.maxDefense - a.maxDefense || a.candidateKey.localeCompare(b.candidateKey) : filters.sort === 'skill' ? skillPoints(b) - skillPoints(a) || a.candidateKey.localeCompare(b.candidateKey) : a.candidateKey.localeCompare(b.candidateKey))
    return page(items, filters.page, filters.pageSize)
  }

  searchDecorations(filters: LoadoutDecorationFilters): LoadoutPage<LoadoutDecoration> {
    const query = filters.query?.trim().toLocaleLowerCase() ?? ''
    const items = this.getBootstrap().decorations.filter(value => (filters.skillId == null || value.skills.some(skill => skill.skillId === filters.skillId)) && (!query || `${value.nameCn} ${value.saveId} 0x${value.saveId.toString(16)}`.toLocaleLowerCase().includes(query)))
    return page(items, filters.page, filters.pageSize)
  }

  validateCharm(charm: LoadoutCharm): CharmValidationResult { return validateCharm(this.getBootstrap(), charm) }

  private readCharmSlotRules(): NonNullable<LoadoutCalculationSnapshot['charmSlotRules']> {
    if (this.gameId !== 'mhgu' || !this.tableExists('cn__talisman_slot_thresholds') || !this.tableExists('cn__talismans')) return []
    const rows = this.db.prepare('SELECT t.id class_id,t.max_slots,r.fulfillment,r.slot1_threshold,r.slot2_threshold,r.slot3_threshold,r.source FROM cn__talismans t JOIN cn__talisman_slot_thresholds r ON r.rarity_marker=t.rarity WHERE t.id>0 ORDER BY t.id,r.fulfillment').all() as Row[]
    const evidenceRows = this.db.prepare('SELECT t.id class_id,t.max_slots,t.rarity,r.fulfillment,r.slot1_threshold,r.slot2_threshold,r.slot3_threshold FROM cn__talismans t JOIN cn__talisman_slot_thresholds r ON r.rarity_marker=t.rarity WHERE t.id>0 ORDER BY t.id,r.fulfillment').all()
    const evidence = this.tableExists('catalog_build_metadata') ? this.db.prepare("SELECT source_sha256 FROM catalog_build_metadata WHERE game_id='mhgu' AND domain='charm-slot-native-audit'").get() as Row | undefined : undefined
    const verified = evidence?.source_sha256 === createHash('sha256').update(JSON.stringify(evidenceRows)).digest('hex')
    return rows.map(row => ({ classId: number(row.class_id), maxSlots: number(row.max_slots), fulfillment: number(row.fulfillment), thresholds: [number(row.slot1_threshold), number(row.slot2_threshold), number(row.slot3_threshold)], source: `${text(row.source)}${verified ? '+native-slot-availability-audit' : ''}`, evidence: verified ? 'verified' : 'reference' }))
  }

  private dataVersion(): string {
    const rows = this.tableExists('catalog_build_metadata') ? this.db.prepare('SELECT domain,source_sha256,builder_sha256 FROM catalog_build_metadata WHERE game_id=? ORDER BY domain').all(this.gameId) as Row[] : []
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16)
  }

  private tableExists(name: string): boolean { return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) }

  private readRelicLookups(includeEditorOptions: boolean): LoadoutCalculationSnapshot['relicLookups'] {
    if (!this.tableExists('catalog_loadout_relic_value_lookups')) return []
    const editorClause = includeEditorOptions ? '' : " AND lookup_kind <> 'equipment_lookup'"
    return (this.db.prepare(`SELECT * FROM catalog_loadout_relic_value_lookups WHERE game_id=?${editorClause} ORDER BY lookup_kind,lookup_key`).all(this.gameId) as Row[]).map(row => {
      let payload: Record<string, unknown> = {}
      try { payload = JSON.parse(text(row.payload_json)) as Record<string, unknown> } catch { payload = {} }
      return { kind: text(row.lookup_kind), key: text(row.lookup_key), payload, source: text(row.source) }
    })
  }

  private getSkills(): LoadoutSkillDefinition[] {
    const rows = this.db.prepare('SELECT * FROM catalog_skills WHERE game_id=? AND is_placeholder=0 ORDER BY skill_id').all(this.gameId) as Row[]
    const activations = this.db.prepare('SELECT * FROM catalog_skill_activations WHERE game_id=? ORDER BY skill_id,threshold').all(this.gameId) as Row[]
    const bySkill = groupRows(activations, 'skill_id')
    return rows.map(row => ({ skillId: number(row.skill_id), nameCn: text(row.name_cn), nameEn: text(row.name_en), nameJp: text(row.name_jp), activations: (bySkill.get(number(row.skill_id)) ?? []).map(value => ({ activationKey: text(value.activation_key), skillId: number(value.skill_id), threshold: number(value.threshold), direction: value.direction === 'negative' || value.direction === 'special' ? value.direction : 'positive', nameCn: text(value.name_cn) })) }))
  }

  private getWeapons(): LoadoutWeaponCandidate[] {
    if (this.weaponsCache) return this.weaponsCache
    const regular = (this.db.prepare(`SELECT w.*,t.name_cn type_name_cn FROM catalog_weapons w JOIN catalog_weapon_types t ON t.game_id=w.game_id AND t.type_id=w.type_id WHERE w.game_id=? AND w.is_placeholder=0 ORDER BY t.sort_order,w.save_id,COALESCE(w.save_level,-1)`).all(this.gameId) as Row[]).map(row => ({ kind: 'weapon' as const, gameId: this.gameId, candidateKey: `catalog:${text(row.weapon_key)}`, sourceKind: 'catalog' as const, weaponKey: text(row.weapon_key), templateKey: null, saveType: number(row.save_type), saveId: number(row.save_id), saveLevel: number(row.save_level), nameCn: text(row.name_cn), nameEn: text(row.name_en), typeId: number(row.type_id), typeNameCn: text(row.type_name_cn), rarity: row.rarity == null ? null : number(row.rarity), slots: number(row.slots), attack: row.display_attack == null ? null : number(row.display_attack), affinity: row.affinity == null ? null : number(row.affinity), defense: number(row.defense), directlyProducible: bool(row.is_directly_producible), iconPath: row.icon_path ? text(row.icon_path) : null }))
    if (this.gameId !== 'mh4g') return this.weaponsCache = regular
    const highestRarity = new Map<number, number>()
    for (const value of regular) if (value.rarity != null) highestRarity.set(value.typeId, Math.max(highestRarity.get(value.typeId) ?? 0, value.rarity))
    if (this.tableExists('catalog_loadout_relic_weapon_templates')) {
      const relics=(this.db.prepare('SELECT * FROM catalog_loadout_relic_weapon_templates WHERE game_id=? ORDER BY save_type,save_id').all(this.gameId) as Row[]).map(row=>{const typeId=number(row.type_id); return {kind:'weapon' as const,gameId:this.gameId,candidateKey:`relic:${text(row.template_key)}`,sourceKind:'relicTemplate' as const,weaponKey:null,templateKey:text(row.template_key),saveType:number(row.save_type),saveId:number(row.save_id),nameCn:text(row.name_cn),nameEn:text(row.name_en),typeId,typeNameCn:text(row.type_name_cn),rarity:row.rarity==null?(highestRarity.get(typeId) ?? null):number(row.rarity),slots:number(row.slots),attack:row.attack==null?null:number(row.attack),affinity:row.affinity==null?null:number(row.affinity),defense:number(row.defense),directlyProducible:false,iconPath:weaponFallbackIconPath(this.gameId,typeId),instance:{source:'catalogTemplate' as const,recordHex:text(row.record_hex),legality:'unknown' as const,encoding:'encodable' as const,issues:[{code:'relic.template',path:'weapon.instance',severity:'info' as const,message:'发掘模板的随机参数需要在高级编辑中确认',source:text(row.source)}]}}})
      return this.weaponsCache = [...regular,...relics]
    }
    if (!this.tableExists('weapons')) return this.weaponsCache = regular
    const types = new Map((this.db.prepare('SELECT type_id,save_type,name_cn FROM catalog_weapon_types WHERE game_id=?').all(this.gameId) as Row[]).map(row => [number(row.save_type), { typeId: number(row.type_id), nameCn: text(row.name_cn) }]))
    const relics = (this.db.prepare('SELECT * FROM weapons WHERE is_relic=1 ORDER BY save_type,save_id').all() as Row[]).map(row => {
      const type = types.get(number(row.save_type)) ?? { typeId: 0, nameCn: '未知武器' }
      const recordHex = freshRecord(number(row.save_type), number(row.save_id), number(row.slots), row.rarity == null ? null : number(row.rarity))
      return { kind: 'weapon' as const, gameId: this.gameId, candidateKey: `relic:w:${number(row.save_type)}:${number(row.save_id)}`, sourceKind: 'relicTemplate' as const, weaponKey: null, templateKey: `w:${number(row.save_type)}:${number(row.save_id)}`, saveType: number(row.save_type), saveId: number(row.save_id), nameCn: text(row.name_cn), nameEn: text(row.name_en), typeId: type.typeId, typeNameCn: type.nameCn, rarity: row.rarity == null ? (highestRarity.get(type.typeId) ?? null) : number(row.rarity), slots: number(row.slots), attack: row.attack == null ? null : number(row.attack), affinity: row.affinity == null ? null : number(row.affinity), defense: number(row.defense), directlyProducible: false, iconPath: weaponFallbackIconPath(this.gameId, type.typeId), instance: { source: 'catalogTemplate' as const, recordHex, legality: 'unknown' as const, encoding: 'encodable' as const, issues: [{ code: 'relic.template', path: 'weapon.instance', severity: 'info' as const, message: '发掘模板的随机参数需要在高级编辑中确认', source: text(row.mapping_source ?? row.source) }] } }
    })
    return this.weaponsCache = [...regular, ...relics]
  }

  private getArmors(): LoadoutArmorCandidate[] {
    if (this.armorsCache) return this.armorsCache
    const rows = this.db.prepare('SELECT * FROM catalog_armors WHERE game_id=? AND is_placeholder=0 ORDER BY part_order,dex_id').all(this.gameId) as Row[]
    const skills = this.db.prepare('SELECT * FROM catalog_armor_skills WHERE game_id=? ORDER BY armor_dex_id,skill_id').all(this.gameId) as Row[]
    const identities = this.tableExists('catalog_armor_save_identities') ? this.db.prepare('SELECT * FROM catalog_armor_save_identities WHERE game_id=? ORDER BY armor_dex_id,save_type,save_id').all(this.gameId) as Row[] : []
    const skillsByArmor = groupRows(skills, 'armor_dex_id')
    const identityByArmor = new Map<number, Row>()
    for (const identity of identities) if (!identityByArmor.has(number(identity.armor_dex_id))) identityByArmor.set(number(identity.armor_dex_id), identity)
    const regular = rows.map(row => { const identity = identityByArmor.get(number(row.dex_id)); return { kind: 'armor' as const, gameId: this.gameId, candidateKey: `catalog:${number(row.dex_id)}`, sourceKind: 'catalog' as const, dexId: number(row.dex_id), templateKey: null, saveType: identity ? number(identity.save_type) : null, saveId: identity ? number(identity.save_id) : null, nameCn: text(row.name_cn), nameEn: text(row.name_en), part: row.part as ArmorLoadoutSlot, combat: (row.combat === 'blademaster' || row.combat === 'gunner' ? row.combat : 'both') as LoadoutArmorCandidate['combat'], gender: (row.gender === 'male' || row.gender === 'female' ? row.gender : 'both') as LoadoutArmorCandidate['gender'], rarity: row.rarity == null ? null : number(row.rarity), slots: number(row.slots), baseDefense: number(row.base_defense), maxDefense: number(row.max_defense), fireRes: number(row.fire_res), waterRes: number(row.water_res), thunderRes: number(row.thunder_res), iceRes: number(row.ice_res), dragonRes: number(row.dragon_res), iconPath: row.icon_path ? text(row.icon_path) : null, skills: (skillsByArmor.get(number(row.dex_id)) ?? []).map(value => ({ skillId: number(value.skill_id), nameCn: text(value.name_cn), points: number(value.points) })) } })
    if (this.gameId !== 'mh4g') return this.armorsCache = regular
    if (this.tableExists('catalog_loadout_relic_armor_templates')) {
      const relics=(this.db.prepare('SELECT * FROM catalog_loadout_relic_armor_templates WHERE game_id=? ORDER BY save_type,save_id').all(this.gameId) as Row[]).map(row=>{const part=text(row.part) as ArmorLoadoutSlot; return {kind:'armor' as const,gameId:this.gameId,candidateKey:`relic:${text(row.template_key)}`,sourceKind:'relicTemplate' as const,dexId:null,templateKey:text(row.template_key),saveType:number(row.save_type),saveId:number(row.save_id),nameCn:text(row.name_cn),nameEn:text(row.name_en),part,combat:(row.combat==='blademaster'||row.combat==='gunner'?row.combat:'both') as LoadoutArmorCandidate['combat'],gender:(row.gender==='male'||row.gender==='female'?row.gender:'both') as LoadoutArmorCandidate['gender'],rarity:row.rarity==null?null:number(row.rarity),slots:number(row.slots),baseDefense:number(row.base_defense),maxDefense:number(row.max_defense),fireRes:number(row.fire_res),waterRes:number(row.water_res),thunderRes:number(row.thunder_res),iceRes:number(row.ice_res),dragonRes:number(row.dragon_res),iconPath:armorFallbackIconPath(this.gameId,part),skills:[],instance:{source:'catalogTemplate' as const,recordHex:text(row.record_hex),legality:'unknown' as const,encoding:'encodable' as const,issues:[{code:'relic.template',path:'armor.instance',severity:'info' as const,message:'发掘防具模板的高级参数需要确认',source:text(row.source)}]}}})
      return this.armorsCache = [...regular,...relics]
    }
    if (!this.tableExists('armors')) return this.armorsCache = regular
    const relics = (this.db.prepare('SELECT * FROM armors WHERE is_relic=1 ORDER BY save_type,save_id').all() as Row[]).map(row => {
      const saveType = number(row.save_type); const recordHex = freshRecord(saveType, number(row.save_id), number(row.slots), row.rarity == null ? null : number(row.rarity))
      const combat: LoadoutArmorCandidate['combat'] = number(row.combat) === 1 ? 'blademaster' : number(row.combat) === 2 ? 'gunner' : 'both'; const gender: LoadoutArmorCandidate['gender'] = number(row.gender) === 1 ? 'male' : number(row.gender) === 2 ? 'female' : 'both'
      const part = armorPartBySaveType[saveType] ?? 'head'
      return { kind: 'armor' as const, gameId: this.gameId, candidateKey: `relic:a:${saveType}:${number(row.save_id)}`, sourceKind: 'relicTemplate' as const, dexId: null, templateKey: `a:${saveType}:${number(row.save_id)}`, saveType, saveId: number(row.save_id), nameCn: text(row.name_cn), nameEn: text(row.name_en), part, combat, gender, rarity: row.rarity == null ? null : number(row.rarity), slots: number(row.slots), baseDefense: number(row.base_defense), maxDefense: number(row.max_defense), fireRes: number(row.fire_res), waterRes: number(row.water_res), thunderRes: number(row.thunder_res), iceRes: number(row.ice_res), dragonRes: number(row.dragon_res), iconPath: armorFallbackIconPath(this.gameId, part), skills: [], instance: { source: 'catalogTemplate' as const, recordHex, legality: 'unknown' as const, encoding: 'encodable' as const, issues: [{ code: 'relic.template', path: 'armor.instance', severity: 'info' as const, message: '发掘防具模板的高级参数需要确认', source: text(row.mapping_source ?? row.source) }] } }
    })
    return this.armorsCache = [...regular, ...relics]
  }

  private getDecorations(): LoadoutDecoration[] {
    const rows = this.db.prepare('SELECT * FROM catalog_decorations WHERE game_id=? AND is_placeholder=0 ORDER BY save_id').all(this.gameId) as Row[]
    const skills = this.db.prepare('SELECT * FROM catalog_decoration_skills WHERE game_id=? ORDER BY decoration_save_id,skill_id').all(this.gameId) as Row[]
    const byDecoration = groupRows(skills, 'decoration_save_id')
    return rows.map(row => ({ saveId: number(row.save_id), nameCn: text(row.name_cn), slots: number(row.slots), skills: (byDecoration.get(number(row.save_id)) ?? []).map(value => ({ skillId: number(value.skill_id), nameCn: text(value.name_cn), points: number(value.points) })) }))
  }

  private getCharmClasses(): LoadoutCharmClass[] {
    if (this.tableExists('charm_classes')) return (this.db.prepare('SELECT * FROM charm_classes WHERE save_id>0 ORDER BY save_id').all() as Row[]).map(row => { const classId = number(row.save_id); return { classId, nameCn: text(row.name_cn), nameEn: text(row.name_en), maxSlots: this.maxCharmSlots(classId), iconPath: charmIconPath(this.gameId, classId) } })
    if (this.tableExists('cn__talismans')) return (this.db.prepare('SELECT * FROM cn__talismans WHERE id>0 ORDER BY id').all() as Row[]).map(row => { const classId = number(row.id); return { classId, nameCn: text(row.name), nameEn: text(row.english), maxSlots: number(row.max_slots, 3), iconPath: charmIconPath(this.gameId, classId) } })
    return []
  }

  private maxCharmSlots(classId: number): number {
    if (this.tableExists('charm_combinations')) return number((this.db.prepare('SELECT max(slots) value FROM charm_combinations WHERE class_id=?').get(classId) as Row | undefined)?.value, 3)
    if (this.tableExists('charm_class_rules')) return number((this.db.prepare('SELECT max_slots value FROM charm_class_rules WHERE class_id=?').get(classId) as Row | undefined)?.value, 3)
    return 3
  }
}
