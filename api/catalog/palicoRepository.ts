import type Database from 'better-sqlite3'
import type {
  PageResult, PalicoArmorDetail, PalicoArmorFilters, PalicoArmorSummary,
  PalicoCatalogFacets, PalicoMaterial, PalicoSkillDetail, PalicoSkillFilters, PalicoSkillSummary, PalicoSupportMoveDetail,
  PalicoSupportMoveFilters, PalicoSupportMoveSummary, PalicoTypeDetail, PalicoTypeSummary, PalicoUnlock, PalicoWeaponDetail,
  PalicoWeaponFilters, PalicoWeaponSummary,
} from './types'

type Row = Record<string, unknown>
const int = (value: unknown, fallback = 0) => value == null ? fallback : Number(value)
const nullableInt = (value: unknown) => value == null ? null : Number(value)
const bool = (value: unknown) => value === 1 || value === true

function page<T>(items: T[], current: number, pageSize: number, total: number): PageResult<T> {
  return { items, page: current, pageSize, total, hasNext: current * pageSize < total }
}
function queryWhere(query: string | undefined, idColumn: string, values: unknown[], columns: string[]) {
  if (!query?.trim()) return ''
  const input = query.trim(); const like = `%${input}%`; const numeric = /^0x[\da-f]+$/i.test(input) ? Number.parseInt(input.slice(2), 16) : Number(input)
  values.push(...columns.map(() => like), Number.isInteger(numeric) ? numeric : -1)
  return ` AND (${columns.map(column => `${column} LIKE ?`).join(' OR ')} OR ${idColumn}=?)`
}

export class PalicoCatalogRepository {
  constructor(private readonly db: Database.Database) {}

  searchTypes(): PalicoTypeSummary[] {
    return (this.db.prepare('SELECT * FROM catalog_palico_types WHERE game_id=? ORDER BY type_id').all('mhgu') as Row[]).map(toType)
  }

  getType(typeId: number): PalicoTypeDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_palico_types WHERE game_id=? AND type_id=?').get('mhgu', typeId) as Row | undefined
    if (!row) return null
    const moves = this.db.prepare(`SELECT m.support_move_id,m.name_cn,m.name_en,r.relation_kind FROM catalog_palico_type_support_moves r JOIN catalog_palico_support_moves m USING(game_id,support_move_id) WHERE r.game_id=? AND r.type_id=? ORDER BY m.support_move_id`).all('mhgu', typeId) as Row[]
    const skills = this.db.prepare(`SELECT s.palico_skill_id,s.name_cn,s.name_en,r.relation_kind FROM catalog_palico_type_skills r JOIN catalog_palico_skills s USING(game_id,palico_skill_id) WHERE r.game_id=? AND r.type_id=? ORDER BY s.palico_skill_id`).all('mhgu', typeId) as Row[]
    return { ...toType(row), descriptionEn: String(row.description_en ?? ''), descriptionJp: String(row.description_jp ?? ''), supportMoves: moves.map(value => ({ gameId: 'mhgu', supportMoveId: int(value.support_move_id), nameCn: String(value.name_cn), nameEn: String(value.name_en), relationKind: String(value.relation_kind) })), skills: skills.map(value => ({ gameId: 'mhgu', palicoSkillId: int(value.palico_skill_id), nameCn: String(value.name_cn), nameEn: String(value.name_en), relationKind: String(value.relation_kind) })) }
  }

  searchSupportMoves(filters: PalicoSupportMoveFilters): PalicoSupportMoveSummary[] {
    const values: unknown[] = ['mhgu']; let where = 'm.game_id=? AND m.is_placeholder=0'
    if (filters.targetSupportMoveId != null) { where += ' AND m.support_move_id=?'; values.push(filters.targetSupportMoveId) }
    where += queryWhere(filters.query, 'm.support_move_id', values, ['m.name_cn','m.name_en','m.name_jp','m.description_cn','m.description_en','m.description_jp'])
    if (filters.typeId != null) { where += ' AND EXISTS(SELECT 1 FROM catalog_palico_type_support_moves r WHERE r.game_id=m.game_id AND r.support_move_id=m.support_move_id AND r.type_id=?)'; values.push(filters.typeId) }
    if (filters.gaugeCost != null) { where += ' AND m.gauge_cost=?'; values.push(filters.gaugeCost) }
    if (filters.generationGroup === 'fixed') where += ' AND m.generation_group IS NULL'
    else if (filters.generationGroup) { where += ' AND m.generation_group=?'; values.push(filters.generationGroup) }
    if (filters.monsterId != null) { where += ' AND EXISTS(SELECT 1 FROM catalog_palico_support_move_unlocks u WHERE u.game_id=m.game_id AND u.support_move_id=m.support_move_id AND u.monster_id=?)'; values.push(filters.monsterId) }
    return (this.db.prepare(`SELECT m.* FROM catalog_palico_support_moves m WHERE ${where} ORDER BY m.support_move_id LIMIT 100`).all(...values) as Row[]).map(toMove)
  }

  getSupportMove(id: number): PalicoSupportMoveDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_palico_support_moves WHERE game_id=? AND support_move_id=?').get('mhgu', id) as Row | undefined
    if (!row) return null
    return { ...toMove(row), descriptionCn: String(row.description_cn ?? ''), descriptionEn: String(row.description_en ?? ''), descriptionJp: String(row.description_jp ?? ''), types: this.typesFor('catalog_palico_type_support_moves','support_move_id',id), unlocks: this.unlocksFor('catalog_palico_support_move_unlocks','support_move_id',id), source: String(row.source ?? '') }
  }

  searchSkills(filters: PalicoSkillFilters): PalicoSkillSummary[] {
    const values: unknown[] = ['mhgu']; let where = 's.game_id=? AND s.is_placeholder=0'
    if (filters.targetPalicoSkillId != null) { where += ' AND s.palico_skill_id=?'; values.push(filters.targetPalicoSkillId) }
    where += queryWhere(filters.query, 's.palico_skill_id', values, ['s.name_cn','s.name_en','s.name_jp','s.description_cn','s.description_en','s.description_jp'])
    if (filters.memoryCost != null) { where += ' AND s.memory_cost=?'; values.push(filters.memoryCost) }
    if (filters.generationGroup === 'fixed') where += ' AND s.generation_group IS NULL'
    else if (filters.generationGroup) { where += ' AND s.generation_group=?'; values.push(filters.generationGroup) }
    if (filters.learnLevel != null) { where += ' AND s.learn_level=?'; values.push(filters.learnLevel) }
    if (filters.unlockKind) { where += ' AND EXISTS(SELECT 1 FROM catalog_palico_skill_unlocks u WHERE u.game_id=s.game_id AND u.palico_skill_id=s.palico_skill_id AND u.unlock_kind=?)'; values.push(filters.unlockKind) }
    return (this.db.prepare(`SELECT s.* FROM catalog_palico_skills s WHERE ${where} ORDER BY s.palico_skill_id LIMIT 100`).all(...values) as Row[]).map(toSkill)
  }

  getSkill(id: number): PalicoSkillDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_palico_skills WHERE game_id=? AND palico_skill_id=?').get('mhgu', id) as Row | undefined
    if (!row) return null
    return { ...toSkill(row), descriptionCn: String(row.description_cn ?? ''), descriptionEn: String(row.description_en ?? ''), descriptionJp: String(row.description_jp ?? ''), types: this.typesFor('catalog_palico_type_skills','palico_skill_id',id), unlocks: this.unlocksFor('catalog_palico_skill_unlocks','palico_skill_id',id), source: String(row.source ?? '') }
  }

  searchWeapons(filters: PalicoWeaponFilters): PageResult<PalicoWeaponSummary> {
    const current = Math.max(filters.page ?? 1, 1); const pageSize = Math.min(filters.pageSize ?? 100, 100); const values: unknown[] = ['mhgu']; let where = 'w.game_id=?'
    if (filters.targetEquipmentId != null) { where += ' AND w.equipment_id=?'; values.push(filters.targetEquipmentId) }
    where += queryWhere(filters.query, 'w.equipment_id', values, ['w.name_cn','w.name_en','w.name_jp','w.description_cn','w.description_en','w.description_jp'])
    for (const [field, value] of [['attack_type',filters.attackType],['specialization_id',filters.specializationId],['rarity',filters.rarity],['sharpness_id',filters.sharpnessId]] as const) if (value != null) { where += ` AND w.${field}=?`; values.push(value) }
    if (filters.specialAttackId === 'none') where += ' AND w.special_attack_id IS NULL'
    else if (filters.specialAttackId != null) { where += ' AND w.special_attack_id=?'; values.push(filters.specialAttackId) }
    const orders = { source:'equipment_id', meleeAttack:'melee_attack', rangedAttack:'ranged', affinity:'MAX(melee_affinity,ranged_affinity)', sharpness:'sharpness_id', defense:'defense' } as const
    const order = orders[filters.sort ?? 'source']; const direction = filters.direction === 'desc' ? 'DESC' : 'ASC'
    const total = int((this.db.prepare(`SELECT count(*) count FROM catalog_palico_weapons w WHERE ${where}`).get(...values) as Row).count)
    const rows = this.db.prepare(`SELECT w.* FROM catalog_palico_weapons w WHERE ${where} ORDER BY ${order} ${direction},equipment_id ASC LIMIT ? OFFSET ?`).all(...values,pageSize,(current-1)*pageSize) as Row[]
    return page(rows.map(toWeapon),current,pageSize,total)
  }

  getWeapon(id: number): PalicoWeaponDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_palico_weapons WHERE game_id=? AND equipment_id=?').get('mhgu',id) as Row | undefined
    return row ? { ...toWeapon(row), descriptionCn:String(row.description_cn??''),descriptionEn:String(row.description_en??''),descriptionJp:String(row.description_jp??''),materials:this.materialsFor('catalog_palico_weapon_materials',id),source:String(row.source??'') } : null
  }

  searchArmors(filters: PalicoArmorFilters): PageResult<PalicoArmorSummary> {
    const current=Math.max(filters.page??1,1),pageSize=Math.min(filters.pageSize??100,100),values:unknown[]=['mhgu'];let where='a.game_id=?'
    if(filters.targetEquipmentId!=null){where+=' AND a.equipment_id=?';values.push(filters.targetEquipmentId)}
    where+=queryWhere(filters.query,'a.equipment_id',values,['a.name_cn','a.name_en','a.name_jp','a.description_cn','a.description_en','a.description_jp'])
    if(filters.part){where+=' AND a.part=?';values.push(filters.part)} if(filters.rarity!=null){where+=' AND a.rarity=?';values.push(filters.rarity)}
    const orders={source:'equipment_id',defense:'defense',fireRes:'fire_res',waterRes:'water_res',thunderRes:'thunder_res',iceRes:'ice_res',dragonRes:'dragon_res'} as const;const direction=filters.direction==='desc'?'DESC':'ASC'
    const total=int((this.db.prepare(`SELECT count(*) count FROM catalog_palico_armors a WHERE ${where}`).get(...values) as Row).count)
    const rows=this.db.prepare(`SELECT a.* FROM catalog_palico_armors a WHERE ${where} ORDER BY ${orders[filters.sort??'source']} ${direction},equipment_id ASC LIMIT ? OFFSET ?`).all(...values,pageSize,(current-1)*pageSize) as Row[]
    return page(rows.map(toArmor),current,pageSize,total)
  }

  getArmor(id:number):PalicoArmorDetail|null{const row=this.db.prepare('SELECT * FROM catalog_palico_armors WHERE game_id=? AND equipment_id=?').get('mhgu',id) as Row|undefined;return row?{...toArmor(row),descriptionCn:String(row.description_cn??''),descriptionEn:String(row.description_en??''),descriptionJp:String(row.description_jp??''),materials:this.materialsFor('catalog_palico_armor_materials',id),source:String(row.source??'')}:null}

  getFacets():PalicoCatalogFacets{return {typeOptions:this.searchTypes().map(({typeId,nameCn,nameEn})=>({typeId,nameCn,nameEn})),gaugeCosts:this.distinct('catalog_palico_support_moves','gauge_cost'),memoryCosts:this.distinct('catalog_palico_skills','memory_cost'),learnLevels:this.distinctPositive('catalog_palico_skills','learn_level'),generationGroups:(this.db.prepare("SELECT value FROM (SELECT generation_group value FROM catalog_palico_support_moves WHERE game_id='mhgu' UNION SELECT generation_group value FROM catalog_palico_skills WHERE game_id='mhgu') WHERE value IS NOT NULL ORDER BY value").all() as Row[]).map(row=>String(row.value)),unlockKinds:(this.db.prepare("SELECT DISTINCT unlock_kind value FROM catalog_palico_skill_unlocks WHERE game_id='mhgu' AND evidence_status!='conflict' ORDER BY CASE unlock_kind WHEN 'level' THEN 1 WHEN 'innate' THEN 2 WHEN 'distribution' THEN 3 WHEN 'monster' THEN 4 ELSE 5 END").all() as Row[]).map(row=>String(row.value) as PalicoCatalogFacets['unlockKinds'][number]),rarities:(this.db.prepare("SELECT value FROM (SELECT rarity value FROM catalog_palico_weapons WHERE game_id='mhgu' UNION SELECT rarity value FROM catalog_palico_armors WHERE game_id='mhgu') ORDER BY value").all() as Row[]).map(row=>int(row.value)),specializations:(this.db.prepare("SELECT DISTINCT specialization_id id,specialization_cn name_cn,specialization_en name_en FROM catalog_palico_weapons WHERE game_id='mhgu' ORDER BY id").all() as Row[]).map(row=>({id:int(row.id),nameCn:String(row.name_cn),nameEn:String(row.name_en)})),specialAttacks:(this.db.prepare("SELECT DISTINCT special_attack_id id,special_attack_cn name_cn,special_attack_en name_en FROM catalog_palico_weapons WHERE game_id='mhgu' AND special_attack_id IS NOT NULL ORDER BY id").all() as Row[]).map(row=>({id:int(row.id),nameCn:String(row.name_cn),nameEn:String(row.name_en)})),sharpnessIds:this.distinct('catalog_palico_weapons','sharpness_id')}}

  private distinct(table:string,column:string):number[]{return (this.db.prepare(`SELECT DISTINCT ${column} value FROM ${table} WHERE game_id='mhgu' AND ${column} IS NOT NULL ORDER BY value`).all() as Row[]).map(row=>int(row.value))}
  private distinctPositive(table:string,column:string):number[]{return (this.db.prepare(`SELECT DISTINCT ${column} value FROM ${table} WHERE game_id='mhgu' AND ${column}>0 ORDER BY value`).all() as Row[]).map(row=>int(row.value))}
  private typesFor(table:string,column:string,id:number):PalicoTypeSummary[]{return (this.db.prepare(`SELECT t.* FROM ${table} r JOIN catalog_palico_types t USING(game_id,type_id) WHERE r.game_id=? AND r.${column}=? ORDER BY t.type_id`).all('mhgu',id) as Row[]).map(toType)}
  private unlocksFor(table:string,column:string,id:number):PalicoUnlock[]{return (this.db.prepare(`SELECT u.*,m.name_cn monster_name_cn FROM ${table} u LEFT JOIN catalog_monsters m ON m.game_id=u.game_id AND m.monster_id=u.monster_id WHERE u.game_id=? AND u.${column}=? AND u.evidence_status!='conflict' ORDER BY u.unlock_key`).all('mhgu',id) as Row[]).map(row=>({unlockKey:String(row.unlock_key),nativeUnlockId:nullableInt(row.native_unlock_id),kind:String(row.unlock_kind) as PalicoUnlock['kind'],level:nullableInt(row.unlock_level),monsterId:nullableInt(row.monster_id),monsterNameCn:row.monster_name_cn?String(row.monster_name_cn):null,descriptionCn:String(row.description_cn??''),descriptionEn:String(row.description_en??''),evidenceStatus:String(row.evidence_status) as PalicoUnlock['evidenceStatus'],source:String(row.source??'')}))}
  private materialsFor(table:string,id:number):PalicoMaterial[]{return (this.db.prepare(`SELECT m.quantity,i.game_id,i.save_id,i.name_cn,i.name_en FROM ${table} m JOIN catalog_items i ON i.game_id=m.game_id AND i.save_id=m.item_save_id WHERE m.game_id=? AND m.equipment_id=? ORDER BY m.row_id`).all('mhgu',id) as Row[]).map(row=>({gameId:'mhgu',saveId:int(row.save_id),nameCn:String(row.name_cn),nameEn:String(row.name_en),quantity:int(row.quantity)}))}
}

function toType(row:Row):PalicoTypeSummary{return {gameId:'mhgu',typeId:int(row.type_id),typeKey:String(row.type_key),nameCn:String(row.name_cn),nameEn:String(row.name_en),nameJp:String(row.name_jp),descriptionCn:String(row.description_cn??'')}}
function toMove(row:Row):PalicoSupportMoveSummary{return {gameId:'mhgu',supportMoveId:int(row.support_move_id),nameCn:String(row.name_cn),nameEn:String(row.name_en),nameJp:String(row.name_jp),generationTier:nullableInt(row.generation_tier),generationGroup:row.generation_group?String(row.generation_group):null,role:String(row.role),teachable:bool(row.teachable),gaugeCost:nullableInt(row.gauge_cost),evidenceStatus:String(row.evidence_status) as PalicoSupportMoveSummary['evidenceStatus']}}
function toSkill(row:Row):PalicoSkillSummary{return {gameId:'mhgu',palicoSkillId:int(row.palico_skill_id),nameCn:String(row.name_cn),nameEn:String(row.name_en),nameJp:String(row.name_jp),generationTier:nullableInt(row.generation_tier),generationGroup:row.generation_group?String(row.generation_group):null,role:String(row.role),teachable:bool(row.teachable),memoryCost:nullableInt(row.memory_cost),learnLevel:nullableInt(row.learn_level),evidenceStatus:String(row.evidence_status) as PalicoSkillSummary['evidenceStatus']}}
function toWeapon(row:Row):PalicoWeaponSummary{return {gameId:'mhgu',kind:'weapon',equipmentId:int(row.equipment_id),dexId:int(row.dex_id),saveId:int(row.save_id),nameCn:String(row.name_cn),nameEn:String(row.name_en),nameJp:String(row.name_jp),rarity:int(row.rarity),attackType:String(row.attack_type) as 'cut'|'blunt',specializationId:int(row.specialization_id),specializationCn:String(row.specialization_cn),specializationEn:String(row.specialization_en),meleeAttack:int(row.melee_attack),meleeAffinity:int(row.melee_affinity),rangedAttack:int(row.ranged),rangedAffinity:int(row.ranged_affinity),specialAttackCn:row.special_attack_cn?String(row.special_attack_cn):null,specialAttackEn:row.special_attack_en?String(row.special_attack_en):null,specialAttackValue:nullableInt(row.special_attack_value),defense:int(row.defense),sharpnessId:int(row.sharpness_id) as PalicoWeaponSummary['sharpnessId'],price:int(row.price),iconPath:row.icon_path?String(row.icon_path):null}}
function toArmor(row:Row):PalicoArmorSummary{return {gameId:'mhgu',kind:'armor',equipmentId:int(row.equipment_id),dexId:int(row.dex_id),saveId:int(row.save_id),nameCn:String(row.name_cn),nameEn:String(row.name_en),nameJp:String(row.name_jp),part:String(row.part) as 'head'|'body',rarity:int(row.rarity),defense:int(row.defense),fireRes:int(row.fire_res),waterRes:int(row.water_res),thunderRes:int(row.thunder_res),iceRes:int(row.ice_res),dragonRes:int(row.dragon_res),price:int(row.price),iconPath:row.icon_path?String(row.icon_path):null}}
