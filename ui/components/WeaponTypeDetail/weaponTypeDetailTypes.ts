import type { WeaponDetail, WeaponKind } from '../../../api/catalog/types'
export type ExtractWeaponDetail<K extends WeaponKind> = Extract<WeaponDetail, { kind: K }>
