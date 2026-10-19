import assert from 'node:assert/strict'
import {hash, validateRows} from './text-package.mjs'

export const questFields = ['name','goal','failure','description','monsters','client']

// List aliases share a translation, but retain their physical member, record,
// offset and size. An envelope offset must never be used for a list pointer.
export function questRows({index, draft, resources, quests, lists}) {
  for (const input of [resources, quests, lists]) assert.equal(input.isoSha256,index.sourceVersion,'Different quest source')
  const resourceMap=new Map(resources.records.map(r=>[r.member,r]))
  const questMap=new Map([...quests.members,...lists.members].map(r=>[r.member,r]))
  const rows=[]
  for (const [key,binding] of Object.entries(index.bindings)) {
    if (!key.includes(':record:')) continue
    const unit=index.units[binding.unit], decision=draft.units[binding.unit]
    assert(decision,'Missing quest decision')
    assert.equal(decision.original,unit.text)
    assert.equal(decision.sourceSha256,unit.sha256)
    assert.equal(decision.sourceVersion,index.sourceVersion)
    if (decision.translated===unit.text) continue
    assert(['project-reviewed','agent-reviewed','pilot-reviewed'].includes(decision.status),'Unreviewed quest')
    const match=/^data:(\d+)(:quest-payload)?:record:(\d+):field:([a-z]+)$/.exec(key)
    assert(match,'Unsupported quest binding')
    const member=Number(match[1]), recordOffset=Number(match[3]), field=questFields.indexOf(match[4])
    const evidence=questMap.get(member), resource=resourceMap.get(member)
    assert(evidence && resource && evidence.status==='text-structure-parsed')
    assert.equal(resource.decodedSha256,evidence.decodedSha256)
    assert.equal(evidence.layout,match[2]?'quest-envelope':'quest-list')
    const record=evidence.records.find(r=>r.recordOffset===recordOffset)
    assert(record && record.questId===binding.questId && field>=0)
    const nativeBinding=record.bindings.find(r=>r.key===key), physical=binding.physicalSource??unit.source
    assert(nativeBinding && nativeBinding.field===binding.field && nativeBinding.unit===(binding.physicalUnit??binding.unit))
    assert.equal(nativeBinding.pointerOffset,binding.pointerOffset)
    assert.equal(nativeBinding.pointerSha256,binding.pointerSha256)
    assert.equal(physical.member,member)
    assert.equal(physical.decodedSha256,evidence.decodedSha256)
    const nativeUnit=record.units[nativeBinding.unit]
    assert(nativeUnit && nativeUnit.text===unit.text && nativeUnit.sha256===unit.sha256)
    assert.equal(hash(Buffer.from(nativeUnit.text)),nativeUnit.sha256)
    assert.equal(nativeUnit.offset,binding.physicalSource?.offset??unit.offset)
    if (match[2]) assert.equal(evidence.payloadSha256,unit.source.payloadSha256)
    rows.push({member,table:recordOffset,index:field,flag:record.questId,
      offset:nativeUnit.offset,resourceBytes:match[2]?evidence.payloadBytes:resource.bytes,
      original:unit.text,translated:decision.translated,sourceSha256:unit.sha256,
      basis:decision.basis,status:decision.status,canonicalUnit:binding.unit,physicalBinding:key})
  }
  return validateRows(rows,{batch:true})
}
