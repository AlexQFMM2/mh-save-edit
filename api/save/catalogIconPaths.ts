import type { GameId } from '../core/loadout'

type ArmorPart = 'head' | 'chest' | 'arms' | 'waist' | 'legs'
type IconSet = { weapon: string; armor: Record<ArmorPart, string>; charms: string[] }
const icon = (hash: string) => `catalog/icons/${hash}.png`
const sets: Record<GameId, IconSet> = {
  mh3g: {
    weapon: icon('4d81df01ea2167f3b20b92430a0306470deef72f7e8b298c91bc397e1217f670'),
    armor: { head: icon('67963760e419237f230b665e6f592fbb2fb8b67c59be318842cc4cf29c7292f1'), chest: icon('8479df87c3c214723403c0bd491b2ae0b63134a0fe7ca559b936da2d4909c34d'), arms: icon('6aa116d33d7f3cb2df4dc491ffe07e909206ae8361d67c0db8424392a818620b'), waist: icon('35136cb0e8cb542c19fac73cd488d47c212f8fd3421755d63f62620a26a78ed5'), legs: icon('5dd4d62843ca869576e36fd054a2baa8e2c27c697d32fc9e8d2edc18f98cb5cb') },
    charms: ['f3c370dec94358087733258e097d5b0bfb7a72c646b62b1aac838475370056b7', 'fbfe36640ba6cc7b43ae3f478619d107d6b0ea76727ab19629da523024eb0888', 'fb9cf72a65d9a41da09318af20539eb5c57c0001e98613da09b0d441dcb13a88', 'a9c51678b0e10bb97daafa4b3db63a5b5d461dc8f59d7c57676bd9ab686b9a2d', '1a883b0eae580df9626325e83ec3a97dad3e1e841f0010614d1a902019ad6847', '0b65a3de93786d1ed9c0a513d2e4df73263cedb3a0d0f557aa5a76fe1ef94649', '048e6ae219acb35e57c7469d643b08e4ea2b11c6717a2dd26dbfd02b33706876', '0ffd802d4e8ff4780660538f6aa4b906602953692a8dd8f851b2b6feddddb8be', '8f8ed5a051d7191fa45533767ee21f8beaa097543327f982dd09daf912ee1eff', '04ab60f0ce30ae397f479f548244bf43e5ab828cb50542a779056c30e9ce734b'].map(icon),
  },
  mh4g: {
    weapon: icon('4d81df01ea2167f3b20b92430a0306470deef72f7e8b298c91bc397e1217f670'),
    armor: { head: icon('67963760e419237f230b665e6f592fbb2fb8b67c59be318842cc4cf29c7292f1'), chest: icon('8479df87c3c214723403c0bd491b2ae0b63134a0fe7ca559b936da2d4909c34d'), arms: icon('6aa116d33d7f3cb2df4dc491ffe07e909206ae8361d67c0db8424392a818620b'), waist: icon('35136cb0e8cb542c19fac73cd488d47c212f8fd3421755d63f62620a26a78ed5'), legs: icon('5dd4d62843ca869576e36fd054a2baa8e2c27c697d32fc9e8d2edc18f98cb5cb') },
    charms: ['f3c370dec94358087733258e097d5b0bfb7a72c646b62b1aac838475370056b7', 'fbfe36640ba6cc7b43ae3f478619d107d6b0ea76727ab19629da523024eb0888', 'fb9cf72a65d9a41da09318af20539eb5c57c0001e98613da09b0d441dcb13a88', 'a9c51678b0e10bb97daafa4b3db63a5b5d461dc8f59d7c57676bd9ab686b9a2d', '1a883b0eae580df9626325e83ec3a97dad3e1e841f0010614d1a902019ad6847', '0b65a3de93786d1ed9c0a513d2e4df73263cedb3a0d0f557aa5a76fe1ef94649', '048e6ae219acb35e57c7469d643b08e4ea2b11c6717a2dd26dbfd02b33706876', '0ffd802d4e8ff4780660538f6aa4b906602953692a8dd8f851b2b6feddddb8be', '8f8ed5a051d7191fa45533767ee21f8beaa097543327f982dd09daf912ee1eff', '04ab60f0ce30ae397f479f548244bf43e5ab828cb50542a779056c30e9ce734b'].map(icon),
  },
  mhgu: {
    weapon: icon('cf51a69df7ebc07afffefbb1be7c9cf3a0079c76acdae0b0c91039d1f0206286'),
    armor: { head: icon('8d6ae23a31adc7a71dac8b321d7099495f5667f91e3de900896d41e80da34632'), chest: icon('d12e97bfb6663c114ff3c708b116f4031f153a92ad6a1d2d5267b2400ca3d0d3'), arms: icon('d1514cfb3d6e202e56f55b9c1c2264f76bf005774fc86b1d8d5c6ef35484b612'), waist: icon('3eade3d433163ed75e233e8c95e12e68c59c7d4fe35c7b1949bcb4fb52f201db'), legs: icon('fce7309765f3d7c11d560be96122156258e308c00ae0434bcc19378316d9eff6') },
    charms: ['b368ad885533e83ce5eba0435f77c4e1be6b1f9bcb7e2a7d1b2a68329d49e931', '854c1cebf11ae2f821093fc3581b3b8d69736a2157fa9b86d0519de8031a19b0', '8e0943c500c2e3a1fe18bf936983b851aa14ea69614e081fcfac7e08973cb49f', '1a0faf176f845b62e259fd91aa405d075c7ffc31c2132b4be16215c76cd4a2d4', '8867cc77e13d8c239e86c110656c6a2a50523c6f7331e224b4238453bb9ea4c1', 'f9d79cb91cd52d87cac2bcf31ce113015ba2d140df17ca2450375e26869a3646', '3f6359be1056458664a185783c49dbb492565616888798f2822518c75898bbc7', 'd8a828b54b908f5c79d673f7dca6ab65a08ac303ef6b6dfa8abe2040d9f3a0a1', '8f2e5b9165404039a6be6f2063a5fe767af53be98cb360741b8c4e73538276a8', '09f44f3206e81bf62dbeb0455adc1ab8df055348701fd4725a899c1a0b15105f'].map(icon),
  },
}

export function charmIconPath(gameId: GameId, classId: number): string | null {
  const values = sets[gameId]?.charms
  return values?.[Math.min(Math.max(classId, 1), values.length) - 1] ?? null
}

export function defaultLoadoutIconPath(gameId: GameId, slot: 'weapon' | ArmorPart | 'charm'): string | null {
  const value = sets[gameId]
  if (!value) return null
  return slot === 'weapon' ? value.weapon : slot === 'charm' ? value.charms[0] ?? null : value.armor[slot]
}
