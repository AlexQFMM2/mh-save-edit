import { BookOpen, Shield } from 'lucide-react'
import { useState } from 'react'
import { ItemTerminology } from '../ItemTerminology/ItemTerminology'
import type { GameVersionDefinition } from '../../data/gameVersions'
import './CommonHeader.css'

type CommonHeaderProps = {
  currentGame?: GameVersionDefinition
  saveStatus?: string
}

export function CommonHeader({ currentGame, saveStatus = '暂未选择存档' }: CommonHeaderProps) {
  const [dictionaryOpen, setDictionaryOpen] = useState(false)
  return (
    <header className="common-header">
      <div className="common-header__brand" aria-label="MH Save Editor">
        <span className="common-header__mark" aria-hidden="true"><Shield size={20} strokeWidth={1.8} /></span>
        <div className="common-header__brand-copy">
          <span className="common-header__kicker">MONSTER HUNTER SAVE TOOLS</span>
          <span className="common-header__name">MH Save Editor</span>
        </div>
      </div>
      <div className="common-header__tools">
      <button className="common-header__dictionary" type="button" aria-haspopup="dialog" onClick={() => setDictionaryOpen(true)}><BookOpen size={18} aria-hidden="true" />译名词典</button>
      <div className="common-header__status" aria-live="polite">
        <span className="common-header__status-label">{currentGame ? '当前游戏' : '当前存档版本'}</span>
        <span className="common-header__status-value">{currentGame?.title ?? saveStatus}</span>
        {currentGame ? <span className="common-header__status-detail">{saveStatus}</span> : null}
      </div>
      </div>
      {dictionaryOpen && <ItemTerminology currentGame={currentGame?.id} onClose={() => setDictionaryOpen(false)} />}
    </header>
  )
}
