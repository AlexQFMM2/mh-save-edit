import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Resolve fresh remote refs; a branch name or a tag alone is not provenance. */
export function verifyReleaseSource({ cwd = process.cwd(), env = process.env } = {}) {
  const tag = env.RELEASE_TAG
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/release') {
    throw new Error('Publishing requires a manual workflow run on release')
  }
  if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) throw new Error('Invalid release tag')
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')) throw new Error('Invalid selected commit')
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  if (git('status', '--porcelain', '--untracked-files=all')) throw new Error('Release source checkout is not clean')
  git('fetch', '--no-tags', 'origin', '+refs/heads/release:refs/remotes/origin/release')
  git('fetch', '--no-tags', 'origin', `refs/tags/${tag}:refs/tags/${tag}`)
  const head = git('rev-parse', '--verify', 'HEAD^{commit}')
  const release = git('rev-parse', '--verify', 'refs/remotes/origin/release^{commit}')
  const tagged = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`)
  if ([head, release, tagged].some(sha => sha !== env.GITHUB_SHA)) {
    throw new Error('Selected commit, checkout, remote release and version tag must match; revalidate after release moves')
  }
  const { version } = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'))
  if (tag !== `v${version}`) throw new Error('Tag and application version differ')
  if (!existsSync(path.join(cwd, 'docs', 'releases', `${tag}.md`))) throw new Error('Release notes are missing')
  return { branch: 'release', sha: head, tag }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(verifyReleaseSource()))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
