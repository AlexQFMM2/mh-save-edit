import type { ExtractWeaponDetail } from '../WeaponTypeDetail/weaponTypeDetailTypes'
import { BowgunAmmoTable } from '../BowgunAmmoTable/BowgunAmmoTable'
import './BowgunDetail.css'

export function BowgunDetail({ weapon, onSelectItem }: { weapon: ExtractWeaponDetail<'bowgun'>; onSelectItem?: (saveId: number) => void }) {
  return <section className="bowgun-detail"><dl><div><dt>装填速度</dt><dd>{weapon.gun.reloadNameCn}</dd></div><div><dt>后坐力</dt><dd>{weapon.gun.recoilNameCn}</dd></div><div><dt>偏移</dt><dd>{weapon.gun.steadinessNameCn}</dd></div></dl><BowgunAmmoTable rows={weapon.ammo} title={weapon.weaponKind === 'light' ? '弹种与速射' : '弹种与蹲射'} onSelectItem={onSelectItem} /></section>
}
