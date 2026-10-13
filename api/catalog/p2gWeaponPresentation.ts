import type Database from 'better-sqlite3'
import type { P2gWeaponItemLink, P2gWeaponSpecial } from './p2gWeaponTypes'

// Native ammo codes were independently checked against P2G Japanese ammo
// observations. Resolve exact native item names; never assume item ID ordering.
const ammoNames: Record<string, string> = {}
for (const [code, ja, levels] of [
  ['normal', '通常弾', 3], ['pierce', '貫通弾', 3], ['pellet', '散弾', 3], ['crag', '徹甲榴弾', 3], ['clust', '拡散弾', 3],
  ['recovery', '回復弾', 2], ['poison', '毒弾', 2], ['paralysis', '麻痺弾', 2], ['sleep', '睡眠弾', 2],
] as const) for (let level = 1; level <= levels; level++) ammoNames[`${code}${level}`] = `LV${level} ${ja}`
Object.assign(ammoNames, { flame: '火炎弾', water: '水冷弾', thunder: '電撃弾', freeze: '氷結弾', dragon: '滅龍弾', tranq: '捕獲用麻酔弾', paint: 'ペイント弾', demon: '鬼人弾', armor: '硬化弾' })
const coatings = [['強撃ビン', 1], ['毒ビン', 2], ['麻痺ビン', 3], ['睡眠ビン', 4], ['接撃ビン', 5], ['ペイントビン', 6]] as const

export const p2gReloadLabels: Record<number, string> = { 0: '慢', 1: '稍慢', 2: '普通', 3: '稍快', 4: '快' }
export const p2gRecoilLabels: Record<number, string> = { 2: '中', 3: '稍小', 4: '小', 5: '极小' }
export const p2gRapidRecoilLabels: Record<number, string> = { 0: '小', 1: '中', 2: '中', 3: '大' }
export const p2gNoteLabels = ['', '白', '紫', '蓝', '黄', '红', '绿', '空']
export const p2gShellingLabels: Record<string, string> = { 通常: '通常', 拡散: '扩散', 放射: '放射' }

const hornEffectLabels: Record<string, string> = {
  移動速度UP: '移动速度提升', 攻撃力強化: '攻击力强化', 防御力強化: '防御力强化',
  体力回復: '体力回复', 体力増加: '体力增加', 回復速度: '回复速度', 強走効果: '强走效果',
  聴覚保護: '听觉保护', 風圧軽減: '风压减轻', 風圧無効: '风压无效', 風圧完全無効: '风压完全无效',
  寒さ無効: '寒冷无效', 暑さ無効: '炎热无效', 気絶無効: '昏厥无效', 麻痺無効: '麻痹无效',
  火耐性強化: '火耐性强化', 水耐性強化: '水耐性强化', 雷耐性強化: '雷耐性强化', 氷耐性強化: '冰耐性强化', 龍耐性強化: '龙耐性强化',
  属性攻撃力強化: '属性攻击力强化', 精霊王の加護: '精灵王的加护', 千里眼: '千里眼', 耐震: '耐震', 高周波: '高周波',
  消臭: '除臭', 解毒: '解毒', 耐雪: '耐雪',
}

// Label translation is independent of the optional, reviewed performance supplement.
export function p2gHornEffectLabel(japanese: string): string {
  const parts = japanese.split('＆').map(part => {
    const match = part.match(/^(.*?)(【[小中大]】)?$/)
    if (!match) return null
    const label = hornEffectLabels[match[1]]
    return label ? label + (match[2] || '') : null
  })
  return parts.every(Boolean) ? parts.join('／') : japanese
}

export function p2gWeaponItemResolver(db: Database.Database): (special: P2gWeaponSpecial) => P2gWeaponSpecial {
  const items = new Map<string, P2gWeaponItemLink | null>()
  const resolve = (ja: string): P2gWeaponItemLink | null => {
    if (items.has(ja)) return items.get(ja)!
    const rows = db.prepare('SELECT item_id,name_cn,name_jp,name_en FROM catalog_items WHERE name_jp=? AND is_placeholder=0').all(ja) as { item_id: number; name_cn: string; name_jp: string; name_en: string }[]
    if (rows.length > 1) throw new Error(`P2G 弹药／瓶道具身份不唯一：${ja}`)
    const r = rows[0], item = r ? { gameId: 'mhp2g' as const, itemId: r.item_id, nameCn: r.name_cn, nameJp: r.name_jp, nameEn: r.name_en } : null
    items.set(ja, item); return item
  }
  return special => special.kind === 'bowgun' ? { ...special, ammo: special.ammo.map(a => ({ ...a, item: ammoNames[a.code] ? resolve(ammoNames[a.code]) : null })) }
    : special.kind === 'bow' ? { ...special, coatings: coatings.map(([ja, bit]) => ({ item: resolve(ja), nameJp: ja, available: Boolean(special.coatingMaskRaw & (1 << bit)) })) }
      : special
}

export function p2gSpecialSummary(s: P2gWeaponSpecial): string[] {
  if (s.kind === 'gunlance') return [`${p2gShellingLabels[s.shelling.typeJa] || s.shelling.typeJa} Lv.${s.shelling.level}`]
  if (s.kind === 'huntingHorn') return [`音色 ${s.notes.map(n => p2gNoteLabels[n] || n).join('·')}`]
  if (s.kind === 'bowgun') return [`装填${p2gReloadLabels[s.reloadRaw] || '未知'}`, `反动${p2gRecoilLabels[s.recoilRaw] || '未知'}`]
  if (s.kind === 'bow') return [`基础 ${s.baseChargeCount} 段`, ...s.charges.filter(c => c.available).map(c => `蓄力${c.level} ${({ rapid: '连射', pierce: '贯通', scatter: '扩散' } as Record<string, string>)[c.typeCode] || c.typeCode}${c.shotLevel}${c.requiresLoadUp ? '（装填数 UP）' : ''}`)]
  return []
}
