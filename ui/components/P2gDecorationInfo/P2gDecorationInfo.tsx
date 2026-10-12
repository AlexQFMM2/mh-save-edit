import type { DecorationDetail } from '../../../api/catalog/types'
import './P2gDecorationInfo.css'
export function P2gDecorationInfo({ data }: { data: NonNullable<DecorationDetail['p2g']> }) {
  return <div className="p2g-decoration-info">
    <dl className="p2g-decoration-info__fields">
      <div className="p2g-decoration-info__field"><dt className="p2g-decoration-info__label">稀有度</dt><dd className="p2g-decoration-info__value">{data.rarity??'未收录'}</dd></div>
      <div className="p2g-decoration-info__field"><dt className="p2g-decoration-info__label">制造费用</dt><dd className="p2g-decoration-info__value">未收录</dd></div>
      <div className="p2g-decoration-info__field"><dt className="p2g-decoration-info__label">解锁条件</dt><dd className="p2g-decoration-info__value">未收录</dd></div>
    </dl>
    <p className="p2g-decoration-info__note">孔位、技能点与制作材料来自 P2G 原生资料；珠名沿用道具图鉴译名。</p>
  </div>
}
