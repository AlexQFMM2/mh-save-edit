import assert from 'node:assert/strict'

const MiB=1024*1024
// Supported BOOT SHA-256: 3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846.
// Its PT_LOAD spans 0x08804000..0x09d60400 before plugin/thread allocations.
const gameLoadEnd=0x09d60400

export function pluginMemoryMb(ini) {
  let options=false,memoryMb=32,seen=false
  for (const line of ini.split(/\r?\n/)) {
    const section=line.match(/^\s*\[([^\]]+)\]\s*$/)
    if (section) { options=section[1]==='options';continue }
    const field=line.match(/^\s*memory\s*=\s*(\d+)\s*$/)
    if (options && field) { assert(!seen,'Duplicate plugin memory declaration');memoryMb=Number(field[1]);seen=true }
  }
  assert(Number.isInteger(memoryMb) && memoryMb>=32 && memoryMb<=93,'Invalid plugin memory declaration')
  return memoryMb
}

// Include BSS and the game reservation, not just a standalone module budget.
export function elfMemory(bytes,requestedMemoryMb=32) {
  assert(Number.isInteger(requestedMemoryMb) && requestedMemoryMb>=32 && requestedMemoryMb<=93,'Invalid plugin memory declaration')
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
  assert(residentBytes<=8*MiB,'Module exceeds the offline resident-memory budget')
  const loaderBytes=Math.ceil(residentBytes/256)*256
  const availableAfterGameBytes=0x08000000+requestedMemoryMb*MiB-gameLoadEnd
  const startupReserveBytes=MiB // Conservative allowance; not measured thread/heap usage.
  assert(loaderBytes+startupReserveBytes<=availableAfterGameBytes,
    `Plugin needs ${loaderBytes} bytes plus startup reserve; declared ${requestedMemoryMb} MB leaves ${availableAfterGameBytes} after the game`)
  return {residentBytes,loaderBytes,segments,offlineBudgetBytes:8*MiB,requestedMemoryMb,
    gameLoadEnd,availableAfterGameBytes,startupReserveBytes,runtimeMemoryAccepted:false}
}
