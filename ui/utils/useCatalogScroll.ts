import { useLayoutEffect, useRef } from 'react'

// Bounded, session-only positions also survive route unmounts and history navigation.
const positions = new Map<string, number>()
export function useCatalogScroll(key: string | undefined, ready: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (key && ready && ref.current) ref.current.scrollTop = positions.get(key) ?? 0 }, [key, ready])
  const onScroll = () => {
    if (!key || !ready || !ref.current) return
    positions.delete(key); positions.set(key, ref.current.scrollTop)
    if (positions.size > 100) positions.delete(positions.keys().next().value!)
  }
  return { ref, onScroll }
}
