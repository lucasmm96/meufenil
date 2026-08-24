#!/usr/bin/env node
// W3 — issue-responder (Blueprint v1.1-final §18.1/§19; CONVENTIONS §18.7, revisado
// pela ADR-0013): Issues EXTERNAS (autor ≠ mantenedor) recebem uma resposta automática
// ESTÁTICA (sem IA, sem custo) + label `triage`. A triagem em si é SEMPRE humana
// (mantenedor) — este script nunca decide elegibilidade, nunca cria Spec e nunca
// aplica `spec-created`/`duplicate`/`not-planned`. Comentário com marker para dedup.
//
// Uso:
//   node scripts/spec-github/issue-responder.js --issue N [--dry-run] [--repo o/r]

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { GitHubClient } from './lib/github.js'
import { loadToken } from './lib/env.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const RESPONDER_MARKER = '<!-- sync:issue-responder -->'
export const FLOW_LABELS = ['spec-driven', 'spec-created', 'duplicate', 'not-planned']

export const STATIC_COMMENT =
  `${RESPONDER_MARKER}\n` +
  `Obrigado pela contribuição! Esta Issue foi registrada com a label \`triage\` e será avaliada pelo ` +
  `mantenedor. Se elegível, ela será transformada em uma Spec canônica em \`.ai/specs/proposed/\` e ` +
  `referenciada aqui — Issues externas são preservadas como discussão original e nunca autorizam ` +
  `implementação por si só.\n\n` +
  `Sem promessas de prazo: o projeto é mantido no tempo disponível do autor.\n\n` +
  `Se esta Issue é uma dúvida de uso do app, consulte o Guia do Usuário na wiki do projeto.`

/** Aceita as duas formas: `--issue=44` e `--issue 44` (o workflow usa a segunda). */
export function parseArgs(argv) {
  const args = { dryRun: false, issue: null, repo: 'lucasmm96/meufenil' }
  const value = (arg, i) => (arg.includes('=') ? arg.split('=')[1] : argv[i + 1])
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--issue')) args.issue = Number(value(arg, i))
    else if (arg.startsWith('--repo')) args.repo = value(arg, i)
  }
  return args
}

/**
 * Decisão de resposta (função pura, testável):
 * - autor externo (NONE/CONTRIBUTOR) sem labels do fluxo e sem marker → respond.
 * - mantenedor/collaborator (OWNER/MEMBER/COLLABORATOR) → skip-author.
 * - qualquer label do fluxo já presente → skip-label (Issue já tratada).
 * - marker de dedup já presente → skip-already-responded (idempotência).
 */
export function responderDecision({ authorAssociation, labels, hasMarker }) {
  if (!['NONE', 'CONTRIBUTOR'].includes(authorAssociation)) return { action: 'skip-author', comment: null }
  if (FLOW_LABELS.some((l) => labels?.includes(l))) return { action: 'skip-label', comment: null }
  if (hasMarker) return { action: 'skip-already-responded', comment: null }
  return { action: 'respond', comment: STATIC_COMMENT }
}

export async function runIssueResponder({ token, rest, issueNumber, dryRun = false }) {
  if (!token || !rest) {
    return { action: dryRun ? 'dry-run (sem token)' : 'no-token', comment: null }
  }

  const issue = await rest.getIssue(issueNumber)
  if (!issue) return { action: 'issue-not-found', comment: null }

  const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name))
  const comments = (await rest.listComments(issueNumber)) ?? []
  const hasMarker = comments.some((c) => c.body?.includes(RESPONDER_MARKER))
  const decision = responderDecision({ authorAssociation: issue.author_association, labels, hasMarker })

  if (dryRun) return { ...decision, action: `${decision.action} (dry-run)` }
  if (decision.action !== 'respond') return decision

  await rest.addComment(issueNumber, decision.comment)
  await rest.addLabels(issueNumber, ['triage'])
  return { action: 'responded', comment: null }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const token = loadToken(REPO_ROOT)
  if (!args.issue) {
    console.error('Uso: node scripts/spec-github/issue-responder.js --issue N [--dry-run]')
    process.exit(1)
  }
  if (!token && !args.dryRun) {
    console.error('GITHUB_TOKEN ausente — defina em .env.github (não versionado) ou via variável de ambiente.')
    process.exit(1)
  }
  try {
    const [owner, repo] = args.repo.split('/')
    const rest = token ? new GitHubClient({ token, owner, repo }) : null
    const result = await runIssueResponder({ token, rest, issueNumber: args.issue, dryRun: args.dryRun })
    console.log(`issue-responder #${args.issue}: ${result.action}`)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
