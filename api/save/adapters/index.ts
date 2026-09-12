import type { SaveFormatId } from '../types'
import type { SaveDocumentAdapter } from './types'
import { Mh3uSaveAdapter } from './mh3u'
import { Mh4gSaveAdapter } from './mh4g'
import { MhguSaveAdapter } from './mhgu'

export function openSaveAdapter(bytes: Buffer, formatId: SaveFormatId, fileName = ''): SaveDocumentAdapter {
  if (formatId === 'mh3g-3ds-citra' || formatId === 'mh3u-wiiu-cemu') return new Mh3uSaveAdapter(bytes, formatId)
  if (formatId === 'mh4g-3ds-citra') return new Mh4gSaveAdapter(bytes)
  return new MhguSaveAdapter(bytes, formatId, fileName)
}

export type { SaveDocumentAdapter } from './types'
export { decryptMh4g, encryptMh4g } from './mh4g'
