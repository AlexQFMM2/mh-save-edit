import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ArmorDetail, PalicoArmorDetail, PalicoWeaponDetail, WeaponDetail } from '../../../api/catalog/types'
import type { SaveGameId as GameId } from '../../../api/save/types'
import type { SaveEquipmentCell } from '../../../api/save/types'
import { ArmorDetailPanel } from '../ArmorDetailPanel/ArmorDetailPanel'
import { ArmorAppearanceComparison } from '../ArmorAppearanceComparison/ArmorAppearanceComparison'
import { PalicoSharpnessLevel } from '../PalicoSharpnessLevel/PalicoSharpnessLevel'
import { WeaponCoreStats } from '../WeaponCoreStats/WeaponCoreStats'
import { WeaponTypeDetail } from '../WeaponTypeDetail/WeaponTypeDetail'
import { RelicEquipmentDetail } from '../RelicEquipmentDetail/RelicEquipmentDetail'
import { getCatalogWeapon, type CatalogWeaponDetail } from '../../utils/catalogWeapon'
import { getCatalogArmor, type CatalogArmorDetail } from '../../utils/catalogArmor'
import { WeaponDetailPanel } from '../WeaponDetailPanel/WeaponDetailPanel'
import './SaveEquipmentEmbeddedDetail.css'

type CatalogDetail =
  | { kind: 'weapon'; value: CatalogWeaponDetail }
  | { kind: 'armor'; value: CatalogArmorDetail }
  | { kind: 'palico-weapon'; value: PalicoWeaponDetail }
  | { kind: 'palico-armor'; value: PalicoArmorDetail }

export function SaveEquipmentEmbeddedDetail({ gameId, cell }: { gameId: GameId; cell: SaveEquipmentCell }) {
  const [detail, setDetail] = useState<CatalogDetail>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const request = useRef(0)

  useEffect(() => {
    const sequence = ++request.current
    setError(undefined)
    setDetail(undefined)
    const load = async (): Promise<CatalogDetail | undefined> => {
      if (gameId === 'mh4g' && cell.relic) return undefined
      if (cell.kind === 'weapon' && cell.weaponKey) {
        const value = await getCatalogWeapon(gameId, cell.weaponKey)
        return value ? { kind: 'weapon', value } : undefined
      }
      if (cell.kind === 'armor' && (cell.armorKey != null || cell.armorDexId != null)) {
        const value = await getCatalogArmor(gameId, cell.armorKey ?? cell.armorDexId!)
        return value ? { kind: 'armor', value } : undefined
      }
      if (cell.kind === 'palico-weapon' && cell.palicoEquipmentId != null) {
        const value = await window.mhSaveEditor.catalog.getPalicoWeapon({ gameId: 'mhgu', kind: 'weapon', equipmentId: cell.palicoEquipmentId })
        return value ? { kind: 'palico-weapon', value } : undefined
      }
      if ((cell.kind === 'palico-head' || cell.kind === 'palico-body') && cell.palicoEquipmentId != null) {
        const value = await window.mhSaveEditor.catalog.getPalicoArmor({ gameId: 'mhgu', kind: 'armor', equipmentId: cell.palicoEquipmentId })
        return value ? { kind: 'palico-armor', value } : undefined
      }
      return undefined
    }
    setLoading(true)
    void load().then(value => { if (sequence === request.current) setDetail(value) }).catch(cause => {
      if (sequence === request.current) { setDetail(undefined); setError(cause instanceof Error ? cause.message : '装备资料读取失败') }
    }).finally(() => { if (sequence === request.current) setLoading(false) })
    return () => { request.current += 1 }
  }, [cell.armorKey, cell.armorDexId, cell.kind, cell.palicoEquipmentId, cell.saveId, cell.slot, cell.weaponKey, cell.relic?.templateKey, gameId])

  return <div className={`save-equipment-embedded-detail${loading ? ' is-loading' : ''}`} aria-busy={loading}>
    {gameId === 'mhgu' && !cell.empty && cell.kind === 'armor' && (cell.appearanceId ?? 0) > 0 && <ArmorAppearanceComparison cell={cell} />}
    {gameId === 'mh4g' && cell.relic && <RelicEquipmentDetail cell={cell} />}
    {detail?.kind === 'weapon' && detail.value.gameId === 'mhp2g' && <section className="save-equipment-embedded-detail__catalog"><WeaponDetailPanel gameId="mhp2g" weapon={detail.value} loading={false} layout="embedded" sharpnessStage="base" allowCatalogWrite={false} /></section>}
    {detail?.kind === 'weapon' && detail.value.gameId !== 'mhp2g' && gameId !== 'mhp2g' && <section className="save-equipment-embedded-detail__catalog"><WeaponCoreStats weapon={detail.value} compact /><WeaponTypeDetail gameId={gameId} weapon={detail.value} sharpnessStage="base" />{detail.value.specialSummary.length > 0 && <p>{detail.value.specialSummary.join(' · ')}</p>}</section>}
    {detail?.kind === 'armor' && <section className="save-equipment-embedded-detail__catalog save-equipment-embedded-detail__armor-catalog"><ArmorDetailPanel armor={detail.value} loading={false} allowCatalogWrite={false} /></section>}
    {detail?.kind === 'palico-weapon' && <PalicoWeaponStats value={detail.value} />}
    {detail?.kind === 'palico-armor' && <PalicoArmorStats value={detail.value} />}
    {!cell.relic && !detail && loading && <p role="status" className="save-equipment-embedded-detail__state">正在读取图鉴属性…</p>}
    {!cell.relic && !detail && !loading && error && <p role="alert" className="save-equipment-embedded-detail__state is-error">{error}</p>}
    {!cell.relic && !detail && !loading && !error && !cell.empty && <p className="save-equipment-embedded-detail__state">当前实例没有可关联的图鉴属性；原始记录仍会完整保留。</p>}
    <details open className="save-equipment-embedded-detail__decorations"><summary>装饰品{cell.decorationLabels.length ? ` · ${cell.decorationLabels.length}` : ''}</summary>{cell.decorationLabels.length ? <ul>{cell.decorationLabels.map((value, index) => <li key={`${value.rawValue}-${index}`}><span>{value.nameCn}</span><small>{value.fixed ? '固定 / 内置' : `${value.slots ?? 0} 孔`}</small></li>)}</ul> : <p>未安装装饰品。</p>}</details>
    {cell.kind === 'charm' && <p className="save-equipment-embedded-detail__decoration-summary">技能：<span>{skill(cell.skill1NameCn, cell.skill1Id, cell.skill1Points)}</span>；<span>{skill(cell.skill2NameCn, cell.skill2Id, cell.skill2Points)}</span></p>}
  </div>
}

function skill(name: string | null, id: number | null, points: number | null) {
  if (!id) return '—'
  const pointText = points == null ? '' : ` ${points >= 0 ? '+' : ''}${points}`
  return `${name ?? `技能 #${id}`}${pointText}`
}

function PalicoWeaponStats({ value }: { value: PalicoWeaponDetail }) {
  return <section className="save-equipment-embedded-detail__palico"><dl><Stat label="攻击类型" value={value.attackType === 'cut' ? '斩击' : '打击'} /><Stat label="特化" value={value.specializationCn} /><Stat label="近战" value={`${value.meleeAttack} / 会心 ${signed(value.meleeAffinity)}%`} /><Stat label="远程" value={`${value.rangedAttack} / 会心 ${signed(value.rangedAffinity)}%`} /><Stat label="属性/异常" value={value.specialAttackCn ? `${value.specialAttackCn} ${value.specialAttackValue ?? ''}` : '无'} /><Stat label="斩味" value={<PalicoSharpnessLevel value={value.sharpnessId} />} /><Stat label="防御" value={value.defense} /><Stat label="稀有度" value={value.rarity} /></dl></section>
}

function PalicoArmorStats({ value }: { value: PalicoArmorDetail }) {
  return <section className="save-equipment-embedded-detail__palico"><dl><Stat label="部位" value={value.part === 'head' ? '头部' : '身体'} /><Stat label="防御" value={value.defense} /><Stat label="火耐性" value={signed(value.fireRes)} /><Stat label="水耐性" value={signed(value.waterRes)} /><Stat label="雷耐性" value={signed(value.thunderRes)} /><Stat label="冰耐性" value={signed(value.iceRes)} /><Stat label="龙耐性" value={signed(value.dragonRes)} /><Stat label="稀有度" value={value.rarity} /></dl></section>
}

function Stat({ label, value }: { label: string; value: ReactNode }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
const signed = (value: number) => value > 0 ? `+${value}` : String(value)
