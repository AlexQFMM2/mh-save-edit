import type { SaveFormatId } from '../types'
import type { SaveDocumentAdapter } from './types'
import { Mh3uSaveAdapter } from './mh3u'
import { Mh4gSaveAdapter } from './mh4g'
import { MhguSaveAdapter } from './mhgu'
import { Mhp2gSaveAdapter } from './mhp2g'
import type { P2gProfile } from '../p2g/profile'

export function openSaveAdapter(bytes: Buffer, formatId: SaveFormatId, fileName = '', p2g?: { sfoBytes: Buffer; profile: P2gProfile }): SaveDocumentAdapter {
  if (formatId === 'mh3g-3ds-citra' || formatId === 'mh3u-wiiu-cemu') return new Mh3uSaveAdapter(bytes, formatId)
  if (formatId === 'mh4g-3ds-citra') return new Mh4gSaveAdapter(bytes)
  if (formatId === 'mhp2g-psp-ppsspp') {
    if (!p2g) throw new Error('P2G 需要成对读取 BIN 和 SFO，以及已验证的格式资源')
    return new Mhp2gSaveAdapter(bytes, p2g.sfoBytes, p2g.profile)
  }
  return new MhguSaveAdapter(bytes, formatId, fileName)
}

export type { SaveDocumentAdapter } from './types'
export { decryptMh4g, encryptMh4g } from './mh4g'
