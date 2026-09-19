import {normalizeSkillName} from '../map_skill_wiki.mjs'

// Source-only exceptions. Runtime identity validation remains exact and never
// rewrites catalog IDs, thresholds or original names. Unknown exceptions fail.
export function matchesWikiSourceIdentity(entry, source) {
  if(source.game!==entry.gameId)return false
  const target=normalizeSkillName(entry.nameJp), name=normalizeSkillName(source.nameJp)
  if(!entry.sourceMapping)return source.threshold===entry.threshold&&name===target
  if(!entry.reviewNote?.trim())return false
  switch(entry.sourceMapping){
    case 'torso-up-special':
      return ['mh3g','mh4g','mhgu'].includes(entry.gameId)&&entry.specialMarker==='Torso Up'&&entry.threshold===1&&
        ['胴系統倍加','胴系統倍化'].includes(target)&&['胴系統倍加','胴系統倍化'].includes(name)&&
        (source.threshold===0||(source.threshold===null&&source.point==='E'))
    case 'mh4g-carving-alias':
      return entry.gameId==='mh4g'&&target==='剥ぎ取り名人'&&name==='剥ぎ取り達人'&&entry.threshold===15&&source.threshold===15&&source.treeJp==='剥ぎ取り'
    case 'mh3g-wind-alias':
      return entry.gameId==='mh3g'&&target===normalizeSkillName('風圧【大】無効')&&name==='風圧完全無効'&&entry.threshold===15&&source.threshold===15&&source.treeJp==='風圧'
    case 'mh4g-expert-catalog-note':
      // This is a discrepancy annotation, NOT an alias or effect mapping.
      return entry.gameId==='mh4g'&&target==='見切り+4'&&entry.threshold===25&&name==='見切りマスター'&&source.threshold===30&&source.treeJp==='達人'&&entry.descriptionCn?.startsWith('【资料差异说明】')
    default:return false
  }
}
