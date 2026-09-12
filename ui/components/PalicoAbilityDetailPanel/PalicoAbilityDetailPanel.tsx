import type { PalicoSkillDetail, PalicoSupportMoveDetail } from '../../../api/catalog/types'
import { palicoGenerationLabel, palicoRoleLabel, palicoUnlockKindLabels } from '../../utils/palicoLabels'
import { DetailSection } from '../DetailSection/DetailSection'
import './PalicoAbilityDetailPanel.css'

type Props =
  | { kind: 'move'; detail: PalicoSupportMoveDetail | null; loading: boolean; error?: string; onSelectMonster: (id: number) => void }
  | { kind: 'skill'; detail: PalicoSkillDetail | null; loading: boolean; error?: string; onSelectMonster: (id: number) => void }

export function PalicoAbilityDetailPanel(props: Props) {
  const { detail, loading, error } = props
  if (!detail) return <section className="palico-ability-detail-panel palico-ability-detail-panel--state">{error ?? (loading ? '正在读取详细资料…' : '从左侧选择一项资料。')}</section>

  const isMove = props.kind === 'move'
  const id = isMove ? (detail as PalicoSupportMoveDetail).supportMoveId : (detail as PalicoSkillDetail).palicoSkillId
  const value = isMove ? detail as PalicoSupportMoveDetail : detail as PalicoSkillDetail

  return (
    <section className="palico-ability-detail-panel">
      <header className="palico-ability-detail-panel__header">
        <div className="palico-ability-detail-panel__identity">
          <small className="palico-ability-detail-panel__eyebrow">{isMove ? '支援行动' : '随从技能'} #{id} · 0x{id.toString(16).toUpperCase()}</small>
          <h2 className="palico-ability-detail-panel__title">{value.nameCn}</h2>
          <p className="palico-ability-detail-panel__names">{value.nameEn} · {value.nameJp}</p>
        </div>
        {loading && <span className="palico-ability-detail-panel__updating" role="status">正在更新…</span>}
      </header>
      <div className="palico-ability-detail-panel__scroll">
        <dl className="palico-ability-detail-panel__stats">
          <Stat label="随机分组" value={palicoGenerationLabel(value.generationGroup)} />
          <Stat label="条目类型" value={palicoRoleLabel(value.role, isMove ? 'move' : 'skill')} />
          {isMove
            ? <Stat label="支援槽消耗" value={`${(value as PalicoSupportMoveDetail).gaugeCost ?? 0} 槽`} />
            : <><Stat label="记忆槽" value={`${(value as PalicoSkillDetail).memoryCost ?? 0} 槽`} /><Stat label="学习等级" value={(value as PalicoSkillDetail).learnLevel ? `Lv ${(value as PalicoSkillDetail).learnLevel}` : '初始/配信'} /></>}
          <Stat label="传授" value={value.teachable ? '可传授' : '不可传授'} />
          <Stat label="资料状态" value={value.evidenceStatus === 'wiki_only' ? 'Wiki 资料' : '已验证'} />
        </dl>
        <DetailSection title="说明" className="palico-ability-detail-panel__section">
          <p className="palico-ability-detail-panel__paragraph">{value.descriptionCn || '当前权威快照未提供简中说明。'}</p>
          {value.descriptionEn && <p className="palico-ability-detail-panel__paragraph palico-ability-detail-panel__secondary">{value.descriptionEn}</p>}
        </DetailSection>
        <DetailSection title="适用倾向" className="palico-ability-detail-panel__section">
          <div className="palico-ability-detail-panel__tags">{value.types.length ? value.types.map((type) => <span className="palico-ability-detail-panel__tag" key={type.typeId}>{type.nameCn}</span>) : <span className="palico-ability-detail-panel__tag">非倾向固定</span>}</div>
        </DetailSection>
        <DetailSection title="解锁条件" className="palico-ability-detail-panel__section">
          {value.unlocks.length ? (
            <div className="palico-ability-detail-panel__unlocks">
              {value.unlocks.map((unlock) => unlock.monsterId != null
                ? <button className="palico-ability-detail-panel__unlock" type="button" key={unlock.unlockKey} onClick={() => props.onSelectMonster(unlock.monsterId!)}><span className="palico-ability-detail-panel__unlock-content"><strong className="palico-ability-detail-panel__unlock-kind">{palicoUnlockKindLabels[unlock.kind]}</strong>{unlock.descriptionCn || unlock.monsterNameCn}</span><small className="palico-ability-detail-panel__unlock-source">{unlock.evidenceStatus === 'wiki_only' ? 'Wiki 资料' : '游戏数据 + 资料核对'}</small></button>
                : <div className="palico-ability-detail-panel__unlock palico-ability-detail-panel__unlock--readonly" key={unlock.unlockKey}><span className="palico-ability-detail-panel__unlock-content"><strong className="palico-ability-detail-panel__unlock-kind">{palicoUnlockKindLabels[unlock.kind]}</strong>{unlock.descriptionCn || unlock.descriptionEn}</span><small className="palico-ability-detail-panel__unlock-source">{unlock.evidenceStatus === 'wiki_only' ? 'Wiki 资料' : '游戏原生数据'}</small></div>)}
            </div>
          ) : <p className="palico-ability-detail-panel__empty">暂无可显示的解锁条件。</p>}
        </DetailSection>
        <p className="palico-ability-detail-panel__source">来源：{value.source}</p>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="palico-ability-detail-panel__stat"><dt className="palico-ability-detail-panel__stat-label">{label}</dt><dd className="palico-ability-detail-panel__stat-value">{value}</dd></div>
}
