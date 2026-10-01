#!/usr/bin/env node
// S-002 — release-context: contexto completo para preparar uma release
// Output: JSON em stdout, erros em stderr, exit 0 (ok) / 1 (falha)
// Invocação: node scripts/ai-workflows/release-context.js [--since=v1.16.0]

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listSpecs } from '../spec-github/lib/specs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

const SPEC_ID_RE = /\b([A-Z]+-\d{4})\b/g

function parseArgs(argv) {
  const since = argv.find((a) => a.startsWith('--since='))?.split('=')[1] ?? null
  return { since }
}

function currentVersion() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  return pkg.version
}

function lastTag() {
  try {
    return execSync('git describe --tags --abbrev=0', { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function commitsSince(ref) {
  const format = '%H\x1F%s\x1F%D'
  const cmd = ref
    ? `git log ${ref}..HEAD --format="${format}"`
    : `git log --format="${format}"`
  try {
    const raw = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
    if (!raw) return []
    return raw.split('\n').map((line) => {
      const [sha, message, refs] = line.split('\x1F')
      const specIds = [...new Set((message.match(SPEC_ID_RE) ?? []))]
      const prMatch = refs?.match(/HEAD -> .+, origin\/.+|refs\/pull\/(\d+)/)
      const mergeMatch = message.match(/Merge pull request #(\d+)/)
      const pr = mergeMatch ? Number(mergeMatch[1]) : null
      return { sha: sha?.slice(0, 7), message, specIds, pr }
    })
  } catch {
    return []
  }
}

function bump(type) {
  if (type === 'FEAT') return 'minor'
  return 'patch'
}

function proposedVersion(current, bumpType) {
  const [major, minor, patch] = current.split('.').map(Number)
  if (bumpType === 'minor') return `v${major}.${minor + 1}.0`
  return `v${major}.${minor}.${patch + 1}`
}

function run(argv) {
  const { since } = parseArgs(argv)
  const tag = since ?? lastTag()
  const version = currentVersion()
  const commits = commitsSince(tag)

  const specIdSet = new Set(commits.flatMap((c) => c.specIds))
  const allSpecs = existsSync(SPECS_DIR) ? listSpecs(SPECS_DIR) : []
  const specsById = Object.fromEntries(allSpecs.map((s) => [s.id, s]))

  const specsInRelease = [...specIdSet]
    .sort()
    .map((id) => {
      const s = specsById[id]
      if (!s) return { id, found: false, type: null, title: null, issue: null, status: null }
      return { id: s.id, type: s.type, title: s.title, issue: s.issue, status: s.status }
    })

  const bumpType = specsInRelease.some((s) => s.type === 'FEAT') ? 'FEAT' : 'OTHER'
  const bumped = bump(bumpType)
  const nextVersion = proposedVersion(version, bumped)

  const traceabilityRows = specsInRelease.map((s) => {
    const prFromCommits = commits.find((c) => c.specIds.includes(s.id) && c.pr)?.pr ?? null
    return { spec: s.id, issue: s.issue ?? null, pr: prFromCommits, title: s.title ?? s.id, type: s.type ?? 'UNKNOWN' }
  })

  const missingIssues = specsInRelease.filter((s) => !s.issue).map((s) => s.id)

  return {
    currentVersion: version,
    lastTag: tag,
    commitsSinceLastTag: commits,
    specsInRelease,
    proposedBump: bumped,
    proposedVersion: nextVersion,
    traceabilityRows,
    missingIssues,
    generatedAt: new Date().toISOString(),
  }
}

try {
  const result = run(process.argv.slice(2))
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
} catch (err) {
  process.stderr.write(`release-context: ${err.message}\n`)
  process.exit(1)
}
