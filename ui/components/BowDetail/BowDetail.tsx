import type { ExtractWeaponDetail } from '../WeaponTypeDetail/weaponTypeDetailTypes'
import { BowgunAmmoTable } from '../BowgunAmmoTable/BowgunAmmoTable'
import './BowDetail.css'

export function BowDetail({ weapon, onSelectItem }: { weapon: ExtractWeaponDetail<'bow'>; onSelectItem?: (saveId: number) => void }) {
  return <section className="bow-detail"><div className="bow-detail__mode"><span>射击模式</span><strong>{weapon.bow.shotModeNameCn}</strong><small>{weapon.bow.shotModeNameEn}</small></div><div className="bow-detail__charges"><h3>蓄力箭型</h3>{weapon.charges.map((charge) => <span key={charge.level} className={charge.requiresLoadUp ? 'bow-detail__charge--locked' : undefined}><strong>Lv.{charge.level}</strong>{charge.nameCn}{charge.requiresLoadUp && <small>[装填数追加]</small>}</span>)}</div><BowgunAmmoTable rows={weapon.coatings} title="可用瓶" onSelectItem={onSelectItem} /></section>
}
