#!/usr/bin/env node
// pre-release-check (REF-0004/REF-0005): verificação preventiva LOCAL do corpo do PR
// de release e/ou do corpo da Release — tabela §23 parseável, Specs existem, frontmatter
// `Issue:` bate, docs exigida quando FEAT/ENH. Evita as iterações de
// tentativa-e-erro que o gate W7 (release-gate.js) só pegaria no CI.
//
// Não consulta a API (rest null): a existência de Issue/PR merged continua sendo
// verificada pelo gate W7 no momento do PR. Determinístico, sem IA.
//
// Uso:
//   node scripts/spec-github/pre-release-check.js --body-file <md> [--dry-run]
//   node scripts/spec-github/pre-release-check.js --release-body-file <md> [--dry-run]
//   node scripts/spec-github/pre-release-check.js --body-file <md> --release-body-file <md> [--dry-run]

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { verifyTraceability } from './lib/traceability-verify.js'
import { docsRequirement, parseArgs } from './release-gate.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

/**
 * Verifica a tabela §23 de um arquivo markdown (corpo do PR ou da Release).
 * @param {string} filePath - caminho do arquivo a verificar
 * @param {string} label - "corpo do PR" ou "corpo da Release" (para mensagens de erro)
 * @param {string} [specsDir] - diretório base das specs (injetável para testes)
 * @returns {Promise<{ failures: string[], rows: object[] }>}
 */
export async function checkBody(filePath, label, specsDir = SPECS_DIR) {
  const body = readFileSync(filePath, 'utf8')
  const trace = await verifyTraceability({ body, baseDir: specsDir, rest: null, requireIssueClosed: false })

  const failures = []
  if (trace.action === 'no-table') {
    failures.push(
      `${label} sem a tabela de rastreabilidade §23 (formato: \`## Rastreabilidade\` + \`| Spec | Issue | PR | Título | Tipo |\`)`
    )
  } else if (trace.action === 'malformed-rows') {
    failures.push(`Linhas malformadas na tabela §23 do ${label} (${trace.malformedRows.length} linha(s) ignoradas)`)
  } else {
    for (const check of trace.checks) {
      if (!check.specExists) failures.push(`Spec ${check.row.spec} não encontrada no repositório`)
      if (!check.specIssueMatches) {
        failures.push(`frontmatter Issue: da Spec ${check.row.spec} não bate com #${check.row.issue}`)
      }
    }
  }

  return { failures, rows: trace.checks?.map((c) => c.row) ?? [] }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.bodyFile && !args.releaseBodyFile) {
    console.error(
      'Uso: node scripts/spec-github/pre-release-check.js --body-file <md> [--release-body-file <md>] [--dry-run]'
    )
    process.exit(1)
  }

  try {
    let allFailures = []
    let allRows = []

    if (args.bodyFile) {
      const { failures, rows } = await checkBody(args.bodyFile, 'corpo do PR')
      const localOnly = rows.length > 0 ? ' (Issue/PR validados pelo gate W7 no CI)' : ''
      console.log(`pre-release-check PR body: ${failures.length === 0 ? 'PASS' : 'FAIL'} — formato local${localOnly}`)
      for (const f of failures) console.error(`- ${f}`)
      allFailures = allFailures.concat(failures)
      allRows = allRows.concat(rows)
    }

    if (args.releaseBodyFile) {
      const { failures, rows } = await checkBody(args.releaseBodyFile, 'corpo da Release')
      const localOnly = rows.length > 0 ? ' (Issue/PR validados pelo gate W7 no CI)' : ''
      console.log(
        `pre-release-check Release body: ${failures.length === 0 ? 'PASS' : 'FAIL'} — formato local${localOnly}`
      )
      for (const f of failures) console.error(`- ${f}`)
      allFailures = allFailures.concat(failures)
      allRows = allRows.concat(rows)
    }

    const docsRequired = docsRequirement(allRows)
    console.log(
      docsRequired
        ? 'docs: FEAT/ENH presente — diff em wiki/ será exigida pelo gate W7'
        : 'docs: sem FEAT/ENH — wiki/ não exigida'
    )

    process.exit(allFailures.length === 0 ? 0 : 1)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
