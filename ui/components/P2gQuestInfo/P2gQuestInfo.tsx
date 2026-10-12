import type { P2gQuestData } from '../../../api/catalog/p2gQuestTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import './P2gQuestInfo.css'

export function P2gQuestInfo({ data }: { data: P2gQuestData }) {
  return <div className="p2g-quest-info">
    <DetailSection title="委托内容">
      <p className="p2g-quest-info__text">委托人：{data.clientCn ?? '未收录'}</p>
      <p className="p2g-quest-info__text">{data.descriptionCn ?? '委托说明未收录'}</p>
      {data.descriptionJp && <details className="p2g-quest-info__original"><summary>日文原文</summary><p className="p2g-quest-info__text">{data.clientJp}</p><p className="p2g-quest-info__text">{data.descriptionJp}</p></details>}
    </DetailSection>
    <DetailSection title="失败条件"><p className="p2g-quest-info__text">{data.failureCn ?? '未收录'}</p></DetailSection>
    {data.noteCn && <DetailSection title="Wiki 补充"><p className="p2g-quest-info__text">{data.noteCn}</p><details className="p2g-quest-info__original"><summary>日文原文</summary><p className="p2g-quest-info__text">{data.noteJp}</p></details></DetailSection>}
    <p className="p2g-quest-info__source">{data.source === 'native' ? '本体任务资料；中文按日文及任务语境校对，已核对的 GU 官汉优先。' : 'Wiki 配信资料；未收录原生任务 ID、完整目标、委托说明、失败条件和支给配置。奖励中的空值表示未收录。'}</p>
  </div>
}
