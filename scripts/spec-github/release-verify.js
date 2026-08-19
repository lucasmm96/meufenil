#!/usr/bin/env node
// W6 — release-verify (Blueprint v1.1-final §18.1): evento release.published →
// verifica a tabela de rastreabilidade §23 do corpo da Release e fecha o milestone
// pós-publicação (§12.1 passo 6). Determinístico — a verificação da tabela é
// checklist mecânico (mesmo desvio justificado da coluna "IA: Sim" do §18.1
// adotado no W2/W4, autorizado em 2026-08-17). NUNCA cria tag, NUNCA publica
// release, NUNCA push. Falha = job vermelho com log explícito (anomalia
// registrada — Failure Mode #20: humano decide; nunca apagar a tag).
//
// Uso:
//   node scripts/spec-github/release-verify.js --tag vX.Y.Z --body-file <md> [--dry-run]

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { listSpecs } from './lib/specs.js'
import { parseTraceabilityTable } from './lib/release-traceability.js'
import { GitHubClient } from './lib/github.js'
import { loadToken } from './lib/env.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

/** Aceita as duas formas: `--tag=v1.8.0` e `--tag v1.8.0` (o workflow usa a segunda). */
export function parseArgs(argv) {
  const args = { dryRun: false, tag: null, bodyFile: null, repo: 'lucasmm96/meufenil' }
  const value = (arg, i) => (arg.includes('=') ? arg.split('=')[1] : argv[i + 1])
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--tag')) args.tag = value(arg, i)
    else if (arg.startsWith('--body-file')) args.bodyFile = value(arg, i)
    else if (arg.startsWith('--repo')) args.repo = value(arg, i)
  }
  return args
}

/** Compara milestone e tag normalizando o prefixo `v` (milestone = versão, §24). */
export function milestoneMatchesTag(milestoneTitle, tag) {
  return String(milestoneTitle).trim().replace(/^v/i, '') === String(tag).trim().replace(/^v/i, '')
}

/**
 * Verifica a tabela §23 de uma release publicada. Para cada linha: a Spec existe
 * no repositório (listSpecs), o frontmatter `Issue:` bate, o Issue está fechado e
 * o PR foi merged (o endpoint de Issue expõe `pull_request.merged_at` — só
 * `issues: write` basta, §18.1). Nunca altera nada — apenas verifica.
 */
export async function verifyTraceability({ body, baseDir, rest }) {
  const table = parseTraceabilityTable(body)
  if (!table) return { action: 'no-table', checks: [] }

  const specs = listSpecs(baseDir)
  const checks = []
  for (const row of table.rows) {
    const spec = specs.find((s) => s.id === row.spec)
    const issue = rest ? await rest.getIssue(row.issue) : null
    const prIssue = rest ? await rest.getIssue(row.pr) : null
    const issueClosed = issue ? issue.state === 'closed' : null
    const prExists = Boolean(prIssue)
    const isPr = prExists ? Boolean(prIssue.pull_request) : null
    const prMerged = isPr ? Boolean(prIssue.pull_request.merged_at) : null
    checks.push({
      row,
      specExists: Boolean(spec),
      specIssueMatches: spec ? spec.issue === row.issue : false,
      issueExists: Boolean(issue),
      issueClosed,
      prExists,
      isPr,
      prMerged,
      ok: Boolean(spec) && spec.issue === row.issue && issueClosed === true && prMerged === true,
    })
  }

  if (table.malformedRows.length > 0) return { action: 'malformed-rows', checks, malformedRows: table.malformedRows }
  const ok = checks.length > 0 && checks.every((c) => c.ok)
  return { action: ok ? 'verified' : 'divergence', checks }
}

/** Comentário por Issue canônico (idempotente via marker com a tag). */
function verificationComment(tag, row) {
  return (
    `<!-- sync:release-verify:${tag} -->\n` +
    `✅ Rastreabilidade verificada (W6): Spec \`${row.spec}\` · Issue #${row.issue} fechado · ` +
    `PR #${row.pr} merged · Release ${tag} publicada.`
  )
}

/** Posta os comentários de verificação quando a release inteira verifica. */
export async function postVerificationComments({ tag, checks, rest }) {
  for (const { row } of checks) {
    const comments = (await rest.listComments(row.issue)) ?? []
    const alreadyCommented = comments.some((c) => c.body?.includes(`sync:release-verify:${tag}`))
    if (alreadyCommented) continue
    await rest.addComment(row.issue, verificationComment(tag, row))
  }
}

/** Fecha o milestone aberto correspondente à tag (§12.1 passo 6); nada quando ambíguo. */
export async function closeMilestone({ tag, rest }) {
  const milestones = (await rest.listMilestones()) ?? []
  const matching = milestones.filter((m) => milestoneMatchesTag(m.title, tag))
  if (matching.length === 1) {
    await rest.updateMilestone(matching[0].number, 'closed')
    return { closed: matching[0].title }
  }
  return matching.length === 0 ? { note: `nenhum milestone aberto corresponde à tag ${tag}` } : { note: 'ambiguidade' }
}

/** Runner completo do W6: verifica e, quando a release inteira verifica, comenta e fecha o milestone. */
export async function runReleaseVerify({ tag, body, baseDir, rest, dryRun = false }) {
  const result = await verifyTraceability({ body, baseDir, rest })
  if (dryRun || result.action !== 'verified') return result
  await postVerificationComments({ tag, checks: result.checks, rest })
  const milestone = await closeMilestone({ tag, rest })
  return { ...result, milestone }
}

function logChecks(checks) {
  for (const { row, specExists, specIssueMatches, issueExists, issueClosed, prExists, isPr, prMerged, ok } of checks) {
    if (ok) {
      console.log(`✅ ${row.spec} · Issue #${row.issue} fechado · PR #${row.pr} merged`)
      continue
    }
    const problems = []
    if (!specExists) problems.push(`Spec ${row.spec} não encontrada no repositório`)
    if (!specIssueMatches) problems.push(`frontmatter Issue: da Spec ${row.spec} não bate com #${row.issue}`)
    if (!issueExists) problems.push(`Issue #${row.issue} inexistente`)
    if (issueClosed === false) problems.push(`Issue #${row.issue} aberto (esperado fechado)`)
    if (!prExists) problems.push(`PR #${row.pr} inexistente`)
    if (prExists && isPr === false) problems.push(`#${row.pr} não é um PR`)
    if (isPr && prMerged === false) problems.push(`PR #${row.pr} não merged`)
    console.error(`❌ ${row.spec} — ${problems.join('; ')}`)
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const token = loadToken(REPO_ROOT)
  if (!args.tag || !args.bodyFile) {
    console.error('Uso: node scripts/spec-github/release-verify.js --tag vX.Y.Z --body-file <md> [--dry-run]')
    process.exit(1)
  }
  if (!token && !args.dryRun) {
    console.error('GITHUB_TOKEN ausente — defina em .env.github (não versionado) ou via variável de ambiente.')
    process.exit(1)
  }

  try {
    const body = readFileSync(args.bodyFile, 'utf8')
    const [owner, repo] = args.repo.split('/')
    const client = token ? new GitHubClient({ token, owner, repo }) : null
    const rest = client
      ? {
          getIssue: (n) => client.getIssue(n),
          listComments: (n) => client.listComments(n),
          addComment: (n, b) => client.addComment(n, b),
          listMilestones: () => client.listMilestones(),
          updateMilestone: (n, state) => client.updateMilestone(n, state),
        }
      : null

    const result = await runReleaseVerify({ tag: args.tag, body, baseDir: SPECS_DIR, rest, dryRun: args.dryRun })
    console.log(`release-verify ${args.tag}: ${result.action}`)

    if (args.dryRun) {
      logChecks(result.checks)
      console.log('dry-run — nenhum comentário postado, nenhum milestone alterado')
      process.exit(0)
    }

    if (result.action === 'verified') {
      logChecks(result.checks)
      if (result.milestone?.closed) console.log(`milestone ${result.milestone.closed} fechado (§12.1 passo 6)`)
      if (result.milestone?.note) console.log(result.milestone.note)
      process.exit(0)
    }

    if (result.action === 'no-table') {
      console.error('ANOMALIA (Failure Mode #20): Release publicada sem a tabela de rastreabilidade §23 no corpo.')
      console.error('O corpo da Release deve incluir (um item por Spec da release):')
      console.error('## Rastreabilidade')
      console.error('| Spec | Issue | PR | Título | Tipo |')
      console.error('Nenhuma ação automática foi executada — humano decide (notas retroativas ou registro da anomalia); nunca apagar a tag.')
      process.exit(1)
    }

    if (result.action === 'malformed-rows') {
      console.error('Linhas malformadas na tabela §23:')
      for (const line of result.malformedRows) console.error(`  ${line}`)
      logChecks(result.checks)
      process.exit(1)
    }

    console.error('Divergência na rastreabilidade — verificar acima. Nenhuma ação automática além do registro.')
    logChecks(result.checks)
    process.exit(1)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
