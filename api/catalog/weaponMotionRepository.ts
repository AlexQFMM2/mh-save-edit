import type Database from 'better-sqlite3'
import type { BowWeaponMotion, BowgunWeaponMotion, MeleeWeaponMotion, WeaponMotionCatalogResult, WeaponMotionFacets, WeaponMotionFilters, WeaponMotionHit, WeaponMotionVariant, WeaponStyleId, WeaponTypeDefinition } from './types'

type Row=Record<string,unknown>
const styles: WeaponMotionFacets['styles']=[
  {id:'guild',nameCn:'公会',nameEn:'Guild'},{id:'striker',nameCn:'强袭',nameEn:'Striker'},
  {id:'aerial',nameCn:'空战',nameEn:'Aerial'},{id:'adept',nameCn:'武士道',nameEn:'Adept'},
  {id:'alchemy',nameCn:'炼金',nameEn:'Alchemy'},{id:'valor',nameCn:'勇气',nameEn:'Valor'},
]
const num=(value:unknown):number|null=>value==null?null:Number(value)
const text=(value:unknown)=>value==null?'':String(value)
const bool=(value:unknown)=>Number(value)!==0

export class WeaponMotionCatalogRepository {
  constructor(private readonly db:Database.Database){}

  getWeaponMotionFacets(gameId:'mhgu'):WeaponMotionFacets{
    if(gameId!=='mhgu')throw new Error('当前游戏没有动作值图鉴')
    const weaponTypes=(this.db.prepare("SELECT * FROM catalog_weapon_types WHERE game_id='mhgu' AND type_id BETWEEN 1 AND 14 ORDER BY sort_order").all() as Row[]).map((row):WeaponTypeDefinition=>({gameId:'mhgu',typeId:Number(row.type_id),saveType:Number(row.save_type),nameCn:text(row.name_cn),nameEn:text(row.name_en),sortOrder:Number(row.sort_order),kind:Number(row.type_id)===14?'bow':[12,13].includes(Number(row.type_id))?'bowgun':[6].includes(Number(row.type_id))?'huntingHorn':Number(row.type_id)===8?'gunlance':[9,10].includes(Number(row.type_id))?'phialWeapon':Number(row.type_id)===11?'insectGlaive':'standardMelee'}))
    return {weaponTypes,styles,categories:['standard','style','hunterArt']}
  }

  searchWeaponMotions(filters:WeaponMotionFilters):WeaponMotionCatalogResult{
    if(filters.gameId!=='mhgu')throw new Error('当前游戏没有动作值图鉴')
    const where=["m.game_id='mhgu'",'m.weapon_type_id=?'];const values:unknown[]=[filters.weaponTypeId]
    if(filters.query){const like=`%${filters.query.trim()}%`;where.push('(m.name_cn LIKE ? OR m.name_en LIKE ? OR m.name_jp LIKE ? OR m.notes LIKE ? OR m.native_action_id LIKE ?)');values.push(like,like,like,like,like)}
    if(filters.category){where.push('m.category=?');values.push(filters.category)}
    if(filters.styleIds?.length){where.push(`EXISTS (SELECT 1 FROM catalog_weapon_motion_styles ms WHERE ms.game_id=m.game_id AND ms.motion_key=m.motion_key AND ms.style_id IN (${filters.styleIds.map(()=>'?').join(',')}))`);values.push(...filters.styleIds)}
    const direction=filters.direction==='desc'?'DESC':'ASC'
    const order=filters.sort==='motionValue'?`m.motion_value_total IS NULL,m.motion_value_total ${direction},m.source_order ASC`:filters.sort==='stun'?`m.stun IS NULL,m.stun ${direction},m.source_order ASC`:filters.sort==='exhaust'?`m.exhaust IS NULL,m.exhaust ${direction},m.source_order ASC`:`m.source_order ${direction}`
    const rows=this.db.prepare(`SELECT m.* FROM catalog_weapon_motions m WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 500`).all(...values) as Row[]
    const weaponType=this.getWeaponMotionFacets('mhgu').weaponTypes.find(type=>type.typeId===filters.weaponTypeId)
    if(!weaponType)throw new Error(`未知武器类型：${filters.weaponTypeId}`)
    const motions=rows.map(row=>this.decorate(row))
    const kind=filters.weaponTypeId===14?'bow':[12,13].includes(filters.weaponTypeId)?'bowgun':'melee'
    return {kind,weaponType,motions:motions as never}
  }

  private decorate(row:Row):MeleeWeaponMotion|BowgunWeaponMotion|BowWeaponMotion{
    const motionKey=text(row.motion_key)
    const styleRows=this.db.prepare("SELECT style_id FROM catalog_weapon_motion_styles WHERE game_id='mhgu' AND motion_key=? ORDER BY CASE style_id WHEN 'guild' THEN 1 WHEN 'striker' THEN 2 WHEN 'aerial' THEN 3 WHEN 'adept' THEN 4 WHEN 'alchemy' THEN 5 ELSE 6 END").all(motionKey) as Row[]
    const variants=(this.db.prepare("SELECT * FROM catalog_weapon_motion_variants WHERE game_id='mhgu' AND motion_key=? ORDER BY variant_id").all(motionKey) as Row[]).map((variant):WeaponMotionVariant=>({variantId:text(variant.variant_id),labelCn:text(variant.label_cn),conditionCn:text(variant.condition_cn),styleId:(variant.style_id?text(variant.style_id):null) as WeaponStyleId|null,motionValueTotal:num(variant.motion_value_total),hits:(this.db.prepare("SELECT * FROM catalog_weapon_motion_hits WHERE game_id='mhgu' AND motion_key=? AND variant_id=? ORDER BY sequence").all(motionKey,variant.variant_id) as Row[]).map((hit):WeaponMotionHit=>({sequence:Number(hit.sequence),motionValue:num(hit.motion_value),attackType:hit.attack_type==null?null:text(hit.attack_type),sharpnessModifier:num(hit.sharpness_modifier),exhaust:num(hit.exhaust),stun:num(hit.stun),isDamage:bool(hit.is_damage)}))}))
    const base={gameId:'mhgu' as const,motionKey,weaponTypeId:Number(row.weapon_type_id),nativeActionId:text(row.native_action_id),nameCn:text(row.name_cn),nameEn:text(row.name_en),nameJp:text(row.name_jp),category:text(row.category) as MeleeWeaponMotion['category'],styles:styleRows.map(value=>text(value.style_id) as WeaponStyleId),hitCountMin:Number(row.hit_count_min),hitCountMax:Number(row.hit_count_max),motionValueMin:num(row.motion_value_min),motionValueMax:num(row.motion_value_max),motionValueTotal:num(row.motion_value_total),notes:text(row.notes),hunterArtId:num(row.hunter_art_id),evidenceStatus:text(row.evidence_status),variants}
    if(text(row.result_kind)==='bowgun'){
      const extra=this.db.prepare("SELECT * FROM catalog_bowgun_motion_values WHERE game_id='mhgu' AND motion_key=?").get(motionKey) as Row
      return {...base,resultKind:'bowgun',projectileKind:text(extra?.projectile_kind),rapidFireModifier:num(extra?.rapid_fire_modifier),siegeModifier:num(extra?.siege_modifier),nativeModifierText:text(extra?.native_modifier_text)}
    }
    if(text(row.result_kind)==='bow'){
      const extra=this.db.prepare("SELECT * FROM catalog_bow_motion_values WHERE game_id='mhgu' AND motion_key=?").get(motionKey) as Row
      return {...base,resultKind:'bow',shotType:extra?.shot_type==null?null:text(extra.shot_type),chargeLevel:num(extra?.charge_level),chargeModifier:num(extra?.charge_modifier),coatingModifier:num(extra?.coating_modifier),distanceModifier:extra?.distance_modifier==null?null:text(extra.distance_modifier)}
    }
    return {...base,resultKind:'melee',attackType:row.attack_type==null?null:text(row.attack_type),sharpnessModifier:num(row.sharpness_modifier),exhaust:num(row.exhaust),stun:num(row.stun)}
  }
}
