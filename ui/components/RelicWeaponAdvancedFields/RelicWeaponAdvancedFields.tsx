import type { LoadoutInstanceState } from '../../../api/loadout/types'
import { patchRelicByte } from '../../../api/loadout/relic'
import { RelicDecorationRecordFields } from '../RelicDecorationRecordFields/RelicDecorationRecordFields'
import './RelicWeaponAdvancedFields.css'

type Props = { instance: LoadoutInstanceState; weaponTypeId: number; onChange: (value: LoadoutInstanceState) => void }
type ByteFieldProps = { instance: LoadoutInstanceState; offset: number; label: string; onChange: Props['onChange'] }
function ByteField({ instance, offset, label, onChange }: ByteFieldProps) {
  const value = Number.parseInt(instance.recordHex.slice(offset * 2, offset * 2 + 2) || '0', 16)
  return <label className="relic-weapon-advanced-fields__field"><span className="relic-weapon-advanced-fields__label">{label}</span><input className="relic-weapon-advanced-fields__input" aria-label={label} type="number" min={0} max={255} value={value} onChange={event => onChange(patchRelicByte(instance, offset, Number(event.target.value)))} /><span className="relic-weapon-advanced-fields__hex">0x{value.toString(16).toUpperCase().padStart(2, '0')}</span></label>
}

export function RelicWeaponAdvancedFields({ instance, weaponTypeId, onChange }: Props) {
  const byte = (offset: number) => Number.parseInt(instance.recordHex.slice(offset * 2, offset * 2 + 2) || '0', 16)
  const specialLabel = weaponTypeId === 12 || weaponTypeId === 13 ? '弹匣方案' : weaponTypeId === 14 ? '弓方案' : '斩味方案'
  return <div className="relic-weapon-advanced-fields">
    <fieldset className="relic-weapon-advanced-fields__group"><legend className="relic-weapon-advanced-fields__legend">武器发掘字段</legend>
      {(weaponTypeId === 11 || weaponTypeId === 12 || weaponTypeId === 13) && <ByteField instance={instance} offset={0x01} label={weaponTypeId === 11 ? '猎虫等级' : '弩改造原始位'} onChange={onChange} />}
      {weaponTypeId !== 12 && weaponTypeId !== 13 && <><ByteField instance={instance} offset={0x04} label="属性数值档" onChange={onChange} /><ByteField instance={instance} offset={0x05} label="属性 / 异常类型" onChange={onChange} /></>}
      <ByteField instance={instance} offset={0x0c} label={specialLabel} onChange={onChange} />
      <ByteField instance={instance} offset={0x0d} label="攻击组合档" onChange={onChange} />
      <ByteField instance={instance} offset={0x0e} label="发掘升级档" onChange={onChange} />
      <ByteField instance={instance} offset={0x0f} label="武器专属值" onChange={onChange} />
      <label className="relic-weapon-advanced-fields__field"><span className="relic-weapon-advanced-fields__label">孔位</span><input className="relic-weapon-advanced-fields__input" type="number" min={0} max={3} value={(byte(0x10) >> 2) & 3} onChange={event => onChange(patchRelicByte(instance, 0x10, Number(event.target.value) << 2, 0x0c))} /><span className="relic-weapon-advanced-fields__hex">bits 2–3</span></label>
      <label className="relic-weapon-advanced-fields__check"><input className="relic-weapon-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 1)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 1 : 0, 1))} /><span>未研磨 / 锈蚀</span></label>
      <label className="relic-weapon-advanced-fields__check"><input className="relic-weapon-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 2)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 2 : 0, 2))} /><span>发光</span></label>
      <ByteField instance={instance} offset={0x11} label="动态稀有度（-1）" onChange={onChange} />
      <ByteField instance={instance} offset={0x12} label="研磨要求档" onChange={onChange} />
      <ByteField instance={instance} offset={0x13} label="极限强化" onChange={onChange} />
    </fieldset>
    <RelicDecorationRecordFields instance={instance} onChange={onChange} />
    {weaponTypeId === 11 && <fieldset className="relic-weapon-advanced-fields__group"><legend className="relic-weapon-advanced-fields__legend">猎虫实例（0x14–0x1B）</legend><div className="relic-weapon-advanced-fields__kinsect">{['力量', '耐力', '速度', '火', '水', '雷', '冰', '龙'].map((label, index) => <ByteField key={label} instance={instance} offset={0x14 + index} label={label} onChange={onChange} />)}</div></fieldset>}
    <small className="relic-weapon-advanced-fields__note">所有字段允许 00–FF 原始值；0x10 仅掩码修改已确认位，高四位原样保留。未知枚举不猜测含义。</small>
  </div>
}
