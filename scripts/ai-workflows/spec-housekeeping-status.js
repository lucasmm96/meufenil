#!/usr/bin/env node
// S-005 — spec-housekeeping-status: verifica estado do housekeeping pós-merge de uma spec
// Output: JSON em stdout, erros em stderr, exit 0 (tudo ok) / 1 (passos pendentes)
// Invocação: node scripts/ai-workflows/spec-housekeeping-status.js --spec ENH-0013

import { readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listSpecs } from '../spec-github/lib/specs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

const ARCHIVE_IMPLEMENTED_DIR = join(SPECS_DIR, 'archive', 'implemented')
const PROPOSED_INDEX_PATH = join(SPECS_DIR, 'proposed', 'index.md')

function parseArgs(argv) {
  const specArg = argv.find((a) => a.startsWith('--spec='))?.split('=')[1]
    ?? argv[argv.indexOf('--spec') + 1]
  if (!specArg) {
    process.stderr.write('Uso: node scripts/ai-workflows/spec-housekeeping-status.js --spec <ID>\n')
    process.exit(1)
  }
  return { specId: specArg.trim() }
}

function isInProposed(spec) {
  return spec?.area === 'proposed'
}

function isArchivedToImplemented(spec) {
  return spec?.area === 'archive/implemented'
}

function indexLineExists(specId) {
  if (!existsSync(PROPOSED_INDEX_PATH)) return false
  const content = readFileSync(PROPOSED_INDEX_PATH, 'utf8')
  return content.includes(specId)
}

function indexLineShowsImplemented(specId) {
  if (!existsSync(PROPOSED_INDEX_PATH)) return false
  const content = readFileSync(PROPOSED_INDEX_PATH, 'utf8')
  const lines = content.split('\n')
  const line = lines.find((l) => l.includes(specId))
  if (!line) return false
  return /IMPLEMENTED/i.test(line)
}

function implementedThroughFilled(spec) {
  if (!spec?.filePath || !existsSync(spec.filePath)) return false
  const content = readFileSync(spec.filePath, 'utf8')
  return /^\*\*Implemented Through:\*\*\s*\S+/m.test(content)
}

function run(argv) {
  const { specId } = parseArgs(argv)

  if (!existsSync(SPECS_DIR)) {
    process.stderr.write(`Diretório de specs não encontrado: ${SPECS_DIR}\n`)
    process.exit(1)
  }

  const allSpecs = listSpecs(SPECS_DIR)
  const spec = allSpecs.find((s) => s.id === specId)

  const inProposed = isInProposed(spec)
  const archivedToImplemented = isArchivedToImplemented(spec)
  const hasIndexLine = indexLineExists(specId)
  const indexImplemented = indexLineShowsImplemented(specId)
  const implThrough = spec ? implementedThroughFilled(spec) : false
  const hasIssue = !!(spec?.issue)

  const steps = {
    specInProposed: inProposed,
    specArchivedToImplemented: archivedToImplemented,
    indexLineExists: hasIndexLine,
    indexLineShowsImplemented: indexImplemented,
    implementedThroughFilled: implThrough,
    issueNumberKnown: hasIssue,
  }

  const remaining = []
  if (inProposed) remaining.push(`Mover spec para archive/implemented/<categoria>/`)
  if (!archivedToImplemented && !inProposed) remaining.push(`Spec não encontrada em proposed/ nem archive/implemented/ — verificar localização`)
  if (!indexImplemented) remaining.push('Atualizar linha em proposed/index.md para IMPLEMENTED (ou remover se arquivado)')
  if (!implThrough) remaining.push('Preencher campo **Implemented Through:** na spec')
  if (!hasIssue) remaining.push('Issue number ausente — verificar se Issue foi criada')

  const allDone = remaining.length === 0

  return {
    specId,
    steps,
    remaining,
    allDone,
    generatedAt: new Date().toISOString(),
  }
}

try {
  const result = run(process.argv.slice(2))
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (!result.allDone) process.exit(1)
} catch (err) {
  process.stderr.write(`spec-housekeeping-status: ${err.message}\n`)
  process.exit(1)
}
