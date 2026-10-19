import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { hash } from './text-package.mjs'

const bootHash = '3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846'
const read = file => JSON.parse(fs.readFileSync(file))
export function pilotEvidence(directory, texts) {
  const native = read(path.join(directory, 'native-inspect.json'))
  const talk = read(path.join(directory, 'talk-code.json'))
  assert.equal(native.bootSha256, bootHash); assert.equal(texts.bootSha256, bootHash)
  const ranges = [...native.fontRanges, ...talk]
  for (const range of ranges) {
    const raw = Buffer.alloc(range.words.length * 4)
    range.words.forEach((word, i) => raw.writeUInt32LE(word, i*4))
    assert.equal(hash(raw), range.sha256, 'Instruction evidence hash mismatch')
  }
  const words = (address, length = 2) => {
    const range = ranges.find(r => r.start <= address && address + length*4 <= r.start + r.words.length*4)
    assert(range, 'Missing native instruction range')
    return range.words.slice((address-range.start)/4, (address-range.start)/4+length)
  }
  const sites = { QUERY: 0x088513cc, TALK: 0x08830ba0, INFO: 0x088929bc,
    CHAR: 0x08893054, IMAGE: 0x088931b0, IMAGE2: 0x088931f8 }
  const expected = { QUERY: [0x27bdffe0,0xafbf000c], TALK: [0x27bdffc0,0xafbf002c],
    INFO: [0x0c000000 | (0x0890bd68>>>2)], CHAR: [0x0c000000 | (0x0890bda0>>>2)],
    IMAGE: [0x0c000000 | (0x0890bd90>>>2)], IMAGE2: [0x0c000000 | (0x0890bd90>>>2)] }
  for (const [key, address] of Object.entries(sites)) assert.deepEqual(words(address).slice(0,expected[key].length), expected[key], `Unexpected ${key} opcode`)
  const dialogue = native.members.find(x => x.member === 5370)
  assert.equal(dialogue.sha256, texts.dialogue.resourceSha256)
  assert.equal(dialogue.bytes, 186368)
  return { sites: Object.fromEntries(Object.entries(sites).map(([key,address]) => [key,{address,words:words(address)}])),
    find: {address:0x0889b71c, words:words(0x0889b71c,20)}, dialogueHeader:dialogue.headerWords.slice(0,34),
    inputs:Object.fromEntries(['native-inspect.json','talk-code.json'].map(name => [name,hash(fs.readFileSync(path.join(directory,name)))])) }
}

export function pilotHeader(evidence, font, { textBytes, textCrc, pgfBytes, pgfCrc, mode, buildId }) {
  const hex = n => `0x${n.toString(16)}u`, list = v => `{${v.map(hex).join(',')}}`
  return '#ifndef P2G_PILOT_PROFILE_H\n#define P2G_PILOT_PROFILE_H\n' +
    `#define PILOT_MODE ${mode}\n#define PROBE_MODE ${mode}\n#define PROBE_TABLE 0\n#define PROBE_INDEX 0\n#define PROBE_BUILD_ID "${buildId}"\n` +
    `#define PILOT_TEXT_BYTES ${textBytes}\n#define PILOT_TEXT_CRC ${hex(textCrc)}\n#define PILOT_PGF_BYTES ${pgfBytes}\n#define PILOT_PGF_CRC ${hex(pgfCrc)}\n` +
    Object.entries(evidence.sites).map(([key,site]) => `#define PILOT_${key}_ADDRESS ${hex(site.address)}\n#define PILOT_${key}_WORDS ${list(site.words)}\n`).join('') +
    `#define PILOT_FIND_RESOURCE ${hex(evidence.find.address)}\n#define PILOT_FIND_WORDS ${list(evidence.find.words)}\n` +
    '#define PILOT_CORE_BASE 0x089c7510u\n#define PILOT_RESOURCE_MANAGER 0x09a07280u\n#define PILOT_RESOURCE_MANAGER_BYTES 0x83d830u\n#define PILOT_DIALOGUE_BYTES 186368u\n' +
    `#define PILOT_DIALOGUE_HEADER ${list(evidence.dialogueHeader)}\n` +
    '#define PILOT_GLYPHS {' + font.codepoints.map(code => {
      const g=font.metrics[code]
      return `{${code},${g.width},${g.height},${g.left},${g.top},${g.advance},${hex(g.bitmapCrc32)}}`
    }).join(',') + '}\n#endif\n'
}
