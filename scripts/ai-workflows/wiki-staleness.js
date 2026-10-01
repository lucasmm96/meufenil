#!/usr/bin/env node
// S-003 — wiki-staleness: detecta páginas wiki com fontes alteradas (migração ESM de wiki-precheck.js)
// Output: JSON em stdout, erros em stderr, exit 0 (ok) / 1 (falha)
// Invocação: node scripts/ai-workflows/wiki-staleness.js

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')

const WIKI_STATE_PATH = join(REPO_ROOT, 'wiki', '.wiki-state.json')

const PAGE_SOURCES = {
  'Home.md': [
    '.ai/specs/current/system-map.md',
    '.ai/specs/current/domain/business-rules.md',
    '.ai/specs/current/domain/traceability.md',
  ],
  'Guia-Usuario.md': [
    '.ai/specs/current/features',
    '.ai/specs/current/product',
    '.ai/specs/current/domain',
  ],
  'Guia-Desenvolvedor.md': [
    '.ai/specs/current/features',
    '.ai/specs/current/architecture',
    '.ai/specs/current/frontend',
    '.ai/specs/current/backend',
    '.ai/specs/current/database',
    '.ai/specs/current/testing',
  ],
  'Arquitetura.md': [
    '.ai/specs/current/architecture',
    '.ai/specs/current/security',
  ],
  'Funcionalidades.md': [
    '.ai/specs/current/features',
    '.ai/specs/proposed/features',
  ],
  'Referencias-Tecnicas.md': [
    '.ai/specs/current/database',
    '.ai/specs/current/backend',
  ],
  '_Sidebar.md': ['wiki'],
}

const SOURCE_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.sql', '.json'])

function collectFiles(sourcePath) {
  const absPath = resolve(REPO_ROOT, sourcePath)
  try {
    const stat = statSync(absPath)
    if (stat.isFile()) return [absPath]
    if (stat.isDirectory()) {
      return readdirSync(absPath)
        .filter((f) => SOURCE_EXTENSIONS.has(extname(f)))
        .map((f) => join(absPath, f))
        .filter((f) => {
          try { return statSync(f).isFile() } catch { return false }
        })
    }
  } catch {
    // source path doesn't exist — skip
  }
  return []
}

function hashFile(filePath) {
  try {
    const content = readFileSync(filePath)
    return createHash('sha256').update(content).digest('hex')
  } catch {
    return 'MISSING'
  }
}

function computePageHash(sources) {
  const allFiles = sources.flatMap(collectFiles).sort()
  const combined = allFiles.map((f) => `${f}:${hashFile(f)}`).join('\n')
  return createHash('sha256').update(combined).digest('hex')
}

function run() {
  let prevState = {}
  try {
    prevState = JSON.parse(readFileSync(WIKI_STATE_PATH, 'utf8'))
  } catch {
    // no previous state — all pages flagged as stale
  }

  const stale = []
  const fresh = []
  const newPages = []

  for (const [page, sources] of Object.entries(PAGE_SOURCES)) {
    const currentHash = computePageHash(sources)
    const storedHash = prevState[page]?.hash ?? null
    const changedSources = storedHash === null
      ? sources
      : sources.filter((s) => {
          const files = collectFiles(s)
          return files.some((f) => hashFile(f) !== (prevState[page]?.fileHashes?.[f] ?? null))
        })

    if (storedHash === null) {
      newPages.push(page)
    } else if (currentHash !== storedHash) {
      stale.push({ page, currentHash, storedHash, changedSources })
    } else {
      fresh.push(page)
    }
  }

  return {
    staleExists: stale.length > 0 || newPages.length > 0,
    stale,
    fresh,
    new: newPages,
    generatedAt: new Date().toISOString(),
  }
}

try {
  const result = run()
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
} catch (err) {
  process.stderr.write(`wiki-staleness: ${err.message}\n`)
  process.exit(1)
}
