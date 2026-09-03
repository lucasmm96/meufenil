#!/usr/bin/env node
// pre-release-check (REF-0004, AC3): verificação preventiva LOCAL do corpo do PR
// de release ANTES do push — tabela §23 parseável, Specs existem, frontmatter
// `Issue:` bate, docs exigida quando FEAT/ENH. Evita as iterações de
// tentativa-e-erro que o gate W7 (release-gate.js) só pegaria no CI.
//
// Não consulta a API (rest null): a existência de Issue/PR merged continua sendo
// verificada pelo gate W7 no momento do PR. Determinístico, sem IA.
//
// Uso:
//   node scripts/spec-github/pre-release-check.js --body-file <md> [--dry-run]

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { verifyTraceability } from './lib/traceability-verify.js'
import { docsRequirement, parseArgs } from './release-gate.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.bodyFile) {
    console.error('Uso: node scripts/spec-github/pre-release-check.js --body-file <md> [--dry-run]')
    process.exit(1)
  }

  try {
    const body = readFileSync(args.bodyFile, 'utf8')
    // requireIssueClosed: false — pré-merge, mesma semântica do gate W7.
    const trace = await verifyTraceability({ body, baseDir: SPECS_DIR, rest: null, requireIssueClosed: false })

    const failures = []
    if (trace.action === 'no-table') {
      failures.push('Corpo do PR sem a tabela de rastreabilidade §23 (formato: `## Rastreabilidade` + `| Spec | Issue | PR | Título | Tipo |`)')
    } else if (trace.action === 'malformed-rows') {
      failures.push(`Linhas malformadas na tabela §23 (${trace.malformedRows.length} linha(s) ignoradas)`)
    } else {
      for (const check of trace.checks) {
        if (!check.specExists) failures.push(`Spec ${check.row.spec} não encontrada no repositório`)
        if (!check.specIssueMatches) {
          failures.push(`frontmatter Issue: da Spec ${check.row.spec} não bate com #${check.row.issue}`)
        }
      }
    }

    const rows = trace.checks.map((c) => c.row)
    const docsRequired = docsRequirement(rows)
    // rest null → Issue/PR não verificados aqui; só o formato local (Spec existe,
    // frontmatter bate). A existência de Issue/PR merged é do gate W7 no CI.
    const localOnly = rows.length > 0 ? ' (Issue/PR validados pelo gate W7 no CI)' : ''

    console.log(`pre-release-check: ${failures.length === 0 ? 'PASS' : 'FAIL'} — formato local${localOnly}`)
    if (failures.length > 0) {
      for (const f of failures) console.error(`- ${f}`)
    }
    console.log(
      docsRequired
        ? 'docs: FEAT/ENH presente — diff em wiki/ será exigida pelo gate W7'
        : 'docs: sem FEAT/ENH — wiki/ não exigida'
    )

    process.exit(failures.length === 0 ? 0 : 1)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
