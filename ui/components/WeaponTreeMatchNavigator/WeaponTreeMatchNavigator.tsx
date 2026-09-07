import { ChevronLeft, ChevronRight } from 'lucide-react'
import './WeaponTreeMatchNavigator.css'

export function WeaponTreeMatchNavigator({ matchedKeys, contextualCount, selectedKey, onSelect }: { matchedKeys: string[]; contextualCount: number; selectedKey?: string; onSelect: (weaponKey: string) => void }) {
  const selectedIndex = matchedKeys.indexOf(selectedKey ?? '')
  const navigationIndex = selectedIndex >= 0 ? selectedIndex : 0
  const move = (step: number) => { if (!matchedKeys.length) return; onSelect(matchedKeys[(navigationIndex + step + matchedKeys.length) % matchedKeys.length]) }
  return <div className="weapon-tree-match-navigator"><span>命中 {matchedKeys.length} 个 · 路线节点 {contextualCount}</span><button type="button" disabled={!matchedKeys.length} aria-label="上一个命中" onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button><strong>{matchedKeys.length ? selectedIndex >= 0 ? `${selectedIndex + 1}/${matchedKeys.length}` : `—/${matchedKeys.length}` : '0/0'}</strong><button type="button" disabled={!matchedKeys.length} aria-label="下一个命中" onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button></div>
}
