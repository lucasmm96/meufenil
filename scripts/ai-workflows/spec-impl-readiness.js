#!/usr/bin/env node
// S-004 — spec-impl-readiness: verifica prontidão de uma spec para implementação
// Output: JSON em stdout, erros em stderr, exit 0 (ok) / 1 (falha ou spec não pronta)
// Invocação: node scripts/ai-workflows/spec-impl-readiness.js --spec ENH-0013

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listSpecs } from '../spec-github/lib/specs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

function parseArgs(argv) {
  const specArg = argv.find((a) => a.startsWith('--spec='))?.split('=')[1]
    ?? argv[argv.indexOf('--spec') + 1]
  if (!specArg) {
    process.stderr.write('Uso: node scripts/ai-workflows/spec-impl-readiness.js --spec <ID>\n')
    process.exit(1)
  }
  return { specId: specArg.trim() }
}

function branchExists(name, remote = false) {
  try {
    const ref = remote ? `origin/${name}` : name
    execSync(`git show-ref --verify --quiet refs/${remote ? 'remotes' : 'heads'}/${ref.replace('origin/', '')}`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

function hasPendingTBD(spec) {
  const text = [spec.problem, spec.proposed, spec.acs].filter(Boolean).join('\n')
  return /\bTBD\b/.test(text)
}

function run(argv) {
  const { specId } = parseArgs(argv)

  if (!existsSync(SPECS_DIR)) {
    process.stderr.write(`Diretório de specs não encontrado: ${SPECS_DIR}\n`)
    process.exit(1)
  }

  const allSpecs = listSpecs(SPECS_DIR)
  const spec = allSpecs.find((s) => s.id === specId)

  if (!spec) {
    return {
      specId,
      filePath: null,
      found: false,
      status: null,
      decision: null,
      openQuestionsHavePendingTBD: false,
      issueNumber: null,
      dependencies: [],
      localBranchExists: false,
      remoteBranchExists: false,
      blockers: [`Spec ${specId} não encontrada em ${SPECS_DIR}`],
      canProceed: false,
      generatedAt: new Date().toISOString(),
    }
  }

  const branchName = `spec/${specId}`
  const localBranch = branchExists(branchName, false)
  const remoteBranch = branchExists(branchName, true)

  const blockers = []

  if (spec.status !== 'PROPOSED' && spec.status !== 'ACCEPTED') {
    blockers.push(`Status inválido para implementação: ${spec.status} (esperado PROPOSED ou ACCEPTED)`)
  }

  if (!spec.decision || spec.decision === 'TBD') {
    blockers.push('Decision não definido (requer decisão aprovada para implementar)')
  }

  if (!spec.issue) {
    blockers.push('Issue number ausente no frontmatter (campo **Issue:**)')
  }

  const pendingTBD = hasPendingTBD(spec)
  if (pendingTBD) {
    blockers.push('Conteúdo da spec ainda contém TBD não resolvido')
  }

  return {
    specId,
    filePath: spec.path,
    found: true,
    status: spec.status,
    decision: spec.decision,
    openQuestionsHavePendingTBD: pendingTBD,
    issueNumber: spec.issue,
    dependencies: [],
    localBranchExists: localBranch,
    remoteBranchExists: remoteBranch,
    blockers,
    canProceed: blockers.length === 0,
    generatedAt: new Date().toISOString(),
  }
}

try {
  const result = run(process.argv.slice(2))
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (!result.canProceed) process.exit(1)
} catch (err) {
  process.stderr.write(`spec-impl-readiness: ${err.message}\n`)
  process.exit(1)
}
