import type { GameAdapter, SaveInfo, SaveModel } from '../../core/save'
import type { GameId, Loadout } from '../../core/loadout'
import { validateLoadoutShape } from '../../core/validation'
export class MhguAdapter implements GameAdapter { readonly game: GameId = 'mhgu'; detectSave(_raw: Uint8Array): SaveInfo | undefined { return undefined }; readSave(raw: Uint8Array): SaveModel { return { info: { game: this.game, platform: 'switch', displayName: 'MHGU / MHXX' }, loadouts: [], raw } }; writeSave(model: SaveModel): Uint8Array { return model.raw }; validateLoadout(loadout: Loadout) { return validateLoadoutShape(loadout) } }
