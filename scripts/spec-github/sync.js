#!/usr/bin/env node
// Sync Spec ↔ GitHub Issue (Fase 2 — Blueprint v1.1-final §20).
//
// IDEMPOTENTE: executar duas vezes não cria duas Issues (chave: campo `Issue:` no frontmatter
// ou busca por label `spec:<ID>`) e não duplica comentários.
//
// DIVERGÊNCIA (nunca corrigir silenciosamente — CONVENTIONS §18.5 / D-12 CASO 3):
//   - Issue fechada com Spec ativa            → reporta, não toca
//   - Issue aberta com Spec terminal          → reporta (fechamento é ato explícito do workflow)
//   - corpo do Issue sem SPEC-PROJECTION      → reporta, não sobrescreve corpo
//   - mais de um Issue com a label spec:<ID>  → reporta, não toca
//
// Uso:
//   node scripts/spec-github/sync.js                 # requer GITHUB_TOKEN (env ou .env.github)
//   node scripts/spec-github/sync.js --dry-run       # pré-visualiza local (sem token: só leitura local)

import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { listSpecs, backfillIssueNumber, TERMINAL_STATUSES } from './lib/specs.js'
import { buildBody, issueTitle, labels, replaceProjectionBlock, specLabel } from './lib/projection.js'
import { GitHubClient, GitHubApiError } from './lib/github.js'
import { loadToken } from './lib/env.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function parseArgs(argv) {
  const args = { dryRun: false, baseDir: join(REPO_ROOT, '.ai', 'specs'), repo: 'lucasmm96/meufenil' }
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--base-dir=')) args.baseDir = resolve(arg.slice('--base-dir='.length))
    else if (arg.startsWith('--repo=')) args.repo = arg.slice('--repo='.length)
  }
  return args
}

function applyBackfill(spec, number, dryRun) {
  const updated = backfillIssueNumber(spec, number)
  if (updated === null) return 'already'
  if (updated === false) return 'no-status-anchor'
  if (!dryRun) writeFileSync(spec.filePath, updated)
  return 'backfilled'
}

/**
 * Executa a sincronização declarativa. Retorna relatório por Spec:
 * { id, area, action: 'create'|'update'|'ok'|'local-preview', number, divergences: [] }
 */
export async function runSync({ token, owner, repo, baseDir, dryRun = false, client = null }) {
  const specs = listSpecs(baseDir)
  const api = client ?? (token ? new GitHubClient({ token, owner, repo }) : null)
  const report = []

  if (api && !dryRun) {
    const allLabels = [...new Set(specs.flatMap((spec) => labels(spec)))]
    for (const name of allLabels) await api.ensureLabel(name)
  }

  for (const spec of specs) {
    const entry = { id: spec.id, area: spec.area, action: 'ok', number: spec.issue, divergences: [] }
    const desired = { title: issueTitle(spec), body: buildBody(spec), labels: labels(spec) }

    if (!api) {
      entry.action = spec.issue
        ? 'local-preview (Issue existente — diff indisponível sem token)'
        : 'local-preview (criaria Issue)'
      report.push(entry)
      continue
    }

    let existing = null
    if (spec.issue) {
      existing = await api.getIssue(spec.issue)
      if (!existing) {
        entry.divergences.push(`Issue #${spec.issue} do frontmatter não existe no GitHub`)
        const byLabel = await api.findIssuesByLabel(specLabel(spec.id))
        if (byLabel.length === 1) existing = byLabel[0]
        else if (byLabel.length > 1) entry.divergences.push(`múltiplas Issues com label ${specLabel(spec.id)}`)
      }
    } else {
      const byLabel = await api.findIssuesByLabel(specLabel(spec.id))
      if (byLabel.length === 1) existing = byLabel[0]
      else if (byLabel.length > 1) entry.divergences.push(`múltiplas Issues com label ${specLabel(spec.id)}`)
    }

    if (!existing) {
      if (dryRun) {
        entry.action = 'create (dry-run)'
        report.push(entry)
        continue
      }
      const created = await api.createIssue(desired)
      entry.action = 'create'
      entry.number = created.number
      entry.backfill = applyBackfill(spec, created.number, dryRun)
      report.push(entry)
      continue
    }

    entry.number = existing.number

    if (existing.state === 'closed' && !TERMINAL_STATUSES.includes(spec.status)) {
      entry.divergences.push(
        `Issue fechada mas Spec está ${spec.status} — D-12 CASO 3: não reverter nem aceitar; decidir com o autor`
      )
    }
    if (existing.state === 'open' && TERMINAL_STATUSES.includes(spec.status)) {
      entry.divergences.push(
        `Spec ${spec.status} mas Issue aberta — fechamento é ato explícito do workflow (D-12), não executado pelo sync`
      )
    }

    let bodyChanged = false
    const mergedBody = replaceProjectionBlock(existing.body, desired.body)
    if (mergedBody === null) {
      entry.divergences.push('corpo sem marcadores SPEC-PROJECTION — não sobrescrever (possível edição manual)')
    } else if (mergedBody !== existing.body) {
      bodyChanged = true
    }

    const titleChanged = existing.title !== desired.title
    const labelsChanged =
      JSON.stringify([...(existing.labels ?? []).map((l) => l.name)].sort()) !==
      JSON.stringify([...desired.labels].sort())

    if (bodyChanged || titleChanged || labelsChanged) {
      if (dryRun) {
        entry.action = 'update (dry-run)'
      } else {
        await api.updateIssue(existing.number, { title: desired.title, body: mergedBody ?? existing.body })
        await api.setLabels(existing.number, desired.labels)
        entry.action = 'update'
      }
    }

    if ((!spec.issue || spec.issue !== existing.number) && !dryRun) {
      entry.backfill = applyBackfill(spec, existing.number, dryRun)
      if (entry.backfill === 'backfilled' && entry.action === 'ok') entry.action = 'backfill'
    }
    report.push(entry)
  }

  return report
}

function printReport(report, dryRun) {
  console.log(`\nSpec ↔ Issue sync${dryRun ? ' (DRY-RUN)' : ''} — ${report.length} specs\n`)
  for (const entry of report) {
    const line = [
      entry.id.padEnd(12),
      (entry.area ?? '').padEnd(18),
      String(entry.action).padEnd(46),
      entry.number ? `#${entry.number}` : '',
      entry.backfill ? `[${entry.backfill}]` : '',
    ].join('  ')
    console.log(line)
    for (const d of entry.divergences) console.log(`  ⚠ ${d}`)
  }
  const divergences = report.reduce((n, e) => n + e.divergences.length, 0)
  console.log(`\nDivergências: ${divergences}`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const [owner, repo] = args.repo.split('/')
  const token = loadToken(REPO_ROOT)
  if (!token && !args.dryRun) {
    console.error('GITHUB_TOKEN ausente — defina a variável de ambiente ou crie .env.github (não versionado).')
    process.exit(1)
  }
  try {
    const report = await runSync({ token, owner, repo, baseDir: args.baseDir, dryRun: args.dryRun })
    printReport(report, args.dryRun)
  } catch (error) {
    if (error instanceof GitHubApiError) {
      console.error(`Falha de API (HTTP ${error.status}): ${error.message}`)
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}
