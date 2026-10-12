import type Database from 'better-sqlite3'
import type { DecorationCatalogFacets, DecorationCatalogFilters, DecorationDetail, DecorationSummary, PageResult, P2gDecorationIdentity } from './types'
import { P2gSkillCatalogRepository } from './p2gSkillRepository'
import { normalizeCatalogSearch } from './questRepository'
import { hasP2gDecorations } from './p2gDecorationLinks'

type Entry = { detail: DecorationDetail & P2gDecorationIdentity; search: {text:string;reason:string}[] }
export class P2gDecorationCatalogRepository {
  private entries?: Entry[]
  constructor(private readonly db: Database.Database) {
    if(!hasP2gDecorations(db))throw new Error('P2G 装饰品资料尚未安装，请构建并安装装饰品资料库后重启应用；其他已安装图鉴仍可使用。')
  }
  private all(): Entry[] {
    if(this.entries)return this.entries
    const skills=new P2gSkillCatalogRepository(this.db)
    const names=new Map((this.db.prepare('SELECT skill_id,detail_json FROM p2g_skills').all() as {skill_id:number;detail_json:string}[]).map(r=>[r.skill_id,JSON.parse(r.detail_json) as {nameJp:string;activations:{nameCn:string;nameJp:string}[]}]))
    const rows=this.db.prepare('SELECT d.equipment_key,i.* FROM p2g_decorations d JOIN catalog_items i USING(item_id) ORDER BY item_id').all() as {equipment_key:string;item_id:number;name_cn:string;name_jp:string;icon_path:string;rarity:number|null;buy_price:number|null;sell_price:number|null}[]
    this.entries=rows.map(r=>{
      const e=skills.getEquipment(r.equipment_key)
      if(!e)throw new Error(`装饰品资料关系不完整：${r.item_id}`)
      const detail:Entry['detail']={gameId:'mhp2g',itemId:r.item_id,nameCn:r.name_cn,nameJp:r.name_jp,nameEn:'',slots:e.slots,price:null,iconPath:r.icon_path,isPlaceholder:false,dexId:null,itemDexId:null,itemSaveId:null,dexIds:[],mappingStatus:'native-item',
        p2g:{rarity:r.rarity,buyPrice:r.buy_price,sellPrice:r.sell_price,craftingCost:null,unlockCondition:null,nameSource:e.nameSource},
        skills:e.skills.map(s=>({...s,nameEn:'',activeSkillNameCn:null,activeSkillNameEn:null})),
        materials:e.recipes.flatMap((recipe,index)=>recipe.materials.map(m=>({...m.item,nameEn:'',quantity:m.quantity,recipeIndex:index+1})))}
      const search=[{text:`${r.name_cn} ${r.name_jp}`,reason:`命中：装饰品·${r.name_cn}`}]
      for(const s of e.skills){const n=names.get(s.skillId)!;search.push({text:`${s.nameCn} ${n.nameJp}`,reason:`命中：技能·${s.nameCn}`});for(const a of n.activations)search.push({text:`${a.nameCn} ${a.nameJp}`,reason:`命中：发动技能·${a.nameCn}`})}
      for(const m of detail.materials)search.push({text:`${m.nameCn} ${m.nameJp??''}`,reason:`命中：制作材料·${m.nameCn}`})
      return {detail,search:search.map(s=>({...s,text:normalizeCatalogSearch(s.text)}))}
    })
    return this.entries
  }
  getDecoration(identity:P2gDecorationIdentity):DecorationDetail|null {
    return identity.gameId==='mhp2g'?this.all().find(e=>e.detail.itemId===identity.itemId)?.detail??null:null
  }
  searchDecorations(filters:DecorationCatalogFilters):PageResult<DecorationSummary> {
    const page=Math.max(1,filters.page??1),pageSize=Math.max(1,Math.min(100,filters.pageSize??100)),q=normalizeCatalogSearch(filters.query??'')
    const numeric=/^(?:0x[\da-f]+|\d+)$/i.test(q)?Number(q):null
    const rows=filters.gameId!=='mhp2g'?[]:this.all().flatMap(e=>{
      const d=e.detail,hit=q?e.search.find(s=>s.text.includes(q)):undefined
      if(filters.targetItemId!=null) {if(d.itemId!==filters.targetItemId)return []}
      else if((q&&!hit&&d.itemId!==numeric)||(filters.slots!=null&&d.slots!==filters.slots)||(filters.skillId!=null&&!d.skills.some(s=>s.skillId===filters.skillId&&s.points>0)))return []
      return [{...d,matchReason:hit?.reason??(numeric===d.itemId?'命中：道具编号':undefined)}]
    })
    const points=(d:DecorationSummary)=>d.skills.find(s=>s.skillId===filters.skillId)?.points??0
    rows.sort((a,b)=>(filters.sort==='name'?a.nameCn.localeCompare(b.nameCn,'zh-CN'):filters.sort==='slots'?a.slots-b.slots:filters.sort==='skillPoints'&&filters.skillId!=null?points(b)-points(a)||a.slots-b.slots:0)||a.itemId-b.itemId)
    return {items:rows.slice((page-1)*pageSize,page*pageSize),total:rows.length,page,pageSize,hasNext:page*pageSize<rows.length}
  }
  getDecorationFacets():DecorationCatalogFacets {
    const skills=new Map<number,DecorationCatalogFacets['skills'][number]>()
    for(const e of this.all())for(const s of e.detail.skills)if(s.points>0){const row=this.db.prepare('SELECT detail_json FROM p2g_skills WHERE skill_id=?').get(s.skillId) as {detail_json:string};skills.set(s.skillId,{skillId:s.skillId,nameCn:s.nameCn,nameEn:'',nameJp:JSON.parse(row.detail_json).nameJp})}
    return {slots:[...new Set(this.all().map(e=>e.detail.slots))].sort(),skills:[...skills.values()].sort((a,b)=>a.nameCn.localeCompare(b.nameCn,'zh-CN'))}
  }
}
