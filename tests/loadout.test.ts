import { describe, expect, it } from 'vitest'
import { emptyLoadout } from '../api/core/loadout'
import { validateLoadoutShape } from '../api/core/validation'
describe('logical loadouts', () => { it('has no equipment-box identity', () => { expect(emptyLoadout('mhgu')).toEqual({ game:'mhgu', name:'未命名配装', gender:'any', equipment:{} }) }); it('requires seven slots before writing', () => { expect(validateLoadoutShape(emptyLoadout('mh3g')).issues).toHaveLength(7) }) })
