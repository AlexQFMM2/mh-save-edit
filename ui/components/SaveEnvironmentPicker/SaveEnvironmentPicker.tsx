import { FolderOpen, Gamepad2, HardDrive } from 'lucide-react'
import { useState } from 'react'
import { SAVE_ENVIRONMENTS } from '../../../api/save/types'
import type { GameId } from '../../../api/core/loadout'
import './SaveEnvironmentPicker.css'

export function SaveEnvironmentPicker({ gameId, busy, error, onOpen }: { gameId: GameId; busy: boolean; error?: string | null; onOpen(formatId: (typeof SAVE_ENVIRONMENTS)[number]['formatId']): void }) {
  const values = SAVE_ENVIRONMENTS.filter(value => value.contentGameId === gameId)
  const [selected, setSelected] = useState<(typeof SAVE_ENVIRONMENTS)[number]['formatId'] | null>(null)
  return <section className="save-environment-picker" aria-labelledby="save-environment-title"><header><p>存档修改</p><h1 id="save-environment-title">选择存档环境</h1><span>环境决定字节序、加密方式和存档结构。先确认环境，再选择对应的存档文件。</span></header><div className="save-environment-picker__grid">{values.map(value => <article className={selected === value.formatId ? 'is-selected' : ''} key={value.formatId}><input id={`save-environment-${value.formatId}`} type="radio" name="save-environment" checked={selected === value.formatId} onChange={() => setSelected(value.formatId)} disabled={busy} /><label htmlFor={`save-environment-${value.formatId}`}><span className="save-environment-picker__icon">{value.platform === 'switch' ? <Gamepad2 aria-hidden="true" /> : <HardDrive aria-hidden="true" />}</span><span className="save-environment-picker__copy"><strong>{value.title}</strong><small>{value.description}</small><em>{value.platform.toUpperCase()} · {value.emulator}</em></span></label></article>)}</div>{error && <p className="save-environment-picker__error" role="alert">{error}</p>}<div className="save-environment-picker__actions"><span>{selected ? values.find(value => value.formatId === selected)?.title : '尚未选择环境'}</span><button type="button" onClick={() => selected && onOpen(selected)} disabled={busy || !selected}><FolderOpen aria-hidden="true" />选择文件并读取</button></div><aside><strong>安全说明</strong><span>读取不会立即改写文件。所有操作先进入内存撤销栈，只有点击“保存”才会生成备份并原子写回。</span></aside></section>
}
