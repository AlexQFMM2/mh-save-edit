import type { ItemTerm } from '../../../api/terminology/types'
import { itemTranslationSourceLabel } from '../../utils/itemTerminologyPresentation'
import './ItemTermCard.css'

const gameNames = { mhp2g: 'P2G', mh3g: '3G', mh4g: '4G', mhgu: 'GU' }
const statusNames: Record<string, string> = { 'missing-japanese': '暂无日文名，保留原译名', 'not-in-gu': '未找到 GU 对应词条，保留原译名', 'ambiguous-japanese': '日文同名有歧义，保留原译名', 'translation-pending': '采用日文原名', 'official-wording': '采用 GU 官方珠名，省略孔位后缀；孔位和技能点以 P2G 为准' }
export function ItemTermCard({ term }: { term: ItemTerm }) {
  const variants = [...new Set(term.aliases.map(alias => alias.name))].filter(name => name !== term.name && name !== term.nameJp)
  const pending = [...new Set(term.members.map(member => statusNames[member.status]).filter(Boolean))]
  return <article className="item-term-card" aria-label={term.name}>
    <header className="item-term-card__header"><h3 className="item-term-card__name">{term.name}</h3><span className="item-term-card__source">{itemTranslationSourceLabel(term.source)}</span></header>
    <p className="item-term-card__japanese">日文：{term.nameJp || '暂无'}</p>
    <p className="item-term-card__aliases">其他叫法：{variants.join(' / ') || '暂无'}</p>
    <div className="item-term-card__members">{term.members.map(member => <p className="item-term-card__member" key={`${member.gameId}:${member.itemId}`}><span className="item-term-card__game">{gameNames[member.gameId]}</span>{member.originalName}</p>)}</div>
    {pending.map(message => <p className="item-term-card__pending" key={message}>{message}</p>)}
    <details className="item-term-card__evidence"><summary className="item-term-card__evidence-toggle">查看译名来源</summary><ul className="item-term-card__sources">{term.aliases.map((alias, index) => <li className="item-term-card__source-row" key={index}>{alias.name} · {gameNames[alias.gameId]} · {itemTranslationSourceLabel(alias.source)}</li>)}</ul></details>
  </article>
}
