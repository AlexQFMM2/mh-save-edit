import type Database from 'better-sqlite3'
import type { ArmorCatalogFacets, PageResult } from './types'
import type { P2gArmorDetail, P2gArmorFilters, P2gArmorIdentity, P2gArmorRecipe, P2gArmorSetFilters, P2gArmorSetSummary, P2gArmorSummary } from './p2gArmorTypes'
import { normalizeCatalogSearch as normalize } from './questRepository'

type StoredArmor = Omit<P2gArmorDetail, 'recipes'>
type StoredSet = { set_key: string; sort_order: number; detail_json: string }
type Member = { set_key: string; combat: 'blademaster'|'gunner'; part: P2gArmorSummary['part']; armor_key: string }
const partOrder = ['head','chest','arms','waist','legs']
const order = (a: P2gArmorSummary, b: P2gArmorSummary) => partOrder.indexOf(a.part) - partOrder.indexOf(b.part) || a.nativeIndex - b.nativeIndex
const summary = (a: StoredArmor): P2gArmorSummary => {
  const { nameSource: _source, nativeRowSha256: _hash, maxBeforeFinalUnlock: _cap, acquisition: _acquisition, ...s } = a
  return s
}
const paginate = <T,>(items: T[], filters: {page?:number;pageSize?:number}): PageResult<T> => {
  const page = Math.max(1,filters.page??1), pageSize = Math.min(100,Math.max(1,filters.pageSize??100))
  return {items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,pageSize,hasNext:page*pageSize<items.length}
}
export const hasP2gArmors = (db: Database.Database) => (db.prepare("SELECT value FROM meta WHERE key='armor_schema'").get() as {value:string}|undefined)?.value === 'mhp2g-armors-v1'

export class P2gArmorCatalogRepository {
  private armors?: Map<string,StoredArmor>
  private aliases = new Map<string,string>()
  private recipes?: P2gArmorRecipe[]
  constructor(private readonly db: Database.Database) {
    if (!hasP2gArmors(db)) throw new Error('P2G 防具资料尚未安装，请构建并安装防具资料库后重启应用；其他图鉴仍可使用。')
  }
  private all() {
    if (!this.armors) {
      const rows=this.db.prepare('SELECT armor_key,legacy_alias,detail_json FROM p2g_armors ORDER BY part,native_index').all() as {armor_key:string;legacy_alias:string;detail_json:string}[]
      this.armors=new Map(rows.map(r=>[r.armor_key,JSON.parse(r.detail_json) as StoredArmor]))
      this.aliases=new Map(rows.map(r=>[r.armor_key,r.legacy_alias]))
    }
    return this.armors
  }
  private allRecipes(): P2gArmorRecipe[] {
    if (this.recipes) return this.recipes
    const materials=new Map<string,P2gArmorRecipe['materials']>()
    for(const m of this.db.prepare('SELECT m.*,i.name_cn,i.name_jp,i.name_en FROM p2g_armor_materials m JOIN catalog_items i USING(item_id) ORDER BY recipe_key,position').all() as {recipe_key:string;position:number;item_id:number;quantity:number;name_cn:string;name_jp:string;name_en:string}[]) {
      materials.set(m.recipe_key,[...(materials.get(m.recipe_key)??[]),{gameId:'mhp2g',itemId:m.item_id,position:m.position,quantity:m.quantity,nameCn:m.name_cn,nameJp:m.name_jp,nameEn:m.name_en}])
    }
    this.recipes=(this.db.prepare('SELECT * FROM p2g_armor_recipes ORDER BY recipe_key').all() as {recipe_key:string;armor_key:string;cost:number}[]).map(r=>{
      const a=this.all().get(r.armor_key)
      if(!a)throw new Error(`防具配方端点缺失：${r.armor_key}`)
      return {recipeKey:r.recipe_key,cost:r.cost,materials:materials.get(r.recipe_key)??[],armor:{gameId:'mhp2g',armorKey:a.armorKey,part:a.part,nameCn:a.nameCn,nameJp:a.nameJp,nameEn:a.nameEn}}
    })
    return this.recipes
  }
  private matching(filters: P2gArmorFilters): P2gArmorSummary[] {
    const all=[...this.all().values()],q=normalize(filters.query??''),hits=new Map<string,string>()
    if(q)for(const r of this.allRecipes()) {
      const m=r.materials.find(m=>normalize(`${m.nameCn} ${m.nameJp} ${m.nameEn}`).includes(q))
      if(m)hits.set(r.armor.armorKey,`命中：制作材料·${m.nameCn||m.nameJp}`)
    }
    return all.flatMap(a=>{
      if(filters.targetArmorKey)return filters.targetArmorKey===a.armorKey?[summary(a)]:[]
      if((filters.part&&a.part!==filters.part)||(filters.combat&&a.combat!==filters.combat&&a.combat!=='both')||(filters.gender&&a.gender!==filters.gender&&a.gender!=='both')||(filters.rarity!=null&&a.rarity!==filters.rarity)||(filters.slots!=null&&a.slots!==filters.slots)||(filters.skillId!=null&&!a.skills.some(s=>s.skillId===filters.skillId)))return []
      const own=normalize(`${a.nameCn} ${a.nameJp} ${a.nameEn} ${a.armorKey}`).includes(q)
      const skill=q?a.skills.find(s=>normalize(`${s.nameCn} ${s.nameJp} ${s.nameEn}`).includes(q)):undefined
      const alias=q&&normalize(this.aliases.get(a.armorKey)??'').includes(q)
      const reason=hits.get(a.armorKey)??(skill?`命中：技能·${skill.nameCn}`:alias?`命中：旧译名·${this.aliases.get(a.armorKey)}`:undefined)
      return !q||own||reason?[{...summary(a),...(!own&&reason?{matchReason:reason}:{})}]:[]
    })
  }
  searchArmors(filters: P2gArmorFilters): PageResult<P2gArmorSummary> {
    const items=this.matching(filters),direction=filters.direction==='desc'?-1:1
    const value=(a:P2gArmorSummary) => filters.sort==='skillPoints'?(a.skills.find(s=>s.skillId===filters.skillId)?.points??0):a[(filters.sort??'nativeIndex') as 'rarity'|'slots'|'baseDefense'|'maxDefense'|'fireRes'|'waterRes'|'thunderRes'|'iceRes'|'dragonRes']
    items.sort((a,b)=>direction*(filters.sort==='name'?a.nameCn.localeCompare(b.nameCn,'zh-CN'):!filters.sort||filters.sort==='nativeId'?order(a,b):value(a)-value(b))||order(a,b))
    return paginate(items,filters)
  }
  searchArmorSets(filters: P2gArmorSetFilters): PageResult<P2gArmorSetSummary> {
    const {sort,...common}=filters, matches=new Map(this.matching(common).map(a=>[a.armorKey,a]))
    const unqueried=new Set(this.matching({...common,query:undefined}).map(a=>a.armorKey)),query=normalize(filters.query??'')
    const members=this.db.prepare('SELECT * FROM p2g_armor_members ORDER BY set_key,combat,part').all() as Member[]
    const items=(this.db.prepare('SELECT * FROM p2g_armor_sets ORDER BY sort_order').all() as StoredSet[]).flatMap(s=>{
      const data=JSON.parse(s.detail_json) as {nameCn:string;nameJp:string;gender:string},own=members.filter(m=>m.set_key===s.set_key)
      if(filters.gender&&data.gender!==filters.gender&&data.gender!=='both')return []
      if(filters.combat&&filters.combat!=='both'&&!own.some(m=>m.combat===filters.combat))return []
      const titleHit=query&&normalize(`${data.nameCn} ${data.nameJp}`).includes(query)
      const matched=own.find(m=>matches.has(m.armor_key))??(titleHit?own.find(m=>unqueried.has(m.armor_key)):undefined)
      if(!matched)return []
      const rows: P2gArmorSetSummary['rows'] = (['blademaster','gunner'] as const).map(combat=>({combat,nameCn:own.some(m=>m.combat===combat)?data.nameCn:'',members:Object.fromEntries(own.filter(m=>m.combat===combat).map(m=>[m.part,summary(this.all().get(m.armor_key)!)]))}))
      const armorRows=rows.map(r=>Object.values(r.members).filter((a):a is P2gArmorSummary=>a!=null))
      const total=(key:'slots'|'baseDefense'|'maxDefense')=>Math.max(...armorRows.map(row=>row.reduce((sum,a)=>sum+a[key],0)))
      const result:P2gArmorSetSummary={gameId:'mhp2g',setKey:s.set_key,sortOrder:s.sort_order,nameJp:data.nameJp,rows,rarity:Math.max(...armorRows.flat().map(a=>a.rarity)),totalSlots:total('slots'),totalBaseDefense:total('baseDefense'),totalMaxDefense:total('maxDefense'),matchReason:matches.get(matched.armor_key)?.matchReason}
      return [result]
    })
    const dir=filters.direction==='desc'?-1:1
    const skillTotal=(s:P2gArmorSetSummary)=>Math.max(...s.rows.filter(r=>Object.keys(r.members).length).map(r=>Object.values(r.members).reduce((sum,a)=>sum+(a?.skills.find(p=>p.skillId===filters.skillId)?.points??0),0)))
    const value=(s:P2gArmorSetSummary)=>sort==='rarity'?s.rarity:sort==='slots'?s.totalSlots:sort==='baseDefense'?s.totalBaseDefense:sort==='maxDefense'?s.totalMaxDefense:sort==='skillPoints'?skillTotal(s):s.sortOrder
    items.sort((a,b)=>dir*(sort==='name'?(a.rows.find(r=>r.nameCn)?.nameCn??'').localeCompare(b.rows.find(r=>r.nameCn)?.nameCn??'','zh-CN'):value(a)-value(b))||a.sortOrder-b.sortOrder)
    return paginate(items,filters)
  }
  getArmor(identity:P2gArmorIdentity):P2gArmorDetail|null {
    const a=identity.gameId==='mhp2g'?this.all().get(identity.armorKey):undefined
    return a?{...a,recipes:this.allRecipes().filter(r=>r.armor.armorKey===a.armorKey)}:null
  }
  getArmorFacets():ArmorCatalogFacets {
    const all=[...this.all().values()],numbers=(k:'slots'|'rarity')=>[...new Set(all.map(a=>a[k]))].sort((a,b)=>a-b)
    const skills=new Map(all.flatMap(a=>a.skills.map(s=>[s.skillId,{skillId:s.skillId,nameCn:s.nameCn,nameEn:s.nameEn,nameJp:s.nameJp}] as const)))
    return {rarities:numbers('rarity'),slots:numbers('slots'),skills:[...skills.values()].sort((a,b)=>a.skillId-b.skillId)}
  }
  getItemArmorUsages(itemId:number):P2gArmorRecipe[] { return this.allRecipes().filter(r=>r.materials.some(m=>m.itemId===itemId)) }
  getMaterialItemMatches(query?:string):Map<number,string> {
    const q=normalize(query??''),hits=new Map<number,string>()
    if(!q)return hits
    const keys=new Set([...this.all().values()].filter(a=>normalize(`${a.nameCn} ${a.nameJp} ${a.armorKey} ${this.aliases.get(a.armorKey)}`).includes(q)).map(a=>a.armorKey))
    for(const r of this.allRecipes())if(keys.has(r.armor.armorKey))for(const m of r.materials)hits.set(m.itemId,`命中：防具材料·${r.armor.nameCn}`)
    return hits
  }
}
