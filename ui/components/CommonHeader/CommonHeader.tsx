import { Shield } from 'lucide-react'
import type { GameVersionDefinition } from '../../data/gameVersions'
import './CommonHeader.css'

type CommonHeaderProps = {
  currentGame?: GameVersionDefinition
  saveStatus?: string
}

export function CommonHeader({ currentGame, saveStatus = '暂未选择存档' }: CommonHeaderProps) {
  return (
    <header className="common-header">
      <div className="common-header__brand" aria-label="MH Save Editor">
        <span className="common-header__mark" aria-hidden="true"><Shield size={20} strokeWidth={1.8} /></span>
        <div className="common-header__brand-copy">
          <span className="common-header__kicker">MONSTER HUNTER SAVE TOOLS</span>
          <span className="common-header__name">MH Save Editor</span>
        </div>
      </div>
      <div className="common-header__status" aria-live="polite">
        <span className="common-header__status-label">{currentGame ? '当前游戏' : '当前存档版本'}</span>
        <span className="common-header__status-value">{currentGame?.title ?? saveStatus}</span>
        {currentGame ? <span className="common-header__status-detail">{saveStatus}</span> : null}
      </div>
    </header>
  )
}
