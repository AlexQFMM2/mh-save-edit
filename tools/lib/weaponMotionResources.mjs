import crypto from 'node:crypto'
import fs from 'node:fs'

const entityMap = new Map([
  ['&amp;', '&'], ['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&apos;', "'"],
])

function decodeXml(value) {
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => entityMap.get(entity) ?? entity)
    .replace(/<[^>]+>/g, '')
    .trim()
}

export function parseAndroidResourceArrays(file) {
  const xml = fs.readFileSync(file, 'utf8')
  const arrays = new Map()
  const arrayPattern = /<(string-array|integer-array)\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g
  for (const match of xml.matchAll(arrayPattern)) {
    const values = [...match[3].matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)].map((item) => decodeXml(item[1]))
    arrays.set(match[2], match[1] === 'integer-array' ? values.map((value) => Number.parseInt(value, 10)) : values)
  }
  return arrays
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function normalizeMotionName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/^\s*[-–—]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en')
}

export function displayNameFromKey(value) {
  return value
    .replace(/^(?:GS|LS|SNS|DB|Hammer|HH|Lance|GL|SA|CB|IG|LBG|HBG|Bow)_HA_/, '')
    .replace(/_(?:MV|Names|ElmCheck).*$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function parseIndexedGmd(file) {
  const data=fs.readFileSync(file)
  if(data.length<64||data.subarray(0,3).toString('ascii')!=='GMD')throw new Error(`Invalid GMD: ${file}`)
  const count=data.readUInt32LE(20);const keyBytes=data.readUInt32LE(28);const valueBytes=data.readUInt32LE(32)
  const valueStart=data.length-valueBytes;const keyStart=valueStart-keyBytes
  const keys=data.subarray(keyStart,valueStart).toString('utf8').split('\0')
  const values=data.subarray(valueStart).toString('utf8').split('\0')
  if(keys.length<count||values.length<count)throw new Error(`Truncated indexed GMD: ${file}`)
  return new Map(keys.slice(0,count).map((key,index)=>[key,values[index]??'']))
}
