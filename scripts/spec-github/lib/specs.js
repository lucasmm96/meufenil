// Leitura e parsing das Specs de proposed/ e archive/ (MeuFenil Spec-Driven GitHub Operations).
// Convenções: .ai/specs/CONVENTIONS.md §4, §8, §18 e templates/proposal-template.md.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'

const CATEGORIES = ['features', 'enhancements', 'refactors', 'technical-debt', 'security', 'testing']
const ARCHIVE_AREAS = ['implemented', 'rejected', 'superseded']
export const TERMINAL_STATUSES = ['IMPLEMENTED', 'REJECTED', 'SUPERSEDED']

const ID_RE = /^([A-Z]+-\d{4})-/

function extractSection(text, name) {
  const match = text.match(new RegExp(`## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n---\\s*\\n|$)`))
  if (!match) return null
  const content = match[1].trim()
  return content.length > 0 ? content : null
}

export function parseSpec(text, relPath) {
  const fileName = basename(relPath)
  const idMatch = fileName.match(ID_RE)
  const typeMatch = text.match(/^\*\*Type:\*\*\s*(\S+)/m)
  const statusMatch = text.match(/^\*\*Status:\*\*\s*(\S+)/m)
  const titleMatch = text.match(/^\*\*Title:\*\*\s*(.+)$/m)
  const issueMatch = text.match(/^\*\*Issue:\*\*\s*#?(\d+)/m)
  const decisionMatch = text.match(/## Alternatives[\s\S]*?\*\*Decision:\*\*\s*([^\n]+)/)

  if (!idMatch) return null

  return {
    id: idMatch[1],
    type: typeMatch ? typeMatch[1] : null,
    status: statusMatch ? statusMatch[1] : null,
    title: titleMatch ? titleMatch[1].trim() : null,
    issue: issueMatch ? Number(issueMatch[1]) : null,
    decision: decisionMatch ? decisionMatch[1].trim() : null,
    path: relPath,
    problem: extractSection(text, 'Problem'),
    proposed: extractSection(text, 'Proposed State'),
    acs: extractSection(text, 'Acceptance Criteria'),
  }
}

function specFilesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')
    .map((e) => join(dir, e.name))
}

/**
 * Lista todas as Specs (ativas de proposed/ e terminais de archive/).
 * @param {string} baseDir — caminho de .ai/specs
 */
export function listSpecs(baseDir) {
  const specs = []

  for (const category of CATEGORIES) {
    const proposedDir = join(baseDir, 'proposed', category)
    for (const filePath of specFilesUnder(proposedDir)) {
      const relPath = filePath.replace(/\\/g, '/').replace(baseDir.replace(/\\/g, '/') + '/', '')
      const spec = parseSpec(readFileSync(filePath, 'utf8'), relPath)
      if (spec) specs.push({ ...spec, filePath, area: 'proposed', category })
    }
  }

  for (const area of ARCHIVE_AREAS) {
    for (const category of CATEGORIES) {
      const dir = join(baseDir, 'archive', area, category)
      for (const filePath of specFilesUnder(dir)) {
        const relPath = filePath.replace(/\\/g, '/').replace(baseDir.replace(/\\/g, '/') + '/', '')
        const spec = parseSpec(readFileSync(filePath, 'utf8'), relPath)
        if (spec) specs.push({ ...spec, filePath, area: `archive/${area}`, category })
      }
    }
  }

  return specs.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Retorna o novo conteúdo do arquivo quando o campo Issue: precisa ser criado/corrigido;
 * null quando já está correto; false quando não há âncora (campo Status:) para inserir.
 */
export function backfillIssueNumber(spec, issueNumber) {
  const text = readFileSync(spec.filePath, 'utf8')
  const line = `**Issue:** #${issueNumber}`
  if (new RegExp(`^\\*\\*Issue:\\*\\*\\s*#?${issueNumber}\\s*$`, 'm').test(text)) return null

  const hasField = /^\*\*Issue:\*\*.*$/m.test(text)
  let updated
  if (hasField) {
    updated = text.replace(/^\*\*Issue:\*\*.*$/m, line)
  } else {
    const anchor = /^\*\*Status:\*\*.*$/m
    if (!anchor.test(text)) return false
    updated = text.replace(anchor, (m) => `${m}\n${line}`)
  }
  if (updated === text) return false
  return updated
}
