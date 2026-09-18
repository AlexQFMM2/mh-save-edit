import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { runAutoLoadout } from '../api/loadout/autoSearch'
import { calculateLoadout } from '../api/loadout/calculator'
import { ARMOR_LOADOUT_SLOTS, createEmptyLogicalLoadout, type AutoLoadoutRequest } from '../api/loadout/types'

// Read-only runtime catalog smoke tests; all loadouts are synthetic, never save-file inputs.
describe('real-catalog search smoke', () => {
  it.each(['mh3g', 'mh4g', 'mhgu'] as const)('finds independently verified results and reports a fixed-input no-solution for %s', async gameId => {
    const db = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true })
    try {
      const snapshot = new LoadoutCatalogRepository(db, gameId).getSnapshot()
      const base = createEmptyLogicalLoadout(gameId, snapshot.dataVersion)
      const weapon = snapshot.weapons.find(value => value.sourceKind === 'catalog' && value.typeId === 1)!
      expect(weapon).toBeTruthy()
      base.weapon = { ...weapon, decorations: [], lock: 'equipment' }
      const targets = ['匠', '锋利度'].map(name => {
        const skill = snapshot.skills.find(value => value.nameCn === name)!
        const activation = skill.activations.filter(value => value.direction === 'positive').sort((a,b) => b.threshold-a.threshold)[0]
        return { activationKey: activation.activationKey, skillId: skill.skillId, threshold: activation.threshold, nameCn: activation.nameCn }
      })
      const request: AutoLoadoutRequest = { requestId: randomUUID(), gameId, dataVersion: snapshot.dataVersion, baseLoadout: base, targets, resultLimit: 5, timeoutMs: 10000 }
      const before = structuredClone(request)
      let checkpoints = 0
      const context = { checkpoint: async () => { checkpoints++; await new Promise<void>(resolve => setImmediate(resolve)) }, progress: () => {} }
      const report = await runAutoLoadout(snapshot, request, context)
      expect(report.results.length).toBeGreaterThan(0)
      expect(checkpoints).toBeGreaterThan(0)
      expect(request).toEqual(before)
      if (gameId === 'mh4g' && snapshot.mh4gCharmWitnesses?.length) {
        expect(report.progress.coverageWarnings?.some(message => message.includes('未穷举'))).toBe(true)
        expect(report.results.some(result => result.loadout.charm?.legality === 'confirmed')).toBe(true)
      }
      for (const result of report.results) {
        const calculation = calculateLoadout(snapshot, result.loadout)
        expect(calculation.encoding).not.toBe('blocked')
        for (const target of targets) expect(calculation.skills.find(skill => skill.skillId === target.skillId)?.total ?? 0).toBeGreaterThanOrEqual(target.threshold)
      }
      if (report.results.length === request.resultLimit) {
        expect(report.progress.searchComplete).toBe(false)
        expect(report.progress.incompleteReason).toBe('candidate-bound')
      }
      const fixed = structuredClone(report.results[0].loadout)
      fixed.weapon!.lock = 'equipmentAndDecorations'
      for (const part of ARMOR_LOADOUT_SLOTS) fixed.armor[part]!.lock = 'equipmentAndDecorations'
      if (!fixed.charm) {
        const kind = snapshot.charmClasses[0]
        fixed.charm = { kind: 'charm', gameId, classId: kind.classId, classNameCn: kind.nameCn, slots: 0, skill1: null, skill2: null, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'equipmentAndDecorations' }
      } else fixed.charm.lock = 'equipmentAndDecorations'
      const fixedCalculation = calculateLoadout(snapshot, fixed)
      const missing = snapshot.skills.flatMap(skill => skill.activations.filter(activation => activation.direction === 'positive' && activation.threshold > (fixedCalculation.skills.find(value => value.skillId === skill.skillId)?.total ?? 0)).map(activation => ({ activationKey: activation.activationKey, skillId: skill.skillId, threshold: activation.threshold, nameCn: activation.nameCn })))[0]
      expect(missing).toBeTruthy()
      const impossible = await runAutoLoadout(snapshot, { ...request, requestId: randomUUID(), baseLoadout: fixed, targets: [missing] }, context)
      expect(impossible.results).toEqual([])
      expect(impossible.progress.searchComplete).toBe(true)
      expect(impossible.progress.incompleteReason).toBeUndefined()
    } finally { db.close() }
  }, 30000)
})
