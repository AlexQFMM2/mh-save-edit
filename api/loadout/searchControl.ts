import type { AutoLoadoutProgress, AutoLoadoutRequest } from './types'

export type SearchContext = { checkpoint: () => Promise<void | number>; progress: (value: AutoLoadoutProgress) => void }
export class SearchBudgetExpired extends Error {}

/** Checkpoints return actual paused duration, not normal event-loop scheduling time. */
export class SearchControl {
  private started = Date.now()
  private pausedMs = 0
  private lastYield = this.started
  private lastProgress = this.started
  checked = 0
  verified = 0
  results = 0
  stage = '准备候选'
  constructor(private request: AutoLoadoutRequest, private context: SearchContext) {}
  get elapsedMs() { return Math.max(0, Date.now() - this.started - this.pausedMs) }
  progress(): AutoLoadoutProgress { return { requestId: this.request.requestId, stage: this.stage, checked: this.checked, verified: this.verified, results: this.results, elapsedMs: this.elapsedMs } }
  async tick(force = false) {
    this.checked++
    const now = Date.now()
    if (force || this.checked % 128 === 0 || now - this.lastYield >= 20) {
      this.pausedMs += (await this.context.checkpoint()) ?? 0
      this.lastYield = Date.now()
    }
    if (this.elapsedMs >= this.request.timeoutMs) throw new SearchBudgetExpired()
    if (force || now - this.lastProgress >= 250) { this.context.progress(this.progress()); this.lastProgress = now }
  }
}
