// Projeção Spec → Issue (título, labels, corpo com bloco SPEC-PROJECTION).
// Contrato: Blueprint v1.1-final §20 e .ai/specs/templates/issue-projection.md.

export const MARKER_START = '<!-- SPEC-PROJECTION:START'
export const MARKER_END = '<!-- SPEC-PROJECTION:END'

const TYPE_LABELS = {
  FEAT: 'feat',
  ENH: 'enhancement',
  REF: 'refactor',
  DEBT: 'technical-debt',
  SEC: 'security',
  TEST: 'testing',
}

export function specLabel(id) {
  return `spec:${id}`
}

export function typeLabel(type) {
  return TYPE_LABELS[type] ?? null
}

export function labels(spec) {
  const set = ['spec-driven', specLabel(spec.id)]
  const type = typeLabel(spec.type)
  if (type) set.push(type)
  return set
}

export function issueTitle(spec) {
  return `[${spec.id}] ${spec.title ?? spec.id}`
}

function sectionOrFallback(content, fallback) {
  return content ?? fallback
}

export function buildProjectionBlock(spec) {
  const decision = spec.decision && spec.decision !== 'TBD' ? spec.decision : '— (aguardando decisão humana)'
  return [
    '## Problema',
    '',
    sectionOrFallback(spec.problem, '(sem seção no arquivo)'),
    '',
    '## Estado proposto',
    '',
    sectionOrFallback(spec.proposed, '(sem seção no arquivo)'),
    '',
    '## Critérios de aceitação',
    '',
    sectionOrFallback(spec.acs, '(sem seção no arquivo)'),
    '',
    '## Decisão',
    '',
    decision,
  ].join('\n')
}

export function buildBody(spec) {
  return [
    `> **Spec:** \`${spec.id}\` · **Tipo:** ${spec.type ?? '?'} · **Arquivo:** \`.ai/specs/${spec.path}\``,
    `> **Status da Spec:** ${spec.status ?? '?'} · **Prioridade:** ver Project · **Milestone:** —`,
    '',
    `${MARKER_START} — bloco GERADO a partir da Spec. Claude atualiza esta seção; edições manuais aqui serão sobrescritas na próxima sincronização. -->`,
    buildProjectionBlock(spec),
    MARKER_END,
    '',
    '---',
    '',
    'Discussão operacional: progresso, bloqueios, aprovações e validações. (Conteúdo humano — NUNCA sobrescrito por Claude.)',
  ].join('\n')
}

/**
 * Substitui o bloco projetado no corpo existente do Issue.
 * Retorna null quando o corpo não tem os marcadores (edição manual/divergência — não sobrescrever).
 */
export function replaceProjectionBlock(existingBody, newBody) {
  if (typeof existingBody !== 'string') return null
  const startIdx = existingBody.indexOf(MARKER_START)
  const endIdx = existingBody.indexOf(MARKER_END)
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null

  const newStart = newBody.indexOf(MARKER_START)
  const newEnd = newBody.indexOf(MARKER_END)
  if (newStart === -1 || newEnd === -1) return null

  const block = newBody.slice(newStart, newEnd + MARKER_END.length)
  return existingBody.slice(0, startIdx) + block + existingBody.slice(endIdx + MARKER_END.length)
}
