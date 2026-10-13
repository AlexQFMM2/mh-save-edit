import { useEffect, useState } from 'react'
import type { LoadoutArmorCandidate, LoadoutDecoration, LoadoutGame, LoadoutRelicLookup, LoadoutWeaponCandidate } from '../../../api/loadout/types'
import { getCatalogArmor, type CatalogArmorDetail } from '../../utils/catalogArmor'
import { getCatalogWeapon, type CatalogWeaponDetail } from '../../utils/catalogWeapon'
import { ArmorDetailPanel } from '../ArmorDetailPanel/ArmorDetailPanel'
import { WeaponDetailPanel } from '../WeaponDetailPanel/WeaponDetailPanel'
import { RelicEquipmentEditor } from '../RelicEquipmentEditor/RelicEquipmentEditor'
import './EquipmentPickerPreview.css'

type Candidate = LoadoutWeaponCandidate | LoadoutArmorCandidate
type Props = {
  gameId: LoadoutGame
  candidate?: Candidate
  current?: Candidate | null
  relicLookups: LoadoutRelicLookup[]
  decorations: LoadoutDecoration[]
  onEdit(value: Candidate): void
  onOpenCatalog?: (path: string) => void
}
const delta = (value: number) => value > 0 ? `+${value}` : String(value)

/** Detail content and scroll ownership shared by all four loadout pickers. */
export function EquipmentPickerPreview({ gameId, candidate, current, relicLookups, decorations, onEdit, onOpenCatalog }: Props) {
  const [detail, setDetail] = useState<{ key: string; armor?: CatalogArmorDetail; weapon?: CatalogWeaponDetail }>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [lookups, setLookups] = useState(relicLookups)
  const [advancedState, setAdvancedState] = useState<'idle' | 'loading' | 'ready' | 'error'>(relicLookups.some(item => item.kind === 'equipment_lookup') ? 'ready' : 'idle')

  useEffect(() => {
    let active = true
    setDetail(undefined); setError(undefined); setLoading(false)
    if (!candidate || candidate.sourceKind !== 'catalog') return
    const key = candidate.candidateKey
    const read = async () => {
      setLoading(true)
      try {
        if (candidate.kind === 'weapon' && candidate.weaponKey) {
          const weapon = await getCatalogWeapon(gameId, candidate.weaponKey)
          if (active && weapon) setDetail({ key, weapon })
        } else if (candidate.kind === 'armor') {
          const identity = candidate.gameId === 'mhp2g' ? candidate.armorKey : candidate.dexId
          if (identity != null) {
            const armor = await getCatalogArmor(gameId, identity)
            if (active && armor) setDetail({ key, armor })
          }
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : '详情读取失败') }
      finally { if (active) setLoading(false) }
    }
    void read()
    return () => { active = false }
  }, [candidate, gameId, attempt])

  const needsLookups = candidate?.sourceKind === 'relicTemplate' && !lookups.some(item => item.kind === 'equipment_lookup')
  useEffect(() => {
    if (!needsLookups) return
    let active = true
    setAdvancedState('loading')
    void window.mhSaveEditor.loadout.getRelicLookups(gameId).then(values => {
      if (active) { setLookups(values); setAdvancedState(values.some(item => item.kind === 'equipment_lookup') ? 'ready' : 'error') }
    }).catch(() => { if (active) setAdvancedState('error') })
    return () => { active = false }
  }, [gameId, needsLookups])

  const armor = detail?.key === candidate?.candidateKey ? detail?.armor : undefined
  const weapon = detail?.key === candidate?.candidateKey ? detail?.weapon : undefined
  const difference = candidate && current ? candidate.kind === 'weapon' && current.kind === 'weapon'
    ? `攻击 ${delta((candidate.attack ?? 0) - (current.attack ?? 0))} · 孔位 ${delta(candidate.slots - current.slots)} · 防御 ${delta(candidate.defense - current.defense)}`
    : candidate.kind === 'armor' && current.kind === 'armor' ? `基础防御 ${delta(candidate.baseDefense - current.baseDefense)} · 最大防御 ${delta(candidate.maxDefense - current.maxDefense)} · 孔位 ${delta(candidate.slots - current.slots)}` : null : null
  const itemPath = (id: number) => `/game/${gameId}/catalog/items?target=${id}&item=${id}`

  return <aside className="equipment-picker-preview" aria-label="装备预览" aria-busy={loading}>
    {!candidate ? <p className="equipment-picker-preview__empty">从左侧选择装备查看详情。</p> : <>
      {error && <div className="equipment-picker-preview__error" role="alert">{error}<button className="equipment-picker-preview__retry" type="button" onClick={() => setAttempt(value => value + 1)}>重试</button></div>}
      {armor ? <ArmorDetailPanel armor={armor} loading={false} layout="embedded" allowCatalogWrite={false} onSelectItem={onOpenCatalog ? id => onOpenCatalog(itemPath(id)) : undefined} onSelectSkill={onOpenCatalog ? id => onOpenCatalog(`/game/${gameId}/catalog/skills?target=${id}&skill=${id}`) : undefined} /> : weapon ? <WeaponDetailPanel gameId={gameId} weapon={weapon} loading={false} layout="embedded" sharpnessStage="base" allowCatalogWrite={false} onSelectCatalogItem={onOpenCatalog ? item => onOpenCatalog(itemPath(item.gameId === 'mhp2g' ? item.itemId : item.saveId)) : undefined} onSelectWeapon={onOpenCatalog ? value => onOpenCatalog(`/game/${gameId}/catalog/weapons?target=${encodeURIComponent(value.weaponKey)}&weapon=${encodeURIComponent(value.weaponKey)}&type=${value.typeId}`) : undefined} /> : <>
        <h3 className="equipment-picker-preview__title">{candidate.nameCn}</h3>
        <p className="equipment-picker-preview__line">{candidate.nameEn || candidate.nameJp || '—'} · 稀有度 {candidate.rarity ?? '—'} · {candidate.slots} 孔</p>
        {loading && <p className="equipment-picker-preview__line" role="status">正在读取装备详情…</p>}
        {difference && <p className="equipment-picker-preview__difference">相对当前：{difference}</p>}
        {candidate.kind === 'weapon' ? <p className="equipment-picker-preview__line">攻击 {candidate.attack ?? '—'} · 会心 {candidate.affinity ?? '—'} · 防御 {candidate.defense} · {candidate.directlyProducible ? '可直接生产' : '不可直接生产'}</p> : <>
          <p className="equipment-picker-preview__line">防御 {candidate.baseDefense} / {candidate.maxDefense} · 火 {candidate.fireRes} 水 {candidate.waterRes} 雷 {candidate.thunderRes} 冰 {candidate.iceRes} 龙 {candidate.dragonRes}</p>
          <p className="equipment-picker-preview__line">{candidate.skills.map(point => `${point.nameCn} ${point.points > 0 ? '+' : ''}${point.points}`).join('、') || '无固有技能'}</p>
        </>}
      </>}
      {candidate.sourceKind === 'relicTemplate' && advancedState === 'loading' && <p className="equipment-picker-preview__empty" role="status">正在加载发掘参数…</p>}
      {candidate.sourceKind === 'relicTemplate' && advancedState === 'error' && <p className="equipment-picker-preview__error" role="alert">发掘参数选项尚未准备好，请重新构建本地配装资料。</p>}
      {candidate.sourceKind === 'relicTemplate' && advancedState === 'ready' && <RelicEquipmentEditor candidate={candidate} lookups={lookups} decorations={decorations} onChange={onEdit} />}
    </>}
  </aside>
}
