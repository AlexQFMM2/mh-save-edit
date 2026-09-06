import { useState } from 'react'
import type { GameId } from '../../../api/core/loadout'
import { CommonHeader } from '../../components/CommonHeader/CommonHeader'
import { GuildBackdrop } from '../../components/GuildBackdrop/GuildBackdrop'
import { GameVersionGrid } from '../../components/GameVersionGrid/GameVersionGrid'
import { gameVersions } from '../../data/gameVersions'
import './HomePage.css'

export function HomePage() {
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(null)
  const [previewedGameId, setPreviewedGameId] = useState<GameId | null>(null)
  const previewedGame = gameVersions.find((game) => game.id === previewedGameId)

  return (
    <main className="home-page">
      <GuildBackdrop backgroundImage={previewedGame?.backgroundPath} />
      <CommonHeader />
      <section className="home-page__content" aria-labelledby="home-page-title">
        <div className="home-page__intro">
          <p className="home-page__eyebrow">MH SAVE EDITOR</p>
          <h1 id="home-page-title" className="home-page__title">
            请选择游戏版本
          </h1>
          <p className="home-page__description">
            选择你要编辑的 Monster Hunter 存档版本，开始管理装备、道具与配装。
          </p>
        </div>
        <GameVersionGrid
          games={gameVersions}
          selectedGameId={selectedGameId}
          onSelect={setSelectedGameId}
          onPreviewChange={setPreviewedGameId}
        />
      </section>
    </main>
  )
}
