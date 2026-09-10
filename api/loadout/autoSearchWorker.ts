import { parentPort } from 'node:worker_threads'
import { runAutoLoadout } from './autoSearch'
import type { AutoLoadoutRequest, LoadoutCatalogSnapshot } from './types'

if (!parentPort) throw new Error('自动配装 Worker 必须在线程中运行')
let paused = false; let cancelled = false
const wait = async () => {
  if (cancelled) throw new Error('__cancelled__')
  while (paused && !cancelled) await new Promise(resolve => setTimeout(resolve, 30))
  if (cancelled) throw new Error('__cancelled__')
  await new Promise<void>(resolve => setImmediate(resolve))
}
parentPort.postMessage({ type: 'ready' })
parentPort.on('message', async (message: { type: string; snapshot?: LoadoutCatalogSnapshot; request?: AutoLoadoutRequest }) => {
  if (message.type === 'pause') { paused = true; return }
  if (message.type === 'resume') { paused = false; return }
  if (message.type === 'cancel') { cancelled = true; paused = false; return }
  if (message.type !== 'start' || !message.snapshot || !message.request) return
  try {
    const results = await runAutoLoadout(message.snapshot, message.request, { checkpoint: wait, progress: value => parentPort!.postMessage({ type: 'progress', value }) })
    parentPort!.postMessage({ type: 'finished', results })
  } catch (error) {
    if (error instanceof Error && error.message === '__cancelled__') parentPort!.postMessage({ type: 'cancelled' })
    else parentPort!.postMessage({ type: 'error', error: error instanceof Error ? error.message : '自动配装失败' })
  }
})
