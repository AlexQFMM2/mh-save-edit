import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GameShell } from '../../components/GameShell/GameShell'
import { gameVersions, type WorkspaceGameId } from '../../data/gameVersions'
import { useSaveSession } from '../../components/SaveSessionProvider/SaveSessionProvider'
import { ConfirmationDialog } from '../../components/ConfirmationDialog/ConfirmationDialog'
import './GameHomePage.css'

export function GameHomePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { session, close, save } = useSaveSession()

  if (!isGameId(gameId)) return <Navigate to="/" replace />

  const game = gameVersions.find((item) => item.id === gameId)!

  const mismatch = session && session.contentGameId !== game.id
  const saveAndContinue = async () => {
    const result = await save()
    if (result && !result.cancelled) await close(false)
  }
  return <div className="game-home-page"><GameShell key={game.id} game={game} />{mismatch && <ConfirmationDialog title="切换游戏会关闭当前存档" message={`当前已读取 ${session.contentGameId.toUpperCase()} 存档${session.dirty ? '，并且存在未保存修改' : ''}。继续切换会使该存档会话失效。`} confirmLabel={session.dirty ? '保存并切换' : '关闭存档并切换'} alternateLabel={session.dirty ? '放弃修改并切换' : undefined} alternateDestructive onConfirm={() => { if (session.dirty) void saveAndContinue().catch(() => undefined); else void close(false) }} onAlternate={session.dirty ? () => void close(true) : undefined} onCancel={() => navigate(`/game/${session.contentGameId}/overview`, { replace: true })} />}</div>
}

export function isGameId(value: string | undefined): value is WorkspaceGameId {
  return gameVersions.some((game) => game.id === value)
}
