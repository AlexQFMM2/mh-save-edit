import type { ArmorCatalogFilters, ArmorDetail, ArmorSetFilters, ArmorSetMember, ArmorSetSummary, ArmorSummary, CatalogGameId } from '../../api/catalog/types'
import type { P2gArmorDetail, P2gArmorSetSummary, P2gArmorSummary } from '../../api/catalog/p2gArmorTypes'

export type CatalogArmorSummary = ArmorSummary | P2gArmorSummary
export type CatalogArmorDetail = ArmorDetail | P2gArmorDetail
export type CatalogArmorSet = ArmorSetSummary | P2gArmorSetSummary
export type CatalogArmorKey = number | string
export const armorKey = (armor: ArmorSetMember | P2gArmorSummary) => armor.gameId === 'mhp2g' ? armor.armorKey : armor.dexId
export function parseArmorKey(value:string|null,gameId:CatalogGameId):CatalogArmorKey|undefined {
  if(gameId==='mhp2g')return value&&/^armor_(head|chest|arms|waist|legs):[1-9]\d*$/.test(value)?value:undefined
  return value&&/^[1-9]\d*$/.test(value)&&Number(value)<=65535?Number(value):undefined
}
export function getCatalogArmor(gameId:CatalogGameId,key:CatalogArmorKey):Promise<CatalogArmorDetail|null> {
  return gameId==='mhp2g'?window.mhSaveEditor!.catalog.getArmor({gameId,armorKey:String(key)}):window.mhSaveEditor!.catalog.getArmor({gameId,dexId:Number(key)})
}
type Common = Omit<ArmorCatalogFilters,'gameId'|'targetDexId'|'sort'> & { target?:CatalogArmorKey;sort?:ArmorCatalogFilters['sort']|'nativeId' }
export async function searchCatalogArmors(gameId:CatalogGameId,filters:Common) {
  const {target,sort,...common}=filters
  if(gameId==='mhp2g') {
    const {includePlaceholders:_debug,...native}=common
    return window.mhSaveEditor!.catalog.searchArmors({...native,gameId,targetArmorKey:target==null?undefined:String(target),sort:sort==='dexId'?'nativeId':sort})
  }
  return window.mhSaveEditor!.catalog.searchArmors({...common,gameId,targetDexId:target==null?undefined:Number(target),sort:sort==='nativeId'?'dexId':sort})
}
export async function searchCatalogArmorSets(gameId:CatalogGameId,filters:Omit<Common,'sort'|'part'>&{sort?:ArmorSetFilters['sort']}) {
  const {target,...common}=filters
  if(gameId==='mhp2g') {
    const {includePlaceholders:_debug,...native}=common
    return window.mhSaveEditor!.catalog.searchArmorSets({...native,gameId,targetArmorKey:target==null?undefined:String(target)})
  }
  return window.mhSaveEditor!.catalog.searchArmorSets({...common,gameId,targetDexId:target==null?undefined:Number(target)})
}
