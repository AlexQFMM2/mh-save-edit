import { createHash, randomUUID } from 'node:crypto'
import { closeSync, copyFileSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { applyPatches, bufferToHex, diffBuffers, hexToBuffer, readU16, writeU16, type BytePatch } from './binary'
import { SaveCatalogResolver } from './catalogResolver'
import { Mh3uSaveAdapter } from './adapters/mh3u'
import { Mh4gSaveAdapter } from './adapters/mh4g'
import { MhguSaveAdapter } from './adapters/mhgu'
import type { SaveDocumentAdapter } from './adapters/types'
import type { LoadoutSlot, LogicalLoadout } from '../loadout/types'
import { SAVE_BOX_ITEM_STACK_MAX, type SaveBoxDomain, SaveBoxSection, SaveBoxWriteTarget, SaveBoxWriteTargetRequest, SaveCatalogEquipmentRequest, SaveCatalogItemRequest, SaveCatalogItemWritePreview, SaveCharacterSummary, SaveCommand, SaveDiagnostic, SaveExportRequest, SaveFormatId, SaveImportApplyRequest, SaveImportPreview, SaveImportRequest, SaveLoadoutWritePreview, SaveLoadoutWriteRequest, SaveMutationResult, SaveOpenRequest, SaveOpenResult, SavePalicoSection, SavePersonalSection, SaveResult, SaveSectionRequest, SaveSectionSnapshot, SaveSessionSnapshot, SaveValidationResult } from './types'

type HistoryEntry = { patches: BytePatch[]; section: SaveSectionSnapshot['kind']; message: string }
type OpenSession = {
  id: string
  adapter: SaveDocumentAdapter
  path: string
  fingerprint: string
  baseline: Buffer
  revision: number
  undo: HistoryEntry[]
  redo: HistoryEntry[]
  state: SaveSessionSnapshot['state']
}
type ImportedRecord = { slot: number; itemId?: number; count?: number; recordHex?: string }
type ImportDraft = { sessionId: string; revision: number; domain: SaveBoxDomain; records: ImportedRecord[]; replaceAll: boolean }
type WritableLoadoutEntry = NonNullable<LogicalLoadout['weapon'] | LogicalLoadout['charm'] | LogicalLoadout['armor'][keyof LogicalLoadout['armor']]>

function hash(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex') }

function createAdapter(bytes: Buffer, request: SaveOpenRequest, fileName: string): SaveDocumentAdapter {
  if (request.formatId === 'mh3g-3ds-citra' || request.formatId === 'mh3u-wiiu-cemu') return new Mh3uSaveAdapter(bytes, request.formatId)
  if (request.formatId === 'mh4g-3ds-citra') return new Mh4gSaveAdapter(bytes)
  return new MhguSaveAdapter(bytes, request.formatId, fileName)
}

export class SaveSessionService {
  private session: OpenSession | null = null
  private readonly listeners = new Set<(snapshot: SaveSessionSnapshot | null) => void>()
  private readonly resolver: SaveCatalogResolver
  private readonly sectionCache = new Map<string, SaveSectionSnapshot>()
  private readonly imports = new Map<string, ImportDraft>()
  constructor(dataDir: string) { this.resolver = new SaveCatalogResolver(dataDir) }

  subscribe(listener: (snapshot: SaveSessionSnapshot | null) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  suggestedFileName() { return this.session ? basename(this.session.path) : 'system' }
  private emit() { const snapshot = this.snapshot(); for (const listener of this.listeners) listener(snapshot) }
  private current(): OpenSession { if (!this.session) throw new Error('尚未读取存档'); return this.session }
  snapshot(): SaveSessionSnapshot | null {
    const session = this.session
    if (!session) return null
    const adapter = session.adapter
    const character = adapter.selectedCharacter == null ? null : adapter.characters()[adapter.selectedCharacter]
    const diagnostics = adapter.validate()
    const readOnly = diagnostics.some(issue => issue.severity === 'error')
    return {
      sessionId: session.id, revision: session.revision, state: session.state, contentGameId: adapter.meta.contentGameId, formatId: adapter.meta.formatId,
      platform: adapter.meta.platform, emulator: adapter.meta.emulator, fileName: basename(session.path), characterSlot: adapter.selectedCharacter,
      characterName: character?.name ?? null, dirty: !adapter.payload.equals(session.baseline), readOnly, undoCount: session.undo.length, redoCount: session.redo.length,
      diagnostics, capabilities: { canWrite: !readOnly, canSaveAs: true, canEditPersonal: !readOnly, canEditItems: !readOnly, canEditEquipment: !readOnly, canEditPalicoes: !readOnly && adapter.meta.palicoCount > 0, canSwapItems: false, canSwapEquipment: false, hasCharacters: adapter.characters().length > 1, hasPalicoes: adapter.meta.palicoCount > 0, itemCapacity: adapter.meta.itemCapacity, itemCountMax: adapter.meta.itemCountMax, hunterEquipmentCapacity: adapter.meta.hunterEquipmentCapacity, palicoEquipmentCapacity: adapter.meta.palicoEquipmentCapacity },
    }
  }
  openPath(path: string, request: SaveOpenRequest): SaveOpenResult {
    if (this.session) throw new Error('请先关闭当前存档')
    const bytes = readFileSync(path)
    const adapter = createAdapter(bytes, request, basename(path))
    if (adapter.meta.contentGameId !== request.contentGameId) throw new Error('存档内容版本与当前游戏不一致')
    const characters = adapter.characters()
    if (characters.length === 1) adapter.selectCharacter(0)
    this.session = { id: randomUUID(), adapter, path, fingerprint: hash(bytes), baseline: Buffer.from(adapter.payload), revision: 1, undo: [], redo: [], state: adapter.selectedCharacter == null ? 'selectingCharacter' : 'readyClean' }
    this.sectionCache.clear(); this.emit()
    return { cancelled: false, session: this.snapshot(), characters }
  }
  selectCharacter(sessionId: string, slot: number, revision?: number): SaveSessionSnapshot {
    const session = this.requireIdentity(sessionId, revision)
    if (!session.adapter.payload.equals(session.baseline)) throw new Error('存档存在未保存修改，不能切换角色')
    session.adapter.selectCharacter(slot); session.revision += 1; session.state = session.adapter.payload.equals(session.baseline) ? 'readyClean' : 'readyDirty'; this.sectionCache.clear(); this.emit()
    return this.snapshot()!
  }
  characters(sessionId: string, revision?: number): SaveCharacterSummary[] { return this.requireIdentity(sessionId, revision).adapter.characters() }
  private requireIdentity(sessionId: string, revision?: number) { const session = this.current(); if (session.id !== sessionId) throw new Error('存档会话已失效'); if (revision != null && session.revision !== revision) throw new Error('存档已发生变化，请刷新后重试'); return session }

  getSection(request: SaveSectionRequest): SaveSectionSnapshot {
    const session = this.requireIdentity(request.sessionId, request.revision)
    const page = Math.max(1, request.page ?? 1); const domain = request.domain ?? (request.section === 'item-box' ? 'items' : 'hunter-equipment')
    const cacheKey = `${session.id}:${session.revision}:${session.adapter.selectedCharacter}:${request.section}:${page}:${domain}:${request.selectedIndex ?? -1}:${request.query ?? ''}:${request.locateAfterSlot ?? -1}`
    const cached = this.sectionCache.get(cacheKey); if (cached) return cached
    const adapter = session.adapter
    let result: SaveSectionSnapshot
    if (request.section === 'personal-info') result = { kind: 'personal-info', fields: adapter.personalFields() } satisfies SavePersonalSection
    else if (request.section === 'item-box') result = this.itemSection(adapter, page, request.query, request.locateAfterSlot)
    else if (request.section === 'equipment-box') result = this.equipmentSection(adapter, page, domain === 'palico-equipment', request.query, request.locateAfterSlot)
    else {
      if (!adapter.meta.palicoCount) throw new Error('当前存档没有猎猫数据')
      const entries = adapter.palicoSummaries().map(value => ({ ...value, ...this.resolver.palicoLabels(value.forte, value.target) }))
      const selectedIndex = request.selectedIndex ?? entries.find(value => !value.empty)?.index ?? 0
      const selected = adapter.palico(selectedIndex); Object.assign(selected, this.resolver.palicoLabels(selected.forte, selected.target))
      result = { kind: 'palico', entries, selected, generationRules: this.resolver.palicoGenerationRules() } satisfies SavePalicoSection
    }
    this.sectionCache.set(cacheKey, result); return result
  }
  private itemSection(adapter: SaveDocumentAdapter, page: number, query?: string, locateAfterSlot?: number): SaveBoxSection {
    const pages = Math.ceil(adapter.meta.itemCapacity / 100); const current = Math.min(page, pages); const start = (current - 1) * 100
    const all = adapter.items(0, adapter.meta.itemCapacity); const cells = all.slice(start, start + 100).map(cell => this.resolver.item(adapter.meta.contentGameId, cell))
    const normalized = query?.trim().toLocaleLowerCase() ?? ''; const ids = normalized ? this.resolver.itemSearchIds(adapter.meta.contentGameId, normalized) : null
    const matchingSlots = normalized ? this.rotateMatches(all.filter(cell => !cell.empty && (ids!.has(cell.itemId) || `${cell.itemId} 0x${cell.itemId.toString(16)}`.includes(normalized))).map(cell => cell.slot), locateAfterSlot) : undefined
    return { kind: 'item-box', domain: 'items', page: current, pageSize: 100, pageCount: pages, totalSlots: adapter.meta.itemCapacity, nonEmptyCount: all.filter(value => !value.empty).length, cells, query: query?.trim() ?? '', matchingSlots, matchingCount: matchingSlots?.length }
  }
  private equipmentSection(adapter: SaveDocumentAdapter, page: number, palico: boolean, query?: string, locateAfterSlot?: number): SaveBoxSection {
    const capacity = palico ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    if (!capacity) throw new Error('当前存档没有该装备箱域')
    const pages = Math.ceil(capacity / 100); const current = Math.min(page, pages); const start = (current - 1) * 100
    const all = Array.from({ length: capacity }, (_, slot) => adapter.equipment(slot, palico)); const cells = all.slice(start, start + 100).map(cell => this.resolver.equipment(adapter.meta.contentGameId, cell))
    const normalized = query?.trim().toLocaleLowerCase() ?? ''; const keys = normalized ? this.resolver.equipmentSearchKeys(adapter.meta.contentGameId, normalized, palico) : null
    const matchingSlots = normalized ? this.rotateMatches(all.filter(cell => !cell.empty && (keys!.has(`${cell.saveType}:${cell.saveId}`) || `${cell.saveType} ${cell.saveId} 0x${cell.saveId.toString(16)}`.includes(normalized))).map(cell => cell.slot), locateAfterSlot) : undefined
    return { kind: 'equipment-box', domain: palico ? 'palico-equipment' : 'hunter-equipment', page: current, pageSize: 100, pageCount: pages, totalSlots: capacity, nonEmptyCount: all.filter(value => !value.empty).length, cells, query: query?.trim() ?? '', matchingSlots, matchingCount: matchingSlots?.length }
  }
  private rotateMatches(slots: number[], locateAfterSlot?: number): number[] {
    if (locateAfterSlot == null || slots.length < 2) return slots
    const next = slots.findIndex(slot => slot > locateAfterSlot); return next < 0 ? [...slots] : [...slots.slice(next), ...slots.slice(0, next)]
  }

  apply(command: SaveCommand): SaveMutationResult {
    const session = this.requireIdentity(command.sessionId, command.revision)
    if (this.snapshot()!.readOnly) throw new Error('当前存档处于只读保护')
    const before = Buffer.from(session.adapter.payload)
    let section: SaveSectionSnapshot['kind']; let message = ''
    try {
      if (command.kind === 'set-personal-field') { session.adapter.setPersonalField(command.field, command.value); section = 'personal-info'; message = '个人信息已加入修改草稿，尚未保存到文件。' }
      else if (command.kind === 'set-item') { session.adapter.setItem(command.slot, command.itemId, command.count); section = 'item-box'; message = `道具箱第 ${Math.floor(command.slot / 100) + 1} 页第 ${command.slot % 100 + 1} 格已修改，尚未保存。` }
      else if (command.kind === 'set-equipment-record') { session.adapter.setEquipment(command.slot, hexToBuffer(command.recordHex, session.adapter.meta.recordSize), command.domain === 'palico-equipment'); section = 'equipment-box'; message = `装备箱第 ${Math.floor(command.slot / 100) + 1} 页第 ${command.slot % 100 + 1} 格已修改，尚未保存。` }
      else if (command.kind === 'set-equipment-fields') { this.patchEquipment(session.adapter, command.domain, command.slot, command.changes); section = 'equipment-box'; message = `装备箱第 ${Math.floor(command.slot / 100) + 1} 页第 ${command.slot % 100 + 1} 格已修改，尚未保存。` }
      else if (command.kind === 'set-palico') { session.adapter.setPalico(command.index, command.changes); section = 'palico'; message = `猎猫 ${command.index + 1} 已修改，等级与 EXP 保持原值，尚未保存。` }
      else {
        const isItems = command.domain === 'items'; const palico = command.domain === 'palico-equipment'; const capacity = isItems ? session.adapter.meta.itemCapacity : palico ? session.adapter.meta.palicoEquipmentCapacity : session.adapter.meta.hunterEquipmentCapacity
        const targetSlot = command.kind === 'copy-box-slot' ? command.targetSlot ?? this.firstEmpty(session.adapter, command.domain) : command.kind === 'swap-box-slots' ? command.targetSlot : undefined
        const slots = 'slot' in command ? [command.slot] : [command.sourceSlot, targetSlot]; for (const slot of slots) if (slot == null || slot < 0 || slot >= capacity) throw new Error(command.kind === 'copy-box-slot' && targetSlot === -1 ? '目标箱域已满，没有可复制到的空格' : '箱格超出范围')
        if (command.kind === 'clear-box-slot') isItems ? session.adapter.setItem(command.slot, 0, 0) : session.adapter.setEquipment(command.slot, Buffer.alloc(session.adapter.meta.recordSize), palico)
        else if (command.kind === 'copy-box-slot') {
          if (targetSlot == null) throw new Error('没有可用的复制目标格')
          if (isItems) { const value = session.adapter.item(command.sourceSlot); if (value.empty) throw new Error('不能复制空道具格'); session.adapter.setItem(targetSlot, value.itemId, value.count) }
          else { const value = session.adapter.equipment(command.sourceSlot, palico); if (value.empty) throw new Error('不能复制空装备格'); session.adapter.setEquipment(targetSlot, hexToBuffer(value.recordHex), palico) }
          message = `已复制到第 ${Math.floor(targetSlot / 100) + 1} 页第 ${targetSlot % 100 + 1} 格，尚未保存。`
        }
        else {
          const snapshot = this.snapshot()!; if (isItems ? !snapshot.capabilities.canSwapItems : !snapshot.capabilities.canSwapEquipment) throw new Error('当前格式尚未开放安全物理换位')
          if (isItems) { const a = session.adapter.item(command.sourceSlot); const b = session.adapter.item(command.targetSlot); session.adapter.setItem(command.sourceSlot, b.itemId, b.count); session.adapter.setItem(command.targetSlot, a.itemId, a.count) }
          else { const a = hexToBuffer(session.adapter.equipment(command.sourceSlot, palico).recordHex); const b = hexToBuffer(session.adapter.equipment(command.targetSlot, palico).recordHex); session.adapter.setEquipment(command.sourceSlot, b, palico); session.adapter.setEquipment(command.targetSlot, a, palico) }
        }
        section = isItems ? 'item-box' : 'equipment-box'; if (!message) message = '箱格操作已加入修改草稿，尚未保存。'
      }
    } catch (error) { session.adapter.payload = before; throw error }
    const patches = diffBuffers(before, session.adapter.payload)
    if (patches.length) { session.undo.push({ patches, section, message }); session.redo = []; session.revision += 1 }
    session.state = session.adapter.payload.equals(session.baseline) ? 'readyClean' : 'readyDirty'; this.sectionCache.clear(); this.emit()
    return { session: this.snapshot()!, affectedSections: [section], message }
  }
  private patchEquipment(adapter: SaveDocumentAdapter, domain: 'hunter-equipment' | 'palico-equipment', slot: number, changes: Extract<SaveCommand, { kind: 'set-equipment-fields' }>['changes']) {
    const palico = domain === 'palico-equipment'; const current = adapter.equipment(slot, palico); const source = changes.reset ? Buffer.alloc(adapter.meta.recordSize) : hexToBuffer(current.recordHex, adapter.meta.recordSize)
    adapter.setEquipment(slot, this.patchEquipmentRecord(adapter, domain, source, changes), palico)
  }
  private patchEquipmentRecord(adapter: SaveDocumentAdapter, domain: 'hunter-equipment' | 'palico-equipment', source: Buffer, changes: Extract<SaveCommand, { kind: 'set-equipment-fields' }>['changes']): Buffer {
    const palico = domain === 'palico-equipment'; const record = Buffer.from(source); const format = adapter.meta.formatId
    if (record.length !== adapter.meta.recordSize) throw new Error(`装备记录必须为 ${adapter.meta.recordSize} 字节`)
    if (palico) {
      const nextType = changes.saveType ?? record[0]
      const nextAppearance = changes.appearanceId ?? readU16(record, 4)
      if ((changes.appearanceId != null || changes.saveType != null) && nextType === 22 && nextAppearance !== 0) throw new Error('GU/XX 猫武器不支持外观替换，已阻止写入')
      if ((changes.appearanceId != null || changes.saveType != null) && (nextType === 23 || nextType === 24) && nextAppearance !== 0 && !this.resolver.resolveEquipmentIdentity(adapter.meta.contentGameId, nextType, nextAppearance, true)) throw new Error('猫防具外观必须属于相同部位')
      if (changes.saveType != null) record[0] = changes.saveType; if (changes.level != null) record[1] = changes.level; if (changes.saveId != null) writeU16(record, 2, changes.saveId); if (changes.appearanceId != null) writeU16(record, 4, changes.appearanceId)
    } else if (format === 'mhgu-switch-yuzu' || format === 'mhxx-3ds-citra') {
      if (changes.skill1Id != null && changes.skill1Id > 0xff || changes.skill2Id != null && changes.skill2Id > 0xff) throw new Error('GU/XX 护石技能 ID 超出 8 位编码范围')
      const nextType = changes.saveType ?? (readU16(record, 0) & 0x1f); const nextAppearance = changes.appearanceId ?? readU16(record, 4)
      if ((changes.appearanceId != null || changes.saveType != null) && nextAppearance !== 0 && nextType >= 7) throw new Error('GU/XX 猎人武器不支持外观替换，已阻止写入')
      if ((changes.appearanceId != null || changes.saveType != null) && nextAppearance !== 0 && nextType >= 1 && nextType <= 5 && !this.resolver.resolveArmorAppearance(adapter.meta.contentGameId, nextType, nextAppearance)) throw new Error('GU/XX 猎人防具外观必须属于相同部位且存在')
      let packed = readU16(record, 0); if (changes.saveType != null) packed = (packed & ~0x1f) | (changes.saveType & 0x1f); if (changes.level != null) packed = (packed & ~(0x1f << 5)) | ((changes.level & 0x1f) << 5); writeU16(record, 0, packed)
      if (changes.saveId != null) writeU16(record, 2, changes.saveId); if (changes.appearanceId != null) writeU16(record, 4, changes.appearanceId); changes.decorations?.forEach((value, index) => writeU16(record, 6 + index * 2, value))
      if (changes.skill1Id != null) record[12] = changes.skill1Id & 0xff; if (changes.skill2Id != null) record[13] = changes.skill2Id & 0xff; if (changes.skill1Points != null) record.writeInt8(changes.skill1Points, 14); if (changes.skill2Points != null) record.writeInt8(changes.skill2Points, 15); if (changes.slots != null) record[16] = changes.slots
    } else {
      if (format !== 'mh4g-3ds-citra' && (changes.skill1Id != null && changes.skill1Id > 0xff || changes.skill2Id != null && changes.skill2Id > 0xff)) throw new Error('MH3G/MH3U 护石技能 ID 超出 8 位编码范围')
      if (changes.saveType != null) record[0] = changes.saveType; if (changes.level != null) record[1] = changes.level; if (changes.saveId != null) writeU16(record, 2, changes.saveId)
      const mh4g = format === 'mh4g-3ds-citra'; const decorationOffset = mh4g ? 6 : 8; changes.decorations?.forEach((value, index) => writeU16(record, decorationOffset + index * 2, value))
      if (mh4g) { if (changes.skill1Id != null) writeU16(record, 12, changes.skill1Id); if (changes.skill1Points != null) record.writeInt16LE(changes.skill1Points, 14); if (changes.skill2Id != null) writeU16(record, 16, changes.skill2Id); if (changes.skill2Points != null) record.writeInt16LE(changes.skill2Points, 18) }
      else { if (changes.skill1Id != null) record[4] = changes.skill1Id & 0xff; if (changes.skill1Points != null) record.writeInt8(changes.skill1Points, 5); if (changes.skill2Id != null) record[6] = changes.skill2Id & 0xff; if (changes.skill2Points != null) record.writeInt8(changes.skill2Points, 7) }
      if (changes.slots != null) record[1] = changes.slots
    }
    if (!palico && (format === 'mhgu-switch-yuzu' || format === 'mhxx-3ds-citra') && (readU16(record, 0) & 0x1f) === 6) {
      const markers = [0, 97, 97, 98, 98, 99, 99, 99, 100, 100, 100]
      const classId = readU16(record, 2)
      record[17] = 0
      record[18] = markers[classId] ?? 0
      record[19] = 1
    }
    return record
  }
  undo(sessionId: string, revision: number): SaveMutationResult { const session = this.requireIdentity(sessionId, revision); const entry = session.undo.pop(); if (!entry) throw new Error('没有可撤销的修改'); applyPatches(session.adapter.payload, entry.patches, 'backward'); session.redo.push(entry); session.revision += 1; session.state = session.adapter.payload.equals(session.baseline) ? 'readyClean' : 'readyDirty'; this.sectionCache.clear(); this.emit(); return { session: this.snapshot()!, affectedSections: [entry.section], message: '已撤销上一步修改，尚未保存。' } }
  redo(sessionId: string, revision: number): SaveMutationResult { const session = this.requireIdentity(sessionId, revision); const entry = session.redo.pop(); if (!entry) throw new Error('没有可重做的修改'); applyPatches(session.adapter.payload, entry.patches, 'forward'); session.undo.push(entry); session.revision += 1; session.state = 'readyDirty'; this.sectionCache.clear(); this.emit(); return { session: this.snapshot()!, affectedSections: [entry.section], message: '已重做修改，尚未保存。' } }
  validate(sessionId: string, revision: number): SaveValidationResult { const session = this.requireIdentity(sessionId, revision); const diagnostics = session.adapter.validate(); return { valid: !diagnostics.some(issue => issue.severity === 'error'), diagnostics } }
  save(sessionId: string, revision: number, targetPath?: string): SaveResult {
    const session = this.requireIdentity(sessionId, revision); const validation = this.validate(sessionId, revision); if (!validation.valid) throw new Error('存档校验未通过，已阻止保存')
    session.state = 'saving'; this.emit(); const output = session.adapter.serialize(); const destination = targetPath ?? session.path
    let backup: string | undefined
    try {
      if (!targetPath) { if (!existsSync(session.path) || hash(readFileSync(session.path)) !== session.fingerprint) throw new Error('磁盘上的存档已被外部修改，请另存为或重新读取'); backup = `${session.path}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`; copyFileSync(session.path, backup) }
      this.atomicWrite(destination, output)
      const written = readFileSync(destination)
      if (!written.equals(output)) throw new Error('保存后的文件与待写入数据不一致')
      const reopened = createAdapter(written, { contentGameId: session.adapter.meta.contentGameId, formatId: session.adapter.meta.formatId }, basename(destination))
      if (session.adapter.selectedCharacter != null && reopened.characters().length > 1) reopened.selectCharacter(session.adapter.selectedCharacter)
      const reopenedErrors = reopened.validate().filter(issue => issue.severity === 'error')
      if (reopenedErrors.length) throw new Error(`保存后复核失败：${reopenedErrors.map(issue => issue.message).join('；')}`)
      session.path = destination; session.fingerprint = hash(output); session.baseline = Buffer.from(session.adapter.payload); session.undo = []; session.redo = []; session.revision += 1; session.state = 'readyClean'; this.sectionCache.clear(); this.emit(); return { cancelled: false, session: this.snapshot()!, message: `已安全保存并复核 ${basename(destination)}` }
    } catch (error) {
      if (backup && existsSync(backup)) this.atomicWrite(destination, readFileSync(backup))
      session.state = 'readyDirty'; this.emit(); throw error
    }
  }
  exportBox(request: SaveExportRequest, targetPath: string) {
    const session = this.requireIdentity(request.sessionId, request.revision)
    const adapter = session.adapter
    const capacity = request.domain === 'items' ? adapter.meta.itemCapacity : request.domain === 'palico-equipment' ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    if (!capacity) throw new Error('当前存档没有该箱子域')
    const records: ImportedRecord[] = request.domain === 'items'
      ? adapter.items(0, capacity).filter(value => !value.empty).map(value => ({ slot: value.slot, itemId: value.itemId, count: value.count }))
      : Array.from({ length: capacity }, (_, slot) => adapter.equipment(slot, request.domain === 'palico-equipment')).filter(value => !value.empty).map(value => ({ slot: value.slot, recordHex: value.recordHex }))
    if (request.format === 'csv') {
      writeFileSync(targetPath, `\ufeff${this.exportLegacyCsv(adapter, request.domain).join('\r\n')}\r\n`, 'utf8'); return
    }
    const data = { schemaVersion: 1, formatId: adapter.meta.formatId, contentGameId: adapter.meta.contentGameId, domain: request.domain, recordSize: adapter.meta.recordSize, capacity, records }
    const digest = hash(Buffer.from(JSON.stringify(data)))
    writeFileSync(targetPath, JSON.stringify({ ...data, sha256: digest }, null, 2), 'utf8')
  }
  previewBoxWriteTarget(request: SaveBoxWriteTargetRequest): SaveBoxWriteTarget {
    const session = this.requireIdentity(request.sessionId, request.revision)
    const adapter = session.adapter
    const capacity = request.domain === 'items' ? adapter.meta.itemCapacity : request.domain === 'palico-equipment' ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    if (!capacity) throw new Error('当前存档没有该箱子域')
    const slot = this.firstEmpty(adapter, request.domain)
    let nonEmptyCount = 0
    if (request.domain === 'items') nonEmptyCount = adapter.items(0, capacity).reduce((total, value) => total + Number(!value.empty), 0)
    else for (let index = 0; index < capacity; index += 1) nonEmptyCount += Number(!adapter.equipment(index, request.domain === 'palico-equipment').empty)
    return { domain: request.domain, slot: slot < 0 ? null : slot, page: slot < 0 ? null : Math.floor(slot / 100) + 1, cell: slot < 0 ? null : slot % 100 + 1, capacity, nonEmptyCount, full: slot < 0 }
  }
  previewImport(request: SaveImportRequest, sourcePath: string): SaveImportPreview {
    const session = this.requireIdentity(request.sessionId, request.revision)
    const adapter = session.adapter
    const capacity = request.domain === 'items' ? adapter.meta.itemCapacity : request.domain === 'palico-equipment' ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    if (!capacity) throw new Error('当前存档没有该箱子域')
    let records: ImportedRecord[] = []
    const diagnostics: SaveDiagnostic[] = []
    if (request.format === 'csv') {
      records = this.importLegacyCsv(adapter, request.domain, readFileSync(sourcePath, 'utf8'), diagnostics)
    } else {
      const document = JSON.parse(readFileSync(sourcePath, 'utf8')) as Record<string, unknown>
      if (
        document.schemaVersion !== 1
        || document.formatId !== adapter.meta.formatId
        || document.contentGameId !== adapter.meta.contentGameId
        || document.domain !== request.domain
        || document.recordSize !== adapter.meta.recordSize
        || document.capacity !== capacity
        || !Array.isArray(document.records)
      ) throw new Error('完整备份与当前存档格式、目标箱域或容量不匹配')
      const { sha256: claimed, ...unsigned } = document
      if (typeof claimed !== 'string' || hash(Buffer.from(JSON.stringify(unsigned))) !== claimed) throw new Error('箱子备份摘要校验失败')
      for (const [index, candidate] of (document.records as unknown[]).entries()) {
        const value = candidate as Partial<ImportedRecord>
        const validSlot = Number.isInteger(value.slot) && value.slot! >= 0 && value.slot! < capacity
        const validValue = request.domain === 'items'
          ? Number.isInteger(value.itemId) && value.itemId! >= 0 && Number.isInteger(value.count) && value.count! >= 0
          : typeof value.recordHex === 'string' && /^[0-9a-f]+$/i.test(value.recordHex) && value.recordHex.length === adapter.meta.recordSize * 2
        if (!validSlot || !validValue) {
          diagnostics.push({ code: 'import.record.invalid', path: `records.${index}`, severity: 'warning', message: `第 ${index + 1} 条备份记录无效，将忽略` })
          continue
        }
        records.push(value as ImportedRecord)
      }
    }
    records = records.filter((record, index) => {
      const valid = this.importedRecordEncodable(adapter, request.domain, record)
      if (valid) return true
      diagnostics.push({ code: 'import.record.encoding', path: `records.${index}`, severity: 'warning', message: `第 ${index + 1} 条记录超出当前存档编码范围，将忽略` })
      return false
    })
    const unique = new Map<number, ImportedRecord>()
    for (const record of records) {
      if (unique.has(record.slot)) diagnostics.push({ code: 'import.slot.duplicate', path: `slots.${record.slot}`, severity: 'warning', message: `物理格 ${record.slot + 1} 重复，将保留最后一条记录` })
      unique.set(record.slot, record)
    }
    records = [...unique.values()].sort((a, b) => a.slot - b.slot)
    if (!records.length) throw new Error('导入文件中没有可应用的有效箱格')
    const invalid = diagnostics.length
    let added = 0; let overwritten = 0; let cleared = 0; let unknown = 0
    for (const record of records) {
      const emptyBefore = request.domain === 'items' ? adapter.item(record.slot).empty : adapter.equipment(record.slot, request.domain === 'palico-equipment').empty
      const emptyAfter = request.domain === 'items' ? !record.itemId : /^0+$/.test(record.recordHex ?? '')
      if (emptyBefore && !emptyAfter) added += 1
      else if (!emptyBefore && emptyAfter) cleared += 1
      else if (!emptyBefore && !emptyAfter) overwritten += 1
      if (!emptyAfter) {
        const known = request.domain === 'items'
          ? this.resolver.itemKnown(adapter.meta.contentGameId, record.itemId!)
          : (() => { const bytes = hexToBuffer(record.recordHex!, adapter.meta.recordSize); const saveType = (adapter.meta.formatId === 'mhgu-switch-yuzu' || adapter.meta.formatId === 'mhxx-3ds-citra') && request.domain === 'hunter-equipment' ? readU16(bytes, 0) & 0x1f : bytes[0]; return this.resolver.equipmentKnown(adapter.meta.contentGameId, saveType, readU16(bytes, 2), request.domain === 'palico-equipment') })()
        if (!known) { unknown += 1; diagnostics.push({ code: 'import.record.unknown', path: `slots.${record.slot}`, severity: 'warning', message: `物理格 ${record.slot + 1} 的资料身份未知；应用后仍会保留原始值` }) }
      }
    }
    const token = randomUUID(); this.imports.set(token, { sessionId: session.id, revision: session.revision, domain: request.domain, records, replaceAll: false })
    return { token, format: request.format, domain: request.domain, added, overwritten, cleared, invalid, unknown, ignored: invalid, diagnostics }
  }
  applyImport(request: SaveImportApplyRequest): SaveMutationResult {
    const session = this.requireIdentity(request.sessionId, request.revision); const draft = this.imports.get(request.token)
    if (this.snapshot()!.readOnly) throw new Error('当前存档处于只读保护')
    if (!draft || draft.sessionId !== session.id || draft.revision !== session.revision) throw new Error('导入预览已失效，请重新选择文件')
    const adapter = session.adapter; const before = Buffer.from(adapter.payload); const palico = draft.domain === 'palico-equipment'
    const capacity = draft.domain === 'items' ? adapter.meta.itemCapacity : palico ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    try {
      if (request.replaceAll) for (let slot = 0; slot < capacity; slot += 1) draft.domain === 'items' ? adapter.setItem(slot, 0, 0) : adapter.setEquipment(slot, Buffer.alloc(adapter.meta.recordSize), palico)
      for (const record of draft.records) draft.domain === 'items' ? adapter.setItem(record.slot, record.itemId!, record.count!) : adapter.setEquipment(record.slot, hexToBuffer(record.recordHex!, adapter.meta.recordSize), palico)
    } catch (error) { adapter.payload = before; throw error }
    const section = draft.domain === 'items' ? 'item-box' as const : 'equipment-box' as const; const patches = diffBuffers(before, adapter.payload)
    if (patches.length) { session.undo.push({ patches, section, message: '箱子导入已加入修改草稿，尚未保存。' }); session.redo = []; session.revision += 1 }
    session.state = adapter.payload.equals(session.baseline) ? 'readyClean' : 'readyDirty'; this.imports.delete(request.token); this.sectionCache.clear(); this.emit()
    return { session: this.snapshot()!, affectedSections: [section], message: '箱子导入已加入修改草稿，尚未保存。' }
  }
  addCatalogItem(request: SaveCatalogItemRequest): SaveMutationResult {
    const session = this.requireIdentity(request.sessionId, request.revision)
    const prepared = this.prepareCatalogItemWrite(session, request)
    const before = Buffer.from(session.adapter.payload)
    try { for (const target of prepared.targets) session.adapter.setItem(target.slot, request.saveId, target.afterCount) } catch (error) { session.adapter.payload = before; throw error }
    const patches = diffBuffers(before, session.adapter.payload); if (!patches.length) throw new Error('道具加入没有产生可写入修改')
    const locations = prepared.targets.map(target => `第 ${Math.floor(target.slot / 100) + 1} 页第 ${target.slot % 100 + 1} 格`).join('、')
    const message = `${prepared.itemNameCn} 已加入道具箱：${locations}，尚未保存。`
    session.undo.push({ patches, section: 'item-box', message }); session.redo = []; session.revision += 1; session.state = 'readyDirty'; this.sectionCache.clear(); this.emit()
    return { session: this.snapshot()!, affectedSections: ['item-box'], message }
  }
  previewCatalogItemWrite(request: SaveCatalogItemRequest): SaveCatalogItemWritePreview {
    const session = this.requireIdentity(request.sessionId, request.revision)
    return this.prepareCatalogItemWrite(session, request)
  }
  private prepareCatalogItemWrite(session: OpenSession, request: SaveCatalogItemRequest): SaveCatalogItemWritePreview {
    if (this.snapshot()!.readOnly) throw new Error('当前存档处于只读保护')
    if (session.adapter.meta.contentGameId !== request.gameId) throw new Error('图鉴与当前存档版本不一致')
    const item = this.resolver.requireItem(request.gameId, request.saveId)
    const maximum = Math.min(session.adapter.meta.itemCountMax, SAVE_BOX_ITEM_STACK_MAX)
    if (request.count < 1) throw new Error(`${item.nameCn}的加入数量必须至少为 1`)
    const all = session.adapter.items(0, session.adapter.meta.itemCapacity)
    const nonEmptyCount = all.filter(value => !value.empty).length
    const targets: SaveCatalogItemWritePreview['targets'] = []
    let remaining = request.count
    const preferred = request.targetSlot == null ? [] : [request.targetSlot]
    for (const slot of preferred) {
      if (slot < 0 || slot >= session.adapter.meta.itemCapacity) throw new Error('指定道具格超出范围')
      const current = all[slot]
      if (!current.empty && current.itemId !== request.saveId) throw new Error(`指定道具格已有其他道具：第 ${Math.floor(slot / 100) + 1} 页第 ${slot % 100 + 1} 格`)
    }
    const candidates = [...preferred, ...all.filter(value => value.itemId === request.saveId && !preferred.includes(value.slot)).map(value => value.slot), ...all.filter(value => value.empty && !preferred.includes(value.slot)).map(value => value.slot)]
    for (const slot of candidates) {
      if (remaining <= 0) break
      const current = all[slot]
      const beforeCount = current.itemId === request.saveId ? current.count : 0
      const available = maximum - beforeCount
      if (available <= 0) continue
      const addedCount = Math.min(remaining, available)
      targets.push({ slot, page: Math.floor(slot / 100) + 1, cell: slot % 100 + 1, beforeCount, afterCount: beforeCount + addedCount, addedCount })
      remaining -= addedCount
    }
    if (remaining > 0) throw new Error(`道具箱空间不足：还需要 ${remaining} 个 ${item.nameCn}，每格上限为 ${maximum}`)
    return { capacity: session.adapter.meta.itemCapacity, nonEmptyCount, itemNameCn: item.nameCn, requestedCount: request.count, targets }
  }
  addCatalogEquipment(request: SaveCatalogEquipmentRequest): SaveMutationResult {
    const session = this.requireIdentity(request.sessionId, request.revision); if (session.adapter.meta.contentGameId !== request.gameId) throw new Error('图鉴与当前存档版本不一致')
    const slot = this.availableTarget(session.adapter, request.domain, request.targetSlot); if (slot < 0) throw new Error('装备箱已满')
    const record = this.createCatalogEquipmentRecord(session.adapter, request.domain, request.saveType, request.saveId, request.level ?? 0, request.appearanceId ?? 0)
    return this.apply({ kind: 'set-equipment-record', sessionId: session.id, revision: session.revision, domain: request.domain, slot, recordHex: bufferToHex(record) })
  }
  previewLoadoutWrite(request: SaveLoadoutWriteRequest): SaveLoadoutWritePreview {
    const session = this.requireIdentity(request.sessionId, request.revision)
    const prepared = this.prepareLoadoutWrite(session, request.loadout)
    return {
      capacity: session.adapter.meta.hunterEquipmentCapacity,
      nonEmptyCount: session.adapter.meta.hunterEquipmentCapacity - prepared.targets.length - prepared.remainingEmpty,
      requiredSlots: prepared.entries.length,
      targets: prepared.entries.map((value, index) => ({ loadoutSlot: value.loadoutSlot, nameCn: value.entry.kind === 'charm' ? value.entry.classNameCn : value.entry.nameCn, slot: prepared.targets[index], page: Math.floor(prepared.targets[index] / 100) + 1, cell: prepared.targets[index] % 100 + 1 })),
    }
  }
  addLoadout(request: SaveLoadoutWriteRequest): SaveMutationResult {
    const session = this.requireIdentity(request.sessionId, request.revision)
    const prepared = this.prepareLoadoutWrite(session, request.loadout)
    const before = Buffer.from(session.adapter.payload)
    try {
      prepared.records.forEach((record, index) => session.adapter.setEquipment(prepared.targets[index], record))
    } catch (error) { session.adapter.payload = before; throw error }
    const patches = diffBuffers(before, session.adapter.payload); if (!patches.length) throw new Error('配装没有产生可写入修改')
    const locations = prepared.targets.map(slot => `第 ${Math.floor(slot / 100) + 1} 页第 ${slot % 100 + 1} 格`).join('、')
    const message = `整套配装已加入装备箱：${locations}，尚未保存。`
    session.undo.push({ patches, section: 'equipment-box', message }); session.redo = []; session.revision += 1; session.state = 'readyDirty'; this.sectionCache.clear(); this.emit()
    return { session: this.snapshot()!, affectedSections: ['equipment-box'], message }
  }
  private prepareLoadoutWrite(session: OpenSession, loadout: LogicalLoadout) {
    if (this.snapshot()!.readOnly) throw new Error('当前存档处于只读保护')
    if (session.adapter.meta.contentGameId !== loadout.gameId) throw new Error('配装与当前存档版本不一致')
    const entries: { loadoutSlot: LoadoutSlot; entry: WritableLoadoutEntry }[] = []
    if (loadout.weapon) entries.push({ loadoutSlot: 'weapon', entry: loadout.weapon })
    for (const slot of ['head', 'chest', 'arms', 'waist', 'legs'] as const) if (loadout.armor[slot]) entries.push({ loadoutSlot: slot, entry: loadout.armor[slot]! })
    if (loadout.charm) entries.push({ loadoutSlot: 'charm', entry: loadout.charm })
    if (!entries.length) throw new Error('配装中没有可写入的装备')
    if (entries.some(({ entry }) => entry.instance?.encoding === 'blocked' || ('encoding' in entry && entry.encoding === 'blocked'))) throw new Error('配装包含结构不可编码的实例')
    const targets: number[] = []; let remainingEmpty = 0
    for (let slot = 0; slot < session.adapter.meta.hunterEquipmentCapacity; slot += 1) if (session.adapter.equipment(slot).empty) { if (targets.length < entries.length) targets.push(slot); else remainingEmpty += 1 }
    if (targets.length < entries.length) throw new Error(`装备箱空间不足：需要 ${entries.length} 格，只有 ${targets.length} 格`)
    const records = entries.map(({ entry }) => {
      if (entry.instance?.formatId && entry.instance.formatId !== session.adapter.meta.formatId) throw new Error(`${entry.kind === 'charm' ? entry.classNameCn : entry.nameCn}的实例格式与当前存档不一致`)
      if (entry.kind === 'weapon') {
        const level = entry.instance ? undefined : entry.saveLevel ?? 0
        const base = entry.instance?.recordHex
          ? this.requireTrustedInstanceRecord(session.adapter, entry.instance.recordHex, entry.saveType, entry.saveId, level)
          : this.createCatalogEquipmentRecord(session.adapter, 'hunter-equipment', entry.saveType, entry.saveId, level ?? 0, 0)
        return this.patchEquipmentRecord(session.adapter, 'hunter-equipment', base, { saveType: entry.saveType, saveId: entry.saveId, level, decorations: this.decorationValuesForRecord(session.adapter, entry.decorations), appearanceId: 0 })
      }
      if (entry.kind === 'armor') {
        if (entry.saveType == null || entry.saveId == null) throw new Error(`${entry.nameCn} 缺少存档身份`)
        const level = entry.instance ? undefined : 0
        const base = entry.instance?.recordHex
          ? this.requireTrustedInstanceRecord(session.adapter, entry.instance.recordHex, entry.saveType, entry.saveId, level)
          : this.createCatalogEquipmentRecord(session.adapter, 'hunter-equipment', entry.saveType, entry.saveId, 0, 0)
        return this.patchEquipmentRecord(session.adapter, 'hunter-equipment', base, { saveType: entry.saveType, saveId: entry.saveId, level, decorations: this.decorationValuesForRecord(session.adapter, entry.decorations) })
      }
      const base = entry.instance?.recordHex
        ? this.requireTrustedInstanceRecord(session.adapter, entry.instance.recordHex, 6, entry.classId)
        : this.createCatalogEquipmentRecord(session.adapter, 'hunter-equipment', 6, entry.classId, 0, 0)
      return this.patchEquipmentRecord(session.adapter, 'hunter-equipment', base, { saveType: 6, saveId: entry.classId, level: 0, appearanceId: 0, slots: entry.slots, decorations: this.decorationValuesForRecord(session.adapter, entry.decorations), skill1Id: entry.skill1?.skillId ?? 0, skill1Points: entry.skill1?.points ?? 0, skill2Id: entry.skill2?.skillId ?? 0, skill2Points: entry.skill2?.points ?? 0 })
    })
    return { entries, targets, records, remainingEmpty }
  }
  private createCatalogEquipmentRecord(adapter: SaveDocumentAdapter, domain: 'hunter-equipment' | 'palico-equipment', saveType: number, saveId: number, level: number, appearanceId: number): Buffer {
    const palico = domain === 'palico-equipment'
    const identity = this.resolver.requireEquipmentIdentity(adapter.meta.contentGameId, saveType, saveId, palico, !palico && saveType >= 7 ? level : undefined)
    if (palico) {
      if (saveType === 22 && appearanceId) throw new Error('GU/XX 猫武器不支持外观替换，已阻止写入')
      if ((saveType === 23 || saveType === 24) && appearanceId && !this.resolver.resolveEquipmentIdentity(adapter.meta.contentGameId, saveType, appearanceId, true)) throw new Error('猫防具外观必须属于相同部位')
      return this.patchEquipmentRecord(adapter, domain, Buffer.alloc(adapter.meta.recordSize), { saveType, saveId, level: 0, appearanceId })
    }
    let base: Buffer = Buffer.alloc(adapter.meta.recordSize)
    if (this.isGu(adapter) && (saveType === 20 || identity.kind === 'armor' && level !== 0)) {
      const trusted = this.findExistingRecord(adapter, saveType, saveId, level)
      if (!trusted) throw new Error(saveType === 20
        ? '这把操虫棍需要完整猎虫实例；当前装备箱没有可复用的同武器同等级记录，请先通过完整箱子导入或从已有记录复制'
        : '该强化等级需要完整实例；当前装备箱没有可复用的同防具同等级记录')
      base = trusted
    }
    const changes = { saveType, saveId, level, appearanceId, decorations: [0, 0, 0] }
    return this.patchEquipmentRecord(adapter, domain, base, changes)
  }
  private requireTrustedInstanceRecord(adapter: SaveDocumentAdapter, recordHex: string, saveType: number, saveId: number, expectedLevel?: number): Buffer {
    const record = hexToBuffer(recordHex, adapter.meta.recordSize)
    const gu = this.isGu(adapter)
    const packed = readU16(record, 0); const recordType = gu ? packed & 0x1f : record[0]; const recordLevel = gu ? (packed >> 5) & 0x1f : record[1]
    if (recordType !== saveType || readU16(record, 2) !== saveId || expectedLevel != null && recordLevel !== expectedLevel) throw new Error('完整装备实例的类型、ID 或等级与当前配装不一致')
    if (!gu) return record
    const exactExisting = this.findExistingRecord(adapter, saveType, saveId, recordLevel, record)
    if (exactExisting) return record
    if (saveType === 20) throw new Error('操虫棍的完整猎虫实例不在当前装备箱中，无法确认来源')
    if (saveType >= 1 && saveType <= 5 && recordLevel !== 0) throw new Error('非零强化防具实例不在当前装备箱中，无法确认来源')
    if (saveType === 6) {
      const markers = [0, 97, 97, 98, 98, 99, 99, 99, 100, 100, 100]
      const generated = record.subarray(17).every(value => value === 0)
      const persisted = record[17] === 0 && record[18] === (markers[saveId] ?? 0) && record[19] === 1 && record.subarray(20).every(value => value === 0)
      if (!generated && !persisted) throw new Error('护石实例包含无法确认来源的扩展字节')
    } else if (!record.subarray(12).every(value => value === 0)) throw new Error('装备实例包含无法确认来源的扩展字节')
    return record
  }
  private decorationValuesForRecord(adapter: SaveDocumentAdapter, values: { saveId: number; fixed?: boolean }[]): number[] {
    if (adapter.meta.formatId !== 'mh4g-3ds-citra') return values.map(value => value.saveId)
    return values.map(value => (value.saveId & 0x7fff) | ((value.fixed ?? Boolean(value.saveId & 0x8000)) ? 0x8000 : 0))
  }
  private findExistingRecord(adapter: SaveDocumentAdapter, saveType: number, saveId: number, level: number, exact?: Buffer): Buffer | null {
    for (let slot = 0; slot < adapter.meta.hunterEquipmentCapacity; slot += 1) {
      const value = adapter.equipment(slot)
      if (value.saveType !== saveType || value.saveId !== saveId || value.level !== level) continue
      const record = hexToBuffer(value.recordHex, adapter.meta.recordSize)
      if (!exact || record.equals(exact)) return record
    }
    return null
  }
  private isGu(adapter: SaveDocumentAdapter) { return adapter.meta.formatId === 'mhgu-switch-yuzu' || adapter.meta.formatId === 'mhxx-3ds-citra' }
  private exportLegacyCsv(adapter: SaveDocumentAdapter, domain: SaveBoxDomain): string[] {
    const gu = adapter.meta.formatId === 'mhgu-switch-yuzu' || adapter.meta.formatId === 'mhxx-3ds-citra'
    if (domain === 'items') {
      const preamble = gu ? 'MHXX_GU_TRANSFER,1,ITEM_BOX' : adapter.meta.formatId === 'mh4g-3ds-citra' ? 'MH4G_SAVE_EDITOR_FORM,1,item_box' : 'MH3U_TRANSFER,1,ITEM_CHEST'
      const header = gu ? 'slot,id,count' : 'page,slot,item_id,count'; const lines = [preamble, header]
      for (const value of adapter.items(0, adapter.meta.itemCapacity)) lines.push(gu ? `${value.slot + 1},${value.itemId},${value.count}` : `${Math.floor(value.slot / 100) + 1},${value.slot % 100 + 1},${value.itemId},${value.count}`)
      return lines
    }
    const palico = domain === 'palico-equipment'; const capacity = palico ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    if (gu) {
      const lines = ['MHXX_GU_TRANSFER,1,EQUIPMENT_BOX', 'domain,slot,type,id,appearance_id,level,decoration_1,decoration_2,decoration_3,skill_1,skill_1_points,skill_2,skill_2_points,talisman_slots']
      for (let slot = 0; slot < capacity; slot += 1) { const value = adapter.equipment(slot, palico); lines.push(`${palico ? 'palico' : 'hunter'},${slot + 1},${value.saveType},${value.saveId},${value.appearanceId ?? 0},${palico ? 0 : value.level},${value.decorations[0] ?? 0},${value.decorations[1] ?? 0},${value.decorations[2] ?? 0},${value.skill1Id ?? 0},${value.skill1Points ?? 0},${value.skill2Id ?? 0},${value.skill2Points ?? 0},${value.slots ?? 0}`) }
      return lines
    }
    const preamble = adapter.meta.formatId === 'mh4g-3ds-citra' ? 'MH4G_SAVE_EDITOR_FORM,1,equipment_box' : 'MH3U_TRANSFER,1,EQUIPMENT_BOX'
    const header = ['page', 'slot', 'equipment_type', ...Array.from({ length: adapter.meta.recordSize }, (_, index) => `byte_${index}`)].join(','); const lines = [preamble, header]
    for (let slot = 0; slot < capacity; slot += 1) { const value = adapter.equipment(slot); const bytes = hexToBuffer(value.recordHex, adapter.meta.recordSize); lines.push(`${Math.floor(slot / 100) + 1},${slot % 100 + 1},${value.saveType},${[...bytes].join(',')}`) }
    return lines
  }
  private importLegacyCsv(adapter: SaveDocumentAdapter, domain: SaveBoxDomain, source: string, diagnostics: SaveDiagnostic[]): ImportedRecord[] {
    const lines = source.replace(/^\ufeff/, '').split(/\r?\n/).map(value => value.trim()).filter(Boolean); if (lines.length < 2) throw new Error('导入文件缺少版本标识或字段标题')
    const gu = adapter.meta.formatId === 'mhgu-switch-yuzu' || adapter.meta.formatId === 'mhxx-3ds-citra'
    const expectedPreamble = gu
      ? `MHXX_GU_TRANSFER,1,${domain === 'items' ? 'ITEM_BOX' : 'EQUIPMENT_BOX'}`
      : adapter.meta.formatId === 'mh4g-3ds-citra'
        ? `MH4G_SAVE_EDITOR_FORM,1,${domain === 'items' ? 'item_box' : 'equipment_box'}`
        : `MH3U_TRANSFER,1,${domain === 'items' ? 'ITEM_CHEST' : 'EQUIPMENT_BOX'}`
    if (lines.shift() !== expectedPreamble) throw new Error('CSV 版本、游戏格式或目标箱域不匹配')
    const header = lines.shift()?.toLowerCase().split(',').map(value => value.trim()) ?? []; const records: ImportedRecord[] = []
    const integer = (value: string, minimum: number, maximum: number) => /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : null
    const invalid = (row: number, message: string) => diagnostics.push({ code: 'import.row.invalid', path: `rows.${row}`, severity: 'warning', message: `第 ${row} 行${message}，将忽略` })
    lines.forEach((line, index) => {
      const row = index + 3; const values = line.split(',').map(value => value.trim())
      try {
        if (domain === 'items') {
          const oldPaged = header.join(',') === 'page,slot,item_id,count'; const gu = header.join(',') === 'slot,id,count'; const simple = header.join(',') === 'slot,item_id,count'
          if (!oldPaged && !gu && !simple) throw new Error('列格式不匹配')
          if (values.length !== (oldPaged ? 4 : 3)) throw new Error('列数不正确')
          const page = oldPaged ? integer(values[0], 1, Math.ceil(adapter.meta.itemCapacity / 100)) : null
          const localSlot = oldPaged ? integer(values[1], 1, 100) : integer(values[0], gu ? 1 : 0, gu ? adapter.meta.itemCapacity : adapter.meta.itemCapacity - 1)
          const slot = oldPaged ? (page! - 1) * 100 + localSlot! - 1 : localSlot! - (gu ? 1 : 0)
          const itemId = integer(values[oldPaged ? 2 : 1], 0, gu ? 0x0fff : 0xffff); const count = integer(values[oldPaged ? 3 : 2], 0, gu ? 0x7f : 0xffff)
          if (page === null && oldPaged || localSlot === null || itemId === null || count === null || slot < 0 || slot >= adapter.meta.itemCapacity) throw new Error('格号或数值无效')
          records.push({ slot, itemId, count }); return
        }
        const palico = domain === 'palico-equipment'
        if (header[0] === 'page' && header[2] === 'equipment_type' && header[3] === 'byte_0') {
          const page = integer(values[0], 1, Math.ceil(adapter.meta.hunterEquipmentCapacity / 100)); const localSlot = integer(values[1], 1, 100); const type = integer(values[2], 0, 255); const bytes = values.slice(3).map(value => integer(value, 0, 255)); const slot = page == null || localSlot == null ? -1 : (page - 1) * 100 + localSlot - 1
          if (values.length !== 3 + adapter.meta.recordSize || slot < 0 || slot >= adapter.meta.hunterEquipmentCapacity || type === null || bytes.some(value => value === null) || bytes[0] !== type) throw new Error('装备原始列无效')
          records.push({ slot, recordHex: bufferToHex(Buffer.from(bytes as number[])) }); return
        }
        if (header.join(',') === 'slot,record_hex') { const slot = Number(values[0]); const recordHex = values[1]; if (!Number.isInteger(slot) || slot < 0 || !recordHex || recordHex.length !== adapter.meta.recordSize * 2) throw new Error('装备记录无效'); records.push({ slot, recordHex }); return }
        if (header[0] === 'domain' && header[1] === 'slot') {
          if ((values[0] === 'palico') !== palico) return
          if (values.length !== 14 || (values[0] !== 'hunter' && values[0] !== 'palico')) throw new Error('GU/XX 装备列无效')
          const limits: [number, number][] = [[1, palico ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity], [0, 255], [0, 0xffff], [0, 0xffff], [0, 31], [0, 0xffff], [0, 0xffff], [0, 0xffff], [0, 0xff], [-128, 127], [0, 0xff], [-128, 127], [0, 0xff]]
          const parsed = values.slice(1).map((value, at) => integer(value, limits[at][0], limits[at][1])); if (parsed.some(value => value === null)) throw new Error('GU/XX 装备数值无效')
          const [oneBasedSlot, type, id, appearance, level, decoration1, decoration2, decoration3, skill1, skill1Points, skill2, skill2Points, slots] = parsed as number[]; const slot = oneBasedSlot - 1
          if (palico ? ![0, 22, 23, 24].includes(type) : !(type <= 11 || (type >= 13 && type <= 21))) throw new Error('GU/XX 装备类型无效')
          const record = Buffer.alloc(adapter.meta.recordSize)
          if (palico) { record[0] = type; writeU16(record, 2, id); writeU16(record, 4, appearance) }
          else { writeU16(record, 0, (type & 0x1f) | ((level & 0x1f) << 5)); writeU16(record, 2, id); writeU16(record, 4, appearance); [decoration1, decoration2, decoration3].forEach((value, at) => writeU16(record, 6 + at * 2, value)); record[12] = skill1; record[13] = skill2; record.writeInt8(skill1Points, 14); record.writeInt8(skill2Points, 15); record[16] = slots }
          records.push({ slot, recordHex: bufferToHex(record) }); return
        }
        throw new Error('列格式不匹配')
      } catch (error) { invalid(row, error instanceof Error ? `：${error.message}` : '无效') }
    })
    if (!records.length) throw new Error('导入文件没有当前箱域可用的记录')
    return records
  }
  private importedRecordEncodable(adapter: SaveDocumentAdapter, domain: SaveBoxDomain, record: ImportedRecord): boolean {
    if (domain === 'items') {
      const itemId = record.itemId
      const count = record.count
      const maximumId = this.isGu(adapter) ? 0x0fff : 0xffff
      return Number.isInteger(itemId) && itemId! >= 0 && itemId! <= maximumId
        && Number.isInteger(count) && count! >= 0 && count! <= adapter.meta.itemCountMax
        && (itemId !== 0 || count === 0)
    }
    if (typeof record.recordHex !== 'string' || !/^[0-9a-f]+$/i.test(record.recordHex) || record.recordHex.length !== adapter.meta.recordSize * 2) return false
    const bytes = Buffer.from(record.recordHex, 'hex')
    const empty = bytes.every(value => value === 0)
    if (empty) return true
    if (domain === 'palico-equipment') return this.isGu(adapter) && [22, 23, 24].includes(bytes[0])
    const type = this.isGu(adapter) ? readU16(bytes, 0) & 0x1f : bytes[0]
    if (this.isGu(adapter)) return type >= 1 && type <= 11 || type >= 13 && type <= 21
    if (adapter.meta.formatId === 'mh4g-3ds-citra') return type >= 1 && type <= 20
    return type >= 1 && type <= 19
  }
  private firstEmpty(adapter: SaveDocumentAdapter, domain: SaveBoxDomain) {
    const capacity = domain === 'items' ? adapter.meta.itemCapacity : domain === 'palico-equipment' ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    if (domain === 'items') return adapter.items(0, capacity).find(value => value.empty)?.slot ?? -1
    for (let slot = 0; slot < capacity; slot += 1) if (adapter.equipment(slot, domain === 'palico-equipment').empty) return slot
    return -1
  }
  private availableTarget(adapter: SaveDocumentAdapter, domain: SaveBoxDomain, requested?: number) {
    if (requested == null) return this.firstEmpty(adapter, domain)
    const capacity = domain === 'items' ? adapter.meta.itemCapacity : domain === 'palico-equipment' ? adapter.meta.palicoEquipmentCapacity : adapter.meta.hunterEquipmentCapacity
    if (requested < 0 || requested >= capacity) throw new Error('目标箱格超出范围')
    const empty = domain === 'items' ? adapter.item(requested).empty : adapter.equipment(requested, domain === 'palico-equipment').empty
    if (!empty) throw new Error('目标箱格已被占用，请重新打开加入面板')
    return requested
  }
  private atomicWrite(path: string, bytes: Buffer) { const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`); let descriptor: number | undefined; try { descriptor = openSync(temp, 'wx'); writeFileSync(descriptor, bytes); fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined; renameSync(temp, path) } catch (error) { if (descriptor != null) closeSync(descriptor); if (existsSync(temp)) unlinkSync(temp); throw error } }
  close(sessionId: string, discard = false, revision?: number) { const session = this.requireIdentity(sessionId, revision); if (!discard && !session.adapter.payload.equals(session.baseline)) throw new Error('存档存在未保存修改'); this.session = null; this.imports.clear(); this.sectionCache.clear(); this.emit() }
  dispose() { this.session = null; this.listeners.clear(); this.imports.clear(); this.sectionCache.clear(); this.resolver.close() }
}
