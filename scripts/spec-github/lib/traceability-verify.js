// Verificação da tabela de rastreabilidade §23 (Blueprint v1.1-final §23;
// CONVENTIONS §18.9): para cada linha, a Spec existe (listSpecs), o frontmatter
// `Issue:` bate, o Issue atende à exigência de estado e o PR foi merged.
// Usada pelo W6 (release-verify, pós-publicação — Issue fechado exigido) e pelo
// W7 (release-gate, PR de release pré-merge — Issue pode estar aberta, desde
// que exista). Função pura em relação à REST: o cliente é injetado.

import { listSpecs } from './specs.js'
import { parseTraceabilityTable } from './release-traceability.js'

/**
 * @param {{body: string, baseDir: string, rest: object|null, requireIssueClosed?: boolean}} params
 *   requireIssueClosed: true (default, W6) exige Issue fechado; false (W7, pré-merge)
 *   aceita Issue aberta — desde que exista. PR merged é sempre obrigatório.
 */
export async function verifyTraceability({ body, baseDir, rest, requireIssueClosed = true }) {
  const table = parseTraceabilityTable(body)
  if (!table) return { action: 'no-table', checks: [] }

  const specs = listSpecs(baseDir)
  const checks = []
  for (const row of table.rows) {
    const spec = specs.find((s) => s.id === row.spec)
    const issue = rest ? await rest.getIssue(row.issue) : null
    const prIssue = rest ? await rest.getIssue(row.pr) : null
    const issueClosed = issue ? issue.state === 'closed' : null
    const issueExists = Boolean(issue)
    const prExists = Boolean(prIssue)
    const isPr = prExists ? Boolean(prIssue.pull_request) : null
    const prMerged = isPr ? Boolean(prIssue.pull_request.merged_at) : null
    const issueSatisfied = requireIssueClosed ? issueClosed === true : issueExists === true
    checks.push({
      row,
      specExists: Boolean(spec),
      specIssueMatches: spec ? spec.issue === row.issue : false,
      issueExists,
      issueClosed,
      prExists,
      isPr,
      prMerged,
      ok: Boolean(spec) && spec.issue === row.issue && issueSatisfied && prMerged === true,
    })
  }

  if (table.malformedRows.length > 0) return { action: 'malformed-rows', checks, malformedRows: table.malformedRows }
  const ok = checks.length > 0 && checks.every((c) => c.ok)
  return { action: ok ? 'verified' : 'divergence', checks }
}
