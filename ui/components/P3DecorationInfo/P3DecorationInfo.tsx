import type { DecorationDetail } from '../../../api/catalog/types'
import { itemTranslationSourceLabel } from '../../utils/itemTerminologyPresentation'
import './P3DecorationInfo.css'

export function P3DecorationInfo({ data }: { data: NonNullable<DecorationDetail['p3']> }) {
  return <section className="p3-decoration-info" aria-label="P3 装饰品资料">
    <p className="p3-decoration-info__source">名称来源：{itemTranslationSourceLabel(data.nameSource)}</p>
    <p className="p3-decoration-info__description">{data.description.replace(/~C[0-9A-F]{2}/g, '')}</p>
    <details className="p3-decoration-info__original">
      <summary className="p3-decoration-info__toggle">查看日文说明</summary>
      <p className="p3-decoration-info__description" lang="ja">{data.descriptionJp.replace(/~C[0-9A-F]{2}/g, '')}</p>
    </details>
    <dl className="p3-decoration-info__fields">
      <dt className="p3-decoration-info__label">稀有度</dt><dd className="p3-decoration-info__value">{data.rarity ?? '未收录'}</dd>
    </dl>
    <p className="p3-decoration-info__note">各制作配方可择一使用。制造费用、解锁条件、技能发动阈值及完整技能效果尚未收录。</p>
  </section>
}
