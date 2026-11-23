export const P2G_PSP = {
  gameId: 'mhp2g', formatId: 'mhp2g-psp-ppsspp', label: 'P2G',
  directory: 'ULJM05500', bin: 'MHP2NDG.BIN', payloadSize: 0x16a0e8,
} as const

export const P3_PSP = {
  gameId: 'mhp3', formatId: 'mhp3-psp-ppsspp', label: 'P3',
  directory: 'ULJM05800', bin: 'MHP3RD.BIN', payloadSize: 0x120fe8,
} as const

export type PspSaveFormat = typeof P2G_PSP | typeof P3_PSP

export function pspSaveFormat(formatId: string): PspSaveFormat | undefined {
  return [P2G_PSP, P3_PSP].find(format => format.formatId === formatId)
}
