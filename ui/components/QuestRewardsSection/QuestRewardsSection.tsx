import type { QuestDetail, QuestReward } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import './QuestRewardsSection.css'

export function QuestRewardsSection({ quest, onSelectItem, onSelectHunterArt }: { quest: QuestDetail; onSelectItem: (id: number) => void; onSelectHunterArt: (id: number) => void }) {
  const groups = new Map<string, QuestReward[]>()
  for (const reward of quest.rewards) {
    const key = `${reward.groupKey}\u0000${reward.region}`
    groups.set(key, [...(groups.get(key) ?? []), reward])
  }

  return (
    <div className="quest-rewards-section">
      {quest.rewards.length === 0 && <p className="quest-rewards-section__empty">没有普通道具奖励。</p>}
      {[...groups].map(([key, rewards]) => {
        const [group, region] = key.split('\u0000')
        return (
          <DetailSection title={`${group}${region && region !== '—' ? ` · ${region}` : ''}`} className="quest-rewards-section__group" key={key}>
            <div className="quest-rewards-section__table-wrap">
              <table className="quest-rewards-section__table">
                <thead><tr><th className="quest-rewards-section__cell">道具</th><th className="quest-rewards-section__cell">数量</th><th className="quest-rewards-section__cell">概率</th></tr></thead>
                <tbody>{rewards.map(reward => <tr key={reward.id}><th className="quest-rewards-section__cell"><button className="quest-rewards-section__item" type="button" onClick={() => onSelectItem(reward.item.saveId)}>{reward.item.nameCn}</button></th><td className="quest-rewards-section__cell quest-rewards-section__data">{reward.quantity}</td><td className="quest-rewards-section__cell quest-rewards-section__data">{formatProbability(reward.probability)}</td></tr>)}</tbody>
              </table>
            </div>
          </DetailSection>
        )
      })}
      {quest.specialRewards.length > 0 && (
        <DetailSection title="特殊完成奖励" className="quest-rewards-section__group">
          <div className="quest-rewards-section__specials">
            {quest.specialRewards.map(reward => reward.hunterArt ? (
              <button className="quest-rewards-section__special-button" type="button" key={reward.id} onClick={() => onSelectHunterArt(reward.hunterArt!.hunterArtId)}>
                <span>{reward.hunterArt.nameCn}</span>
                <small className="quest-rewards-section__source">{reward.evidenceStatus === 'wiki_only' ? 'Wiki 资料' : '已验证狩技'}</small>
              </button>
            ) : (
              <div className="quest-rewards-section__special" key={reward.id}>
                <span>{reward.nameCn}</span>
                {reward.evidenceStatus === 'wiki_only' && <small className="quest-rewards-section__source">Wiki 资料</small>}
              </div>
            ))}
          </div>
        </DetailSection>
      )}
    </div>
  )
}

const formatProbability = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/u, '').replace(/\.$/u, '')}%`
