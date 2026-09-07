import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const allowedFontSize = /^var\(--global-typography-font-size-(caption|small|body|title|display)\)$/

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? cssFiles(path) : entry.isFile() && entry.name.endsWith('.css') ? [path] : []
  })
}

describe('global design tokens', () => {
  it('keeps exactly five global typography sizes', () => {
    const styles = readFileSync(join(projectRoot, 'ui/styles.css'), 'utf8')
    const definitions = [...styles.matchAll(/--global-typography-font-size-([a-z]+)\s*:/g)].map((match) => match[1])
    expect(definitions).toEqual(['caption', 'small', 'body', 'title', 'display'])
  })

  it('requires every page and component font size to use the global scale', () => {
    const invalid = cssFiles(join(projectRoot, 'ui'))
      .filter((path) => !path.endsWith('/styles.css'))
      .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/font-size\s*:\s*([^;}]+)/g)]
        .map((match) => ({ path: path.slice(projectRoot.length + 1), value: match[1].trim() })))
      .filter(({ value }) => !allowedFontSize.test(value))
    expect(invalid).toEqual([])
  })

  it('defines and uses the semantic data color', () => {
    const styles = readFileSync(join(projectRoot, 'ui/styles.css'), 'utf8')
    expect(styles).toContain('--global-theme-color-data:')
    const usageCount = cssFiles(join(projectRoot, 'ui/components'))
      .reduce((count, path) => count + (readFileSync(path, 'utf8').match(/var\(--global-theme-color-data\)/g)?.length ?? 0), 0)
    expect(usageCount).toBeGreaterThan(10)
  })
})
