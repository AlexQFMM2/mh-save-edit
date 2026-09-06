const EXTERNAL_URL_PATTERN = /^(https?:|data:|blob:|file:|mh-save-asset:)/i

/**
 * Resolve a canonical asset path from the renderer's own assets directory.
 * Keep data records platform-neutral; this is the only place that knows how
 * a packaged Electron renderer serves local resources.
 */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined

  const rawPath = path.trim()
  if (!rawPath) return undefined
  if (EXTERNAL_URL_PATTERN.test(rawPath) || rawPath.startsWith('//')) return rawPath

  const cleanPath = rawPath
    .replace(/^\.?\/+/, '')
    .replace(/^assets\//, '')
    .replace(/\/+$/, '')

  if (!cleanPath) return undefined

  const documentBase = typeof document === 'undefined' ? 'file:///renderer/index.html' : document.baseURI
  return new URL(`assets/${cleanPath}`, documentBase).href
}

export function cssAssetUrl(path?: string | null): string | undefined {
  const resolvedUrl = assetUrl(path)
  return resolvedUrl ? `url("${resolvedUrl}")` : undefined
}
