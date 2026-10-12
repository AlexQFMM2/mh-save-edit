import type { ItemIdentity, QuestDetail, QuestReward } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import { P2gQuestSupplies } from '../P2gQuestSupplies/P2gQuestSupplies'
import './QuestRewardsSection.css'

export function QuestRewardsSection({ quest, onSelectItem, onSelectHunterArt }: { quest: QuestDetail; onSelectItem: (item: ItemIdentity) => void; onSelectHunterArt: (id: number) => void }) {
  const groups = new Map<string, QuestReward[]>()
  for (const reward of quest.rewards) {
    const key = `${reward.groupKey}\u0000${reward.region}`
    groups.set(key, [...(groups.get(key) ?? []), reward])
  }

  return (
    <div className="quest-rewards-section">
      {quest.rewards.length === 0 && <p className="quest-rewards-section__empty">{quest.p2g?.source === 'wiki' ? '普通道具奖励未收录。' : '没有普通道具奖励。'}</p>}
      {quest.p2g && <p className="quest-rewards-section__source">{quest.p2g.source === 'native' ? '概率为每次随机抽选的权重；首项保证与随机抽选分别展示，不代表整场获得率。奖励按组顺序处理，总输出最多 16 格。' : '数量和概率留空表示 Wiki 未收录。'}</p>}
      {[...groups].map(([key, rewards]) => {
        const [group, region] = key.split('\u0000')
        const nativeGroup = quest.p2g?.rewardGroups.find(g => g.key === group)
        return (
          <DetailSection title={`${nativeGroup?.label ?? group}${region && region !== '—' ? ` · ${region}` : ''}`} className="quest-rewards-section__group" key={key}>
            {nativeGroup?.draws?.count != null && <p className="quest-rewards-section__source">抽选 {nativeGroup.draws.count} 次</p>}
            <div className="quest-rewards-section__table-wrap">
              <table className="quest-rewards-section__table">
                <thead><tr><th className="quest-rewards-section__cell">道具</th><th className="quest-rewards-section__cell">数量</th><th className="quest-rewards-section__cell">{quest.p2g?.source === 'native' ? '每抽权重' : '概率'}</th></tr></thead>
                <tbody>{rewards.map(reward => <tr key={reward.id}><th className="quest-rewards-section__cell"><button className="quest-rewards-section__item" type="button" onClick={() => onSelectItem(reward.item)}>{reward.item.nameCn}</button>{reward.guaranteed && <small className="quest-rewards-section__source"> · 首项保证</small>}</th><td className="quest-rewards-section__cell quest-rewards-section__data">{reward.quantity ?? '未收录'}</td><td className="quest-rewards-section__cell quest-rewards-section__data">{reward.probability == null ? '未收录' : formatProbability(reward.probability)}</td></tr>)}</tbody>
              </table>
            </div>
          </DetailSection>
        )
      })}
      {quest.p2g && <P2gQuestSupplies data={quest.p2g} onSelectItem={onSelectItem} />}
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
