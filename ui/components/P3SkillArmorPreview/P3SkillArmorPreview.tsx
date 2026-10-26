import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { P3SkillArmorDetail } from '../../../api/catalog/p3SkillTypes'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './P3SkillArmorPreview.css'

const parts = { head: '头', chest: '胸', arms: '手', waist: '腰', legs: '腿' }
export function P3SkillArmorPreview({ armorKey, mode, onClose, onSelectSkill }: {
  armorKey: string | null; mode: 'inline' | 'drawer'; onClose: () => void; onSelectSkill: (id: number) => void
}) {
  const [armor, setArmor] = useState<P3SkillArmorDetail | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState<string>(), [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true; setArmor(null); setError(undefined)
    if (!armorKey) { setLoading(false); return }
    setLoading(true)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接。'); setLoading(false); return }
    void api.getP3SkillArmor({ gameId: 'mhp3', armorKey }).then(value => { if (active) setArmor(value) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '关联防具读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [armorKey, retry])
  if (!armorKey) return null
  const content = <article className="p3-skill-armor-preview" aria-label="防具关联预览">
    {mode === 'inline' && <button type="button" className="p3-skill-armor-preview__link" onClick={onClose}>返回技能详情</button>}
    {loading ? <p role="status">正在读取关联防具…</p> : error ? <div role="alert">{error}<button type="button" className="p3-skill-armor-preview__link" onClick={() => setRetry(n => n + 1)}>重试</button></div> : !armor ? <p>未找到对应防具资料。</p> : <>
      <header className="p3-skill-armor-preview__header"><ArmorIcon path={armor.iconPath} name={armor.nameCn || armor.nameJp}/><div><h2 className="p3-skill-armor-preview__title">{armor.nameCn || armor.nameJp}</h2><p className="p3-skill-armor-preview__note">{armor.nameCn ? armor.nameJp : '原生名称'} · {parts[armor.part]}</p></div></header>
      <p className="p3-skill-armor-preview__data">原生类型 {armor.nativeType} · 编号 {armor.nativeId} · 稀有度 {armor.rarity}</p>
      <div className="p3-skill-armor-preview__slots">孔位 <EquipmentSlotIndicator slots={armor.slots}/><span className="p3-skill-armor-preview__data">{armor.slots}</span></div>
      <h3 className="p3-skill-armor-preview__subtitle">技能</h3>
      {armor.skills.map(s => <div className="p3-skill-armor-preview__row" key={s.skillId}><button type="button" className="p3-skill-armor-preview__link" onClick={() => onSelectSkill(s.skillId)}>{s.nameCn}<span className="p3-skill-armor-preview__secondary">{s.nameJp}</span></button><strong className="p3-skill-armor-preview__data">{s.kind === 'torso-copy-marker' ? '胴系复制' : `${s.points > 0 ? '+' : ''}${s.points}`}</strong></div>)}
      {!armor.skills.length && <p className="p3-skill-armor-preview__note">没有非零技能点。</p>}
      {armor.skills.some(s => s.kind === 'torso-copy-marker') && <p className="p3-skill-armor-preview__note">复制胴部防具及其所装装饰品的技能点。</p>}
      <p className="p3-skill-armor-preview__note">取得条件未收录。{armor.referenceCoverage === 'native-only-acquisition-unverified' ? '此条目取得方式未确认。' : ''}</p>
    </>}
  </article>
  return mode === 'drawer' ? createPortal(<div className="p3-skill-armor-preview__drawer"><DetailDrawer title="关联防具" onClose={onClose}>{content}</DetailDrawer></div>, document.body) : content
}
