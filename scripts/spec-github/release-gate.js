#!/usr/bin/env node
// W7 — release-gate (Blueprint v1.1-final §18.1; CONVENTIONS §18.9, revisado pela
// ADR-0013): GATE determinístico de produção — nenhuma feature vai a master sem
// Spec e documentação. Roda em pull_request com base master (PR de release):
// 1) tabela §23 íntegra (Spec existe, frontmatter Issue: bate, Issue existe, PR
//    merged — Issue pode estar aberta no pré-merge, requireIssueClosed: false);
// 2) docs: quando a tabela contém FEAT/ENH, exige diff em wiki/ desde a última
//    release publicada (tags MISTAS no repo — annotated e lightweight — por isso
//    `git tag --merged HEAD --sort=-version:refname`, não `git describe`).
// Determinístico, sem IA. Falha = exit 1 + comentário no PR (marker de dedup,
// update-in-place — sem spam a cada push). NUNCA cria tag, NUNCA faz push,
// NUNCA merge.
//
// Uso:
//   node scripts/spec-github/release-gate.js --body-file <md> [--pr N] [--dry-run]

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { verifyTraceability } from './lib/traceability-verify.js'
import { GitHubClient } from './lib/github.js'
import { loadToken } from './lib/env.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

export const GATE_COMMENT_MARKER = '<!-- sync:release-gate -->'
const DOCS_TYPES = new Set(['FEAT', 'ENH'])

/** Aceita as duas formas: `--pr=42` e `--pr 42` (o workflow usa a segunda). */
export function parseArgs(argv) {
  const args = { dryRun: false, bodyFile: null, pr: null, repo: 'lucasmm96/meufenil' }
  const value = (arg, i) => (arg.includes('=') ? arg.split('=')[1] : argv[i + 1])
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--body-file')) args.bodyFile = value(arg, i)
    else if (arg.startsWith('--pr')) args.pr = Number(value(arg, i))
    else if (arg.startsWith('--repo')) args.repo = value(arg, i)
  }
  return args
}

/** FEAT/ENH na tabela → documentação pública exigida no release. */
export function docsRequirement(rows) {
  return rows.some((r) => DOCS_TYPES.has(r.type))
}

/** Diff de docs satisfeito: não requerida, ou requerida com pelo menos 1 arquivo. */
export function docsDiffOk({ required, changedFiles }) {
  return !required || changedFiles.length > 0
}

/** Última tag de release ancestral do HEAD (merge commit do PR, base master). */
export function resolveLastTag(run) {
  const out = run('git', ['tag', '--merged', 'HEAD', '--sort=-version:refname'])
  const first = String(out ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean)
  return first || null
}

/** Arquivos de `path` alterados entre a última tag e o headRef (ex.: wiki/**). */
export function gitChangedFiles(run, { lastTag, headRef = 'HEAD', path = 'wiki' }) {
  const out = run('git', ['diff', '--name-only', `${lastTag}...${headRef}`, '--', path])
  return String(out ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** Comentário de falha do gate — bullets do que falta (mesma semântica do logChecks do W6). */
export function buildGateComment({ trace, docs }) {
  const lines = [
    `${GATE_COMMENT_MARKER}`,
    '❌ **release-gate**: o PR de release não passa no gate de produção (Spec + Documentação).',
    '',
    'O que falta:',
  ]
  for (const { row, specExists, specIssueMatches, issueExists, prExists, isPr, prMerged, ok } of trace.checks ?? []) {
    if (ok) continue
    const problems = []
    if (!specExists) problems.push(`Spec ${row.spec} não encontrada no repositório`)
    if (!specIssueMatches) problems.push(`frontmatter Issue: da Spec ${row.spec} não bate com #${row.issue}`)
    if (!issueExists) problems.push(`Issue #${row.issue} inexistente`)
    if (!prExists) problems.push(`PR #${row.pr} inexistente`)
    if (prExists && isPr === false) problems.push(`#${row.pr} não é um PR`)
    if (isPr && prMerged === false) problems.push(`PR #${row.pr} não merged`)
    lines.push(`- **${row.spec}** — ${problems.join('; ')}`)
  }
  if (trace.action === 'no-table') {
    lines.push(
      '- Corpo do PR sem a tabela de rastreabilidade §23 (formato: `## Rastreabilidade` + `| Spec | Issue | PR | Título | Tipo |`)'
    )
  }
  if (trace.action === 'malformed-rows') {
    lines.push(`- Linhas malformadas na tabela §23 (${trace.malformedRows.length} linha(s) ignoradas)`)
  }
  if (docs && !docs.ok) {
    lines.push(
      docs.lastTag
        ? `- Release contém FEAT/ENH mas sem mudanças em \`wiki/\` desde a última release (\`${docs.lastTag}\`) — atualize a documentação pública`
        : '- Nenhuma tag de release anterior encontrada — base do diff de documentação indisponível'
    )
  }
  return lines.join('\n')
}

/** Posta ou atualiza o comentário de falha no PR (marker de dedup — nunca spam). */
export async function postGateFailure({ pr, comment, rest }) {
  const comments = (await rest.listComments(pr)) ?? []
  const existing = comments.find((c) => c.body?.includes(GATE_COMMENT_MARKER))
  if (existing) {
    await rest.updateComment(existing.id, comment)
    return { action: 'updated', id: existing.id }
  }
  await rest.addComment(pr, comment)
  return { action: 'posted' }
}

/**
 * Gate completo: rastreabilidade §23 primeiro (nunca exige docs de uma release
 * com rastreabilidade quebrada), depois o diff de documentação.
 */
export async function runReleaseGate({ body, baseDir, rest, run, pr = null, headRef = 'HEAD', dryRun = false }) {
  const trace = await verifyTraceability({ body, baseDir, rest, requireIssueClosed: false })
  if (trace.action !== 'verified') {
    return { pass: false, trace, docs: null, comment: buildGateComment({ trace, docs: null }) }
  }

  const rows = trace.checks.map((c) => c.row)
  const required = docsRequirement(rows)
  const lastTag = resolveLastTag(run)
  if (!lastTag) {
    const docs = { required, lastTag: null, changedFiles: [], ok: false }
    return { pass: false, trace, docs, comment: buildGateComment({ trace, docs }) }
  }

  const changedFiles = gitChangedFiles(run, { lastTag, headRef })
  const docs = { required, lastTag, changedFiles, ok: docsDiffOk({ required, changedFiles }) }
  return { pass: docs.ok, trace, docs, comment: docs.ok ? null : buildGateComment({ trace, docs }) }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const token = loadToken(REPO_ROOT)
  if (!args.bodyFile) {
    console.error('Uso: node scripts/spec-github/release-gate.js --body-file <md> [--pr N] [--dry-run]')
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
          updateComment: (id, b) => client.updateComment(id, b),
        }
      : null
    const run = (cmd, argv) => {
      try {
        return execFileSync(cmd, argv, { encoding: 'utf8' })
      } catch {
        return ''
      }
    }

    const result = await runReleaseGate({ body, baseDir: SPECS_DIR, rest, run, pr: args.pr, dryRun: args.dryRun })
    const docsNote = result.docs ? `, docs: ${result.docs.ok ? 'ok' : 'missing'}` : ''
    console.log(`release-gate: ${result.pass ? 'PASS' : 'FAIL'} (${result.trace.action}${docsNote})`)
    if (result.comment) console.error(result.comment)

    if (!result.pass && !result.dryRun && args.pr && rest) {
      const posted = await postGateFailure({ pr: args.pr, comment: result.comment, rest })
      console.log(`comentário de falha ${posted.action} no PR #${args.pr} (marker de dedup)`)
    }

    process.exit(result.pass ? 0 : 1)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
