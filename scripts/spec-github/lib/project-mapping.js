// Mapeamento Spec Status → Project Status e opções dos campos do Project.
// Contrato: Blueprint v1.1-final §10.2 e CONVENTIONS §18.4.

export const STATUS_OPTIONS = [
  { name: 'Backlog', color: 'GRAY' },
  { name: 'Aprovado', color: 'BLUE' },
  { name: 'Em andamento', color: 'YELLOW' },
  { name: 'Bloqueado', color: 'RED' },
  { name: 'Concluído', color: 'GREEN' },
  { name: 'Encerrado', color: 'PURPLE' },
]

export const PRIORITY_OPTIONS = [
  { name: 'Alta', color: 'RED' },
  { name: 'Média', color: 'YELLOW' },
  { name: 'Baixa', color: 'GRAY' },
]

export const DEFAULT_PRIORITY = 'Média'

export const PROJECT_TITLE = 'MeuFenil — Spec-Driven Backlog'
export const STATUS_FIELD = 'Status'
export const PRIORITY_FIELD = 'Priority'

/** Spec Status → Project Status (null = fora do mapeamento). */
export function projectStatus(specStatus) {
  switch (specStatus) {
    case 'PROPOSED':
      return 'Backlog'
    case 'ACCEPTED':
      return 'Aprovado'
    case 'IMPLEMENTATION':
      return 'Em andamento'
    case 'IMPLEMENTED':
      return 'Concluído'
    case 'REJECTED':
    case 'SUPERSEDED':
      return 'Encerrado'
    default:
      return null
  }
}
