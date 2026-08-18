#!/usr/bin/env node
// W4 — issue-reconcile (Blueprint v1.1-final §18.1): quando o estado do Issue canônico
// (closed/reopened) diverge do Status da Spec, registra a divergência em comentário.
// D-12 CASO 3: NUNCA reverte, NUNCA acata, NUNCA assume — e este script NUNCA fecha
// nem reabre Issues. Comentário com marker para dedup.
//
// Uso:
//   node scripts/spec-github/reconcile.js --issue N --action closed|reopened [--dry-run]

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { listSpecs } from './lib/specs.js'
import { GitHubClient } from './lib/github.js'
import { loadToken } from './lib/env.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')
const TERMINAL_STATUSES = new Set(['IMPLEMENTED', 'REJECTED', 'SUPERSEDED'])
const COMMENT_MARKER = '<!-- sync:reconcile -->'

/** Aceita as duas formas: `--issue=26` e `--issue 26` (o workflow usa a segunda). */
export function parseArgs(argv) {
  const args = { dryRun: false, issue: null, action: null, repo: 'lucasmm96/meufenil' }
  const value = (arg, i) => (arg.includes('=') ? arg.split('=')[1] : argv[i + 1])
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--issue')) args.issue = Number(value(arg, i))
    else if (arg.startsWith('--action')) args.action = value(arg, i)
    else if (arg.startsWith('--repo')) args.repo = value(arg, i)
  }
  return args
}

/**
 * Regras D-12 CASO 3 (função pura, testável):
 * - closed + Spec não terminal → divergência (comentário pedindo decisão).
 * - reopened + Spec terminal → divergência (comentário pedindo decisão).
 * - demais casos → no-op.
 */
export function reconciliation({ action, issueState, specStatus }) {
  if (!specStatus) return { action: 'no-op', comment: null }

  if (action === 'closed' && issueState === 'closed' && !TERMINAL_STATUSES.has(specStatus)) {
    return {
      action: 'divergence-comment',
      comment:
        `${COMMENT_MARKER}\n` +
        `⚠️ Divergência registrada (D-12 CASO 3): este Issue foi fechado manualmente, mas a Spec está ` +
        `\`${specStatus}\` (não terminal). O fechamento de Issue canônica segue o fluxo de encerramento ` +
        `(CONVENTIONS §18.6). Nenhuma ação automática foi executada — decisão humana necessária.`,
    }
  }

  if (action === 'reopened' && issueState === 'open' && TERMINAL_STATUSES.has(specStatus)) {
    return {
      action: 'divergence-comment',
      comment:
        `${COMMENT_MARKER}\n` +
        `⚠️ Divergência registrada (D-12 CASO 3): este Issue foi reaberto manualmente, mas a Spec está ` +
        `\`${specStatus}\` (terminal). Nenhuma ação automática foi executada — decisão humana necessária.`,
    }
  }

  return { action: 'no-op', comment: null }
}

export async function runReconcile({ token, rest, issueNumber, action, dryRun = false, baseDir = SPECS_DIR }) {
  const specs = listSpecs(baseDir)
  const spec = specs.find((s) => s.issue === issueNumber)
  if (!spec) return { action: 'no-spec', comment: null }

  if (dryRun || !token) {
    const preview = reconciliation({
      action,
      issueState: action === 'closed' ? 'closed' : 'open',
      specStatus: spec.status,
    })
    return { ...preview, action: dryRun ? `${preview.action} (dry-run)` : preview.action }
  }

  const issue = await rest.getIssue(issueNumber)
  if (!issue) return { action: 'issue-not-found', comment: null }

  const result = reconciliation({ action, issueState: issue.state, specStatus: spec.status })
  if (result.action === 'divergence-comment') {
    const comments = (await rest.listComments(issueNumber)) ?? []
    const alreadyCommented = comments.some((c) => c.body?.includes(COMMENT_MARKER))
    if (alreadyCommented) return { action: 'comment-already-present', comment: null }
    await rest.addComment(issueNumber, result.comment)
  }
  return result
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const token = loadToken(REPO_ROOT)
  if (!args.issue || !args.action) {
    console.error('Uso: node scripts/spec-github/reconcile.js --issue N --action closed|reopened [--dry-run]')
    process.exit(1)
  }
  if (!token && !args.dryRun) {
    console.error('GITHUB_TOKEN ausente — defina em .env.github (não versionado) ou via variável de ambiente.')
    process.exit(1)
  }
  try {
    const [owner, repo] = args.repo.split('/')
    const rest = token ? new GitHubClient({ token, owner, repo }) : null
    const result = await runReconcile({ token, rest, issueNumber: args.issue, action: args.action, dryRun: args.dryRun })
    console.log(`issue-reconcile #${args.issue} (${args.action}): ${result.action}`)
    if (result.comment) console.log(result.comment)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
