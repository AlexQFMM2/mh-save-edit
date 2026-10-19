import assert from 'node:assert/strict'

// Include BSS in the module loader's reservation; debug/file size is unrelated.
export function elfMemory(bytes) {
  assert(bytes.length>=52 && bytes.subarray(0,6).equals(Buffer.from([127,69,76,70,1,1])),'Expected ELF32 LE')
  const at=bytes.readUInt32LE(28),stride=bytes.readUInt16LE(42),count=bytes.readUInt16LE(44)
  assert(stride>=32 && at+stride*count<=bytes.length,'Invalid ELF program headers')
  const segments=[]
  for (let i=0;i<count;i++) {
    const p=at+i*stride
    if (bytes.readUInt32LE(p)!==1) continue
    const address=bytes.readUInt32LE(p+8),fileBytes=bytes.readUInt32LE(p+16),memoryBytes=bytes.readUInt32LE(p+20)
    assert(fileBytes<=memoryBytes && bytes.readUInt32LE(p+4)+fileBytes<=bytes.length)
    segments.push({address,fileBytes,memoryBytes})
  }
  assert(segments.length,'No loadable ELF segments')
  const residentBytes=Math.max(...segments.map(s=>s.address+s.memoryBytes))-Math.min(...segments.map(s=>s.address))
  assert(residentBytes<=8*1024*1024,'Module exceeds the offline resident-memory budget')
  return {residentBytes,segments,offlineBudgetBytes:8*1024*1024,runtimeMemoryAccepted:false}
}
