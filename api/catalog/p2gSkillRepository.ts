import { hasP2gDecorations } from './p2gDecorationLinks'
import type Database from 'better-sqlite3'
import type { PageResult, SkillActivationLink, SkillCatalogFacets, SkillCatalogFilters, SkillDetail, SkillSummary } from './types'
import type { P2gSkillEquipmentDetail, P2gSkillEquipmentSummary } from './p2gSkillTypes'

type StoredActivation = { activationKey: string; nativeTextOrdinal: number; nameCn: string; nameJp: string; threshold: number; direction: 'positive'|'negative'; descriptionCn: string; descriptionJp: string; components: (SkillActivationLink & { nameJp: string; skillId: number })[] }
type StoredSkill = { skillId: number; nameCn: string; nameJp: string; nameSource: string; sourceUrl: string; activations: StoredActivation[]; specialRule: {descriptionCn:string;descriptionJp:string}|null }
type StoredEquipment = Omit<P2gSkillEquipmentDetail, 'gameId'|'skills'|'recipes'> & { isPlaceholder: boolean; skills: { skillId:number;points:number }[]; recipes:{recipeKey:string;materials:{itemId:number;quantity:number}[]}[] }
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '')
const matchLabel: Record<string,string> = {name:'技能系',activation:'发动技能',effect:'效果说明',component:'复合技能',armor:'相关防具',decoration:'相关装饰品'}
export const hasP2gSkills = (db: Database.Database) => Boolean(db.prepare("SELECT 1 FROM meta WHERE key='skill_schema' AND value='mhp2g-skills-v1'").get())

export class P2gSkillCatalogRepository {
  constructor(private readonly db: Database.Database) {
    if (!hasP2gSkills(db)) throw new Error('P2G 技能资料尚未安装，请构建并安装技能资料库后重启应用；道具、怪物和任务图鉴仍可使用。')
  }
  private stored(): StoredSkill[] { return (this.db.prepare('SELECT detail_json FROM p2g_skills ORDER BY skill_id').all() as {detail_json:string}[]).map(row=>JSON.parse(row.detail_json)) }
  private equipment(skillId: number): P2gSkillEquipmentSummary[] {
    return (this.db.prepare('SELECT e.detail_json,p.points FROM p2g_skill_points p JOIN p2g_skill_equipment e USING(equipment_key) WHERE p.skill_id=? AND e.is_placeholder=0 ORDER BY p.points DESC,e.equipment_key,p.position').all(skillId) as {detail_json:string;points:number}[]).map(row=>{
      const e=JSON.parse(row.detail_json) as StoredEquipment
      return {...(e.kind==='decoration'&&hasP2gDecorations(this.db)?{decorationItemId:e.itemId!}:{}),gameId:'mhp2g',equipmentKey:e.equipmentKey,kind:e.kind,nameCn:e.nameCn,nameJp:e.nameJp,nameSource:e.nameSource,slots:e.slots,iconPath:e.iconPath,part:e.part,points:row.points}
    })
  }
  searchSkills(filters: SkillCatalogFilters): PageResult<SkillSummary> {
    const page=Math.max(1,filters.page??1),pageSize=Math.max(1,Math.min(100,filters.pageSize??100)),q=normalize(filters.query??'')
    const hits=new Map<number,{kind:string;label:string}>()
    if(q) for(const hit of this.db.prepare('SELECT skill_id,kind,label FROM p2g_skill_search WHERE instr(normalized_text,?)>0 ORDER BY id').all(q) as {skill_id:number;kind:string;label:string}[])if(!hits.has(hit.skill_id))hits.set(hit.skill_id,hit)
    const rows=filters.gameId!=='mhp2g'?[]:this.stored().map(s=>{
      const equipment=this.equipment(s.skillId),hit=hits.get(s.skillId)
      return {gameId:'mhp2g' as const,skillId:s.skillId,nameCn:s.nameCn,nameEn:'',nameJp:s.nameJp,activationCount:s.activations.length,positiveActivationCount:s.activations.filter(a=>a.direction==='positive').length,negativeActivationCount:s.activations.filter(a=>a.direction==='negative').length,specialActivationCount:s.specialRule?1:0,armorCount:equipment.filter(e=>e.kind==='armor').length,decorationCount:equipment.filter(e=>e.kind==='decoration').length,talismanCount:0,isPlaceholder:false,match:hit?`命中：${matchLabel[hit.kind]}·${hit.label}`:undefined}
    }).filter(s=>filters.targetSkillId!=null?s.skillId===filters.targetSkillId:(!q||hits.has(s.skillId))&&(!filters.direction||s[`${filters.direction}ActivationCount`]>0)&&(!filters.source||filters.source==='all'||(filters.source==='armor'?s.armorCount:filters.source==='decoration'?s.decorationCount:0)>0))
    rows.sort((a,b)=>filters.sort==='name'?a.nameCn.localeCompare(b.nameCn,'zh-CN')||a.skillId-b.skillId:filters.sort==='activationCount'?b.activationCount-a.activationCount||a.skillId-b.skillId:a.skillId-b.skillId)
    return {items:rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,total:rows.length,hasNext:page*pageSize<rows.length}
  }
  getSkill(skillId: number): SkillDetail | null {
    const row=this.db.prepare('SELECT detail_json FROM p2g_skills WHERE skill_id=?').get(skillId) as {detail_json:string}|undefined
    if(!row)return null
    const s=JSON.parse(row.detail_json) as StoredSkill
    const activations=s.activations.map(a=>({...a,dexActivationId:null,nameEn:'',descriptionCn:'',descriptionEn:'',wikiDetail:{descriptionCn:a.descriptionCn,sourceUrl:s.sourceUrl,sourceVersion:'MHP2G',reviewNote:''},components:a.components.map(c=>({...c,nameEn:''}))}))
    return {gameId:'mhp2g',skillId:s.skillId,nameCn:s.nameCn,nameEn:'',nameJp:s.nameJp,descriptionCn:null,descriptionEn:null,descriptionJp:null,activations,components:activations.flatMap(a=>a.components),armors:[],decorations:[],talismans:[],p2g:{sourceUrl:s.sourceUrl,nameSource:s.nameSource,specialRule:s.specialRule,equipment:this.equipment(skillId)}}
  }
  getEquipment(key: string): P2gSkillEquipmentDetail | null {
    const row=this.db.prepare('SELECT detail_json FROM p2g_skill_equipment WHERE equipment_key=? AND is_placeholder=0').get(key) as {detail_json:string}|undefined
    if(!row)return null
    const e=JSON.parse(row.detail_json) as StoredEquipment
    const names=new Map(this.stored().map(s=>[s.skillId,s]))
    return {...e,...(e.kind==='decoration'&&hasP2gDecorations(this.db)?{decorationItemId:e.itemId!}:{}),gameId:'mhp2g',skills:e.skills.map(s=>({...s,nameCn:names.get(s.skillId)!.nameCn,nameJp:names.get(s.skillId)!.nameJp})),recipes:e.recipes.map(recipe=>({...recipe,materials:recipe.materials.map(m=>{
      const item=this.db.prepare('SELECT name_cn,name_jp FROM catalog_items WHERE item_id=?').get(m.itemId) as {name_cn:string;name_jp:string}
      return {item:{gameId:'mhp2g' as const,itemId:m.itemId,nameCn:item.name_cn,nameJp:item.name_jp},quantity:m.quantity}
    })}))}
  }
  getSkillFacets(): SkillCatalogFacets { return {directions:['positive','negative','special'],sources:['armor','decoration']} }
}
