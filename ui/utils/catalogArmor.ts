import type { P3ArmorDetail, P3ArmorSetSummary, P3ArmorSummary, P3ArmorScope } from '../../api/catalog/p3ArmorTypes'
import { p3ArmorKeySchema } from '../../api/catalog/p3ArmorSchemas'
import type { ArmorCatalogFilters, ArmorDetail, ArmorSetFilters, ArmorSetMember, ArmorSetSummary, ArmorSummary, ArmorCatalogGameId } from '../../api/catalog/types'
import type { P2gArmorDetail, P2gArmorSetSummary, P2gArmorSummary } from '../../api/catalog/p2gArmorTypes'

export type CatalogArmorSummary = ArmorSummary | P2gArmorSummary | P3ArmorSummary
export type CatalogArmorDetail = ArmorDetail | P2gArmorDetail | P3ArmorDetail
export type CatalogArmorSet = ArmorSetSummary | P2gArmorSetSummary | P3ArmorSetSummary
export type CatalogArmorKey = number | string
export const armorKey = (armor: ArmorSetMember | P2gArmorSummary | P3ArmorSummary) => 'armorKey' in armor ? armor.armorKey : armor.dexId
export function parseArmorKey(value:string|null,gameId:ArmorCatalogGameId):CatalogArmorKey|undefined {
  if(gameId==='mhp3')return value&&p3ArmorKeySchema.safeParse(value).success?value:undefined
  if(gameId==='mhp2g')return value&&/^armor_(head|chest|arms|waist|legs):[1-9]\d*$/.test(value)?value:undefined
  return value&&/^[1-9]\d*$/.test(value)&&Number(value)<=65535?Number(value):undefined
}
export function getCatalogArmor(gameId:ArmorCatalogGameId,key:CatalogArmorKey):Promise<CatalogArmorDetail|null> {
  if(gameId==='mhp3')return window.mhSaveEditor!.catalog.getArmor({gameId,armorKey:String(key)})
  return gameId==='mhp2g'?window.mhSaveEditor!.catalog.getArmor({gameId,armorKey:String(key)}):window.mhSaveEditor!.catalog.getArmor({gameId,dexId:Number(key)})
}
type Common = Omit<ArmorCatalogFilters,'gameId'|'targetDexId'|'sort'> & { scope?:P3ArmorScope; target?:CatalogArmorKey;sort?:ArmorCatalogFilters['sort']|'nativeId' }
export async function searchCatalogArmors(gameId:ArmorCatalogGameId,filters:Common) {
  const {target,sort,scope,...common}=filters
  if(gameId==='mhp3') {
    const {includePlaceholders:_debug,...native}=common
    return window.mhSaveEditor!.catalog.searchArmors({...native,gameId,scope,targetArmorKey:target==null?undefined:String(target),sort:sort==='dexId'?'nativeId':sort})
  }
  if(gameId==='mhp2g') {
    const {includePlaceholders:_debug,...native}=common
    return window.mhSaveEditor!.catalog.searchArmors({...native,gameId,targetArmorKey:target==null?undefined:String(target),sort:sort==='dexId'?'nativeId':sort})
  }
  return window.mhSaveEditor!.catalog.searchArmors({...common,gameId,targetDexId:target==null?undefined:Number(target),sort:sort==='nativeId'?'dexId':sort})
}
export async function searchCatalogArmorSets(gameId:ArmorCatalogGameId,filters:Omit<Common,'sort'|'part'>&{sort?:ArmorSetFilters['sort']}) {
  const {target,scope,...common}=filters
  if(gameId==='mhp3') {
    const {includePlaceholders:_debug,...native}=common
    return window.mhSaveEditor!.catalog.searchArmorSets({...native,gameId,scope,targetArmorKey:target==null?undefined:String(target)})
  }
  if(gameId==='mhp2g') {
    const {includePlaceholders:_debug,...native}=common
    return window.mhSaveEditor!.catalog.searchArmorSets({...native,gameId,targetArmorKey:target==null?undefined:String(target)})
  }
  return window.mhSaveEditor!.catalog.searchArmorSets({...common,gameId,targetDexId:target==null?undefined:Number(target)})
}
