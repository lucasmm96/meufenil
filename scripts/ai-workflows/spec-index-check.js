#!/usr/bin/env node
// S-001 — spec-index-check: próximo ID disponível por categoria + consistência proposed/index.md
// Output: JSON em stdout, erros em stderr, exit 0 (ok) / 1 (falha)
// Invocação: node scripts/ai-workflows/spec-index-check.js

import { readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listSpecs } from '../spec-github/lib/specs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

const CATEGORY_PREFIX = {
  features: 'FEAT',
  enhancements: 'ENH',
  refactors: 'REF',
  'technical-debt': 'DEBT',
  security: 'SEC',
  testing: 'TEST',
}

function parseIndexLine(line) {
  const m = line.match(/\[([A-Z]+-\d{4})[^\]]*\]\(([^)]+)\)/)
  if (!m) return null
  return { id: m[1], relativePath: m[2] }
}

function nextIdForPrefix(specs, prefix) {
  const ids = specs
    .filter((s) => s.id.startsWith(prefix + '-'))
    .map((s) => parseInt(s.id.split('-')[1], 10))
    .filter((n) => !isNaN(n))
  const max = ids.length > 0 ? Math.max(...ids) : 0
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

function run(specsDir) {
  if (!existsSync(specsDir)) {
    process.stderr.write(`Diretório de specs não encontrado: ${specsDir}\n`)
    process.exit(1)
  }

  const allSpecs = listSpecs(specsDir)

  const nextIds = {}
  for (const [, prefix] of Object.entries(CATEGORY_PREFIX)) {
    nextIds[prefix] = nextIdForPrefix(allSpecs, prefix)
  }

  const indexPath = join(specsDir, 'proposed', 'index.md')
  const missingFromIndex = []
  const missingFiles = []
  const pathMismatches = []

  const activeSpecs = allSpecs.filter((s) => s.area === 'proposed')
  const indexIds = new Set()

  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, 'utf8')
    for (const line of indexContent.split('\n')) {
      const entry = parseIndexLine(line)
      if (!entry) continue
      indexIds.add(entry.id)
      const resolvedPath = join(specsDir, 'proposed', entry.relativePath)
      if (!existsSync(resolvedPath)) {
        missingFiles.push({ id: entry.id, path: entry.relativePath })
      }
    }
    for (const spec of activeSpecs) {
      if (!indexIds.has(spec.id)) {
        missingFromIndex.push({ id: spec.id, path: spec.path })
      }
    }
  }

  const activeCounts = {}
  for (const spec of activeSpecs) {
    const st = spec.status ?? 'UNKNOWN'
    activeCounts[st] = (activeCounts[st] ?? 0) + 1
  }

  const ok = missingFromIndex.length === 0 && missingFiles.length === 0 && pathMismatches.length === 0

  return {
    nextIds,
    consistency: { ok, missingFromIndex, missingFiles, pathMismatches },
    activeCounts,
    generatedAt: new Date().toISOString(),
  }
}

const result = run(SPECS_DIR)
process.stdout.write(JSON.stringify(result, null, 2) + '\n')
