import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyReleaseSource } from '../tools/verify_release_source.mjs'

const directories = []
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'release-source-test-'))
  directories.push(root)
  const cwd = path.join(root, 'source'), origin = path.join(root, 'origin.git')
  mkdirSync(cwd)
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '--bare', origin)
  git('init', '-b', 'release')
  git('config', 'user.name', 'Synthetic Test')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'tag.gpgsign', 'false')
  git('remote', 'add', 'origin', origin)
  mkdirSync(path.join(cwd, 'docs/releases'), { recursive: true })
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  writeFileSync(path.join(cwd, 'docs/releases/v1.2.3.md'), 'Synthetic release')
  git('add', '.')
  git('commit', '-m', 'Synthetic baseline')
  git('tag', '-a', 'v1.2.3', '-m', 'Synthetic version')
  git('push', 'origin', 'release', 'refs/tags/v1.2.3')
  const sha = git('rev-parse', 'HEAD')
  const env = { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/release', GITHUB_SHA: sha, RELEASE_TAG: 'v1.2.3' }
  return { cwd, git, env, verify: () => verifyReleaseSource({ cwd, env }) }
}

describe('release source provenance', () => {
  it('accepts a clean detached checkout at the freshly fetched release and annotated tag', () => {
    const f = fixture()
    f.git('checkout', '--detach', f.env.GITHUB_SHA)
    expect(f.verify()).toEqual({ branch: 'release', sha: f.env.GITHUB_SHA, tag: 'v1.2.3' })
  })

  it.each([
    ['GITHUB_EVENT_NAME', 'push'],
    ['GITHUB_REF', 'refs/heads/feat/example'],
    ['GITHUB_REF', 'refs/tags/v1.2.3'],
    ['RELEASE_TAG', '--upload-pack=command'],
  ])('rejects unauthorized entry %s=%s before consulting Git', (key, value) => {
    expect(() => verifyReleaseSource({ cwd: '/nonexistent', env: {
      GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/release',
      GITHUB_SHA: 'a'.repeat(40), RELEASE_TAG: 'v1.2.3', [key]: value,
    } })).toThrow()
  })

  it.each(['tracked', 'untracked'])('rejects %s source changes', kind => {
    const f = fixture()
    writeFileSync(path.join(f.cwd, kind === 'tracked' ? 'package.json' : 'extra-source.js'), 'dirty')
    expect(f.verify).toThrow('not clean')
  })

  it('rejects a task commit even when its tag and selected SHA match', () => {
    const f = fixture()
    f.git('switch', '-c', 'feat/unreviewed')
    f.git('commit', '--allow-empty', '-m', 'Unreviewed task')
    f.git('tag', 'v1.2.4')
    f.git('push', 'origin', 'feat/unreviewed', 'refs/tags/v1.2.4')
    f.env.GITHUB_SHA = f.git('rev-parse', 'HEAD')
    f.env.RELEASE_TAG = 'v1.2.4'
    expect(f.verify).toThrow('must match')
  })

  it('refetches release and rejects a candidate after the remote advances', () => {
    const f = fixture()
    f.git('commit', '--allow-empty', '-m', 'Later release')
    f.git('push', 'origin', 'release')
    f.git('checkout', '--detach', f.env.GITHUB_SHA)
    // Deliberately stale local ref must not let the old candidate pass.
    f.git('update-ref', 'refs/remotes/origin/release', f.env.GITHUB_SHA)
    expect(f.verify).toThrow('must match')
  })

  it('fails closed when the remote cannot be fetched', () => {
    const f = fixture()
    f.git('remote', 'set-url', 'origin', path.join(f.cwd, 'missing-origin'))
    expect(f.verify).toThrow()
  })

  it('rejects a matching remote tag with the wrong application version', () => {
    const f = fixture()
    f.git('tag', 'v9.9.9')
    f.git('push', 'origin', 'refs/tags/v9.9.9')
    f.env.RELEASE_TAG = 'v9.9.9'
    expect(f.verify).toThrow('version differ')
  })
})
