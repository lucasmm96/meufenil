// Geração e parsing da tabela de rastreabilidade de release (Blueprint v1.1-final §23;
// CONVENTIONS §18.9): o corpo da Release inclui, além das notas, a tabela
// `| Spec | Issue | PR | Título | Tipo |`. Números `#N` auto-linkam no GitHub
// (Issues e PRs compartilham numeração). Funções puras — o release-manager usa a
// geração no modo interativo; o W6 (release-verify) usa o parsing na verificação.

const TABLE_HEADER = '| Spec | Issue | PR | Título | Tipo |'
const TABLE_SEPARATOR = '|------|-------|-----|--------|------|'

/** Célula separadora de Markdown (`|---|---|`). */
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()))
}

/** Extrai o número de células como `#31`, `31` ou `[#31](https://github.com/...)`. */
function parseNumber(cell) {
  const match = cell.trim().match(/\d+/)
  return match ? Number(match[0]) : null
}

/**
 * Gera a tabela §23 a partir dos itens da release.
 * @param {{spec: string, issue: number, pr: number, title: string, type: string}[]} entries
 */
export function buildTraceabilityTable(entries) {
  const rows = [...entries]
    .sort((a, b) => a.spec.localeCompare(b.spec))
    .map((e) => `| ${e.spec} | #${e.issue} | #${e.pr} | ${e.title} | ${e.type} |`)
  return ['## Rastreabilidade', TABLE_HEADER, TABLE_SEPARATOR, ...rows].join('\n')
}

/**
 * Faz o parsing da tabela §23 do corpo da Release. Retorna null quando a seção
 * `## Rastreabilidade` não existe; senão `{ rows, malformedRows }` (linhas com
 * células faltando são reportadas, nunca assumidas). A seção termina no próximo
 * heading (`## …`) ou no fim do corpo.
 */
export function parseTraceabilityTable(body) {
  if (typeof body !== 'string') return null
  const heading = body.match(/(?:^|\n)## Rastreabilidade[^\S\r\n]*(?:\r?\n|$)/)
  if (!heading) return null

  const rest = body.slice(heading.index + heading[0].length)
  const nextHeading = rest.search(/\n## |\n---\s*\n/)
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading)

  const rows = []
  const malformedRows = []
  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('|')) continue
    const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim())
    if (cells[0] === 'Spec' || isSeparatorRow(cells)) continue

    const spec = cells[0] || null
    const issue = parseNumber(cells[1] ?? '')
    const pr = parseNumber(cells[2] ?? '')
    const title = cells.slice(3, -1).join(' | ').trim() || null
    const type = cells[cells.length - 1] || null
    if (spec && issue !== null && pr !== null && title && type) {
      rows.push({ spec, issue, pr, title, type })
    } else {
      malformedRows.push(line)
    }
  }
  return { rows, malformedRows }
}
