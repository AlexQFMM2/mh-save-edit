import type { GameAdapter, SaveInfo, SaveModel } from '../../core/save'
import type { GameId, Loadout } from '../../core/loadout'
import { validateLoadoutShape } from '../../core/validation'
export class Mh4gAdapter implements GameAdapter { readonly game: GameId = 'mh4g'; detectSave(_raw: Uint8Array): SaveInfo | undefined { return undefined }; readSave(raw: Uint8Array): SaveModel { return { info: { game: this.game, platform: '3ds', displayName: 'MH4G / MH4U' }, loadouts: [], raw } }; writeSave(model: SaveModel): Uint8Array { return model.raw }; validateLoadout(loadout: Loadout) { return validateLoadoutShape(loadout) } }
