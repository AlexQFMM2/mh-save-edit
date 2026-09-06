import { describe, expect, it } from 'vitest'
import { assetUrl, cssAssetUrl } from '../ui/lib/assetUrl'

describe('assetUrl', () => {
  it('resolves canonical local paths under the renderer assets directory', () => {
    expect(assetUrl('home/3g-post.png')).toBe('file:///renderer/assets/home/3g-post.png')
    expect(assetUrl('/assets/home/gu-bg.jpg')).toBe('file:///renderer/assets/home/gu-bg.jpg')
  })

  it('keeps external URLs unchanged and creates CSS urls', () => {
    expect(assetUrl('https://example.com/image.png')).toBe('https://example.com/image.png')
    expect(cssAssetUrl('home/4g-bg.webp')).toBe('url("file:///renderer/assets/home/4g-bg.webp")')
  })
})
