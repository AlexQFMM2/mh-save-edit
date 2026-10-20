import {it,expect} from 'vitest'
import fs from 'node:fs'
import {elfMemory,pluginMemoryMb} from '../tools/mhp2g/chinese-patch/build-memory.mjs'

// Only ELF headers and a synthetic BSS reservation; no executable/game bytes.
function elf(residentBytes) {
  const b=Buffer.alloc(84)
  Buffer.from([127,69,76,70,1,1]).copy(b)
  b.writeUInt32LE(52,28);b.writeUInt16LE(32,42);b.writeUInt16LE(1,44)
  b.writeUInt32LE(1,52);b.writeUInt32LE(84,56);b.writeUInt32LE(residentBytes,72)
  return b
}

it('rejects the reported test.2 allocation at default RAM and allows the declared expansion',()=>{
  const b=elf(5622424)
  expect(()=>elfMemory(b)).toThrow(/declared 32 MB leaves 2751488/)
  expect(elfMemory(b,40)).toMatchObject({residentBytes:5622424,loaderBytes:5622528,
    requestedMemoryMb:40,availableAfterGameBytes:11140096,runtimeMemoryAccepted:false})
  // A smaller synthetic module still fits this conservative startup allowance.
  expect(elfMemory(elf(1400000),32).requestedMemoryMb).toBe(32)
})

it('uses the shipped options declaration rather than a standalone memory budget',()=>{
  const ini=fs.readFileSync('tools/mhp2g/chinese-patch/prx/plugin.ini','utf8')
  const declared=pluginMemoryMb(ini)
  expect(declared).toBe(40)
  expect(()=>elfMemory(elf(5622424),declared)).not.toThrow()
  expect(pluginMemoryMb('[options]\nversion = 1\n[games]\nmemory = 40')).toBe(32)
  expect(()=>elfMemory(elf(5622424),pluginMemoryMb(ini.replace(/^memory.*\n/m,'')))).toThrow()
  expect(()=>pluginMemoryMb('[options]\nmemory = 94')).toThrow()
  expect(()=>pluginMemoryMb('[options]\nmemory = 40\nmemory = 40')).toThrow()
})

it('retains the module cap and reserves startup space after the game',()=>{
  expect(()=>elfMemory(elf(8*1024*1024+1),40)).toThrow(/offline resident/)
  expect(()=>elfMemory(elf(2751488),32)).toThrow(/startup reserve/)
  expect(()=>elfMemory(Buffer.alloc(52),40)).toThrow(/ELF32/)
})
