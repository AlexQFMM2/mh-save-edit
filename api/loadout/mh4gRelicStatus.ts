type RelicStatusMaximum = Readonly<{ code: number; displayValue: number }>

// Reviewed MH4G status calculation and equipment limit check; these are extended
// indices, not naturally obtainable tiers or a guarantee of task/save acceptance.
// code.bin SHA-256: d94ec346cc265fa971101a29193ab377103ed0b677b1d309a5f847019d765604
// Native status calculation: 0x2EB1E0; positive internal values >= 101 flag overflow.
export function getMh4gRelicStatusMaximum(saveType: number): RelicStatusMaximum | null {
  if ([7, 18].includes(saveType)) return { code: 0x32, displayValue: 970 }
  if ([8, 16, 17, 19].includes(saveType)) return { code: 0x60, displayValue: 1000 }
  if ([9, 10, 13, 14, 15, 20].includes(saveType)) return { code: 0x43, displayValue: 800 }
  return null
}

export function isMh4gRelicLegacyStatusOverflow(saveType: number, code: number): boolean {
  return getMh4gRelicStatusMaximum(saveType)?.code === 0x60 && code === 0x5f
}
