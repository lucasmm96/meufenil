// Mapeamento Spec Status → Project Status e opções dos campos do Project.
// Contrato: Blueprint v1.1-final §10.2 e CONVENTIONS §18.4.

export const STATUS_OPTIONS = [
  { name: 'Backlog', color: 'GRAY', description: 'Proposta aguardando decisão' },
  { name: 'Aprovado', color: 'BLUE', description: 'Decisão humana registrada na Spec' },
  { name: 'Em andamento', color: 'YELLOW', description: 'Em implementação (work branch)' },
  { name: 'Bloqueado', color: 'RED', description: 'Override operacional — razão no Issue' },
  { name: 'Concluído', color: 'GREEN', description: 'Implementado e validado' },
  { name: 'Encerrado', color: 'PURPLE', description: 'Estado terminal (REJECTED/SUPERSEDED)' },
]

/** Opções do campo Status que o GitHub pré-cria em Projects v2 novos. */
export const DEFAULT_STATUS_OPTIONS = ['Todo', 'In Progress', 'Done']

export const PRIORITY_OPTIONS = [
  { name: 'Alta', color: 'RED', description: 'Prioridade alta' },
  { name: 'Média', color: 'YELLOW', description: 'Prioridade média' },
  { name: 'Baixa', color: 'GRAY', description: 'Prioridade baixa' },
]

export const DEFAULT_PRIORITY = 'Média'

export const PROJECT_TITLE = 'MeuFenil — Spec-Driven Backlog'
export const STATUS_FIELD = 'Status'
export const PRIORITY_FIELD = 'Priority'
export const KANBAN_VIEW_NAME = 'Kanban'

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
