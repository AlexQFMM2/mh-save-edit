import type { GameAdapter, SaveInfo, SaveModel } from '../../core/save'
import type { GameId, Loadout } from '../../core/loadout'
import { validateLoadoutShape } from '../../core/validation'
export class Mh3gAdapter implements GameAdapter { readonly game: GameId = 'mh3g'; detectSave(_raw: Uint8Array): SaveInfo | undefined { return undefined }; readSave(raw: Uint8Array): SaveModel { return { info: { game: this.game, platform: '3ds', displayName: 'MH3G / MH3U' }, loadouts: [], raw } }; writeSave(model: SaveModel): Uint8Array { return model.raw }; validateLoadout(loadout: Loadout) { return validateLoadoutShape(loadout) } }
