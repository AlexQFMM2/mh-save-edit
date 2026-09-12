import type { QuestSummary } from '../../../api/catalog/types'
import './QuestList.css'

const keyName = (value: QuestSummary['keyStatus']) => value === 'key' ? '关键' : value === 'urgent' ? '紧急' : ''

export function QuestList({ items, selectedKey, loading, error, onSelect }: { items: QuestSummary[]; selectedKey?: string; loading: boolean; error?: string; onSelect: (key: string) => void }) {
  return (
    <div className="quest-list">
      {error && <div className="quest-list__state" role="alert">{error}</div>}
      {!error && loading && items.length === 0 && <div className="quest-list__state" aria-live="polite">正在读取任务…</div>}
      {!error && !loading && items.length === 0 && <div className="quest-list__state">没有符合条件的任务。</div>}
      {items.length > 0 && (
        <div className="quest-list__scroller">
          <table className="quest-list__table">
            <thead><tr><th className="quest-list__heading">等级</th><th className="quest-list__heading">任务</th><th className="quest-list__heading">类型</th><th className="quest-list__heading">地图</th><th className="quest-list__heading">主目标</th><th className="quest-list__heading">状态</th></tr></thead>
            <tbody>
              {items.map(item => {
                const badge = keyName(item.keyStatus)
                const selected = item.questKey === selectedKey
                return (
                  <tr key={item.questKey} className={selected ? 'quest-list__row quest-list__row--selected' : 'quest-list__row'} aria-selected={selected} onClick={() => onSelect(item.questKey)}>
                    <td className="quest-list__cell quest-list__cell--data">{item.levelNameCn}</td>
                    <th className="quest-list__cell quest-list__name-cell" scope="row">
                      <button className="quest-list__select" type="button" aria-pressed={selected} onClick={() => onSelect(item.questKey)}>
                        <span>{item.nameCn}</span>
                        {item.nameEn && <small className="quest-list__alternate-name">{item.nameEn}</small>}
                        {item.match && item.match.kind !== 'name' && <em className="quest-list__match">{item.match.reason}</em>}
                      </button>
                    </th>
                    <td className="quest-list__cell">{item.questTypeNameCn}</td>
                    <td className="quest-list__cell">{item.locationNameCn}</td>
                    <td className="quest-list__cell quest-list__goal" title={item.goalCn}>{item.goalCn || '—'}</td>
                    <td className="quest-list__cell">{badge && <span className={`quest-list__badge quest-list__badge--${item.keyStatus}`}>{badge}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
