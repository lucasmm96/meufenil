import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIORITY,
  PRIORITY_FIELD,
  PRIORITY_OPTIONS,
  PROJECT_TITLE,
  STATUS_FIELD,
  STATUS_OPTIONS,
  projectStatus,
} from './project-mapping.js'

describe('project-mapping', () => {
  it('mapeia Spec Status → Project Status (CONVENTIONS §18.4)', () => {
    expect(projectStatus('PROPOSED')).toBe('Backlog')
    expect(projectStatus('ACCEPTED')).toBe('Aprovado')
    expect(projectStatus('IMPLEMENTATION')).toBe('Em andamento')
    expect(projectStatus('IMPLEMENTED')).toBe('Concluído')
    expect(projectStatus('REJECTED')).toBe('Encerrado')
    expect(projectStatus('SUPERSEDED')).toBe('Encerrado')
  })

  it('retorna null para estados fora do vocabulário (Bloqueado é override do Project, não da Spec)', () => {
    expect(projectStatus('BLOQUEADO')).toBeNull()
    expect(projectStatus('UNKNOWN')).toBeNull()
    expect(projectStatus(null)).toBeNull()
  })

  it('define as opções canônicas dos campos', () => {
    expect(STATUS_OPTIONS.map((o) => o.name)).toEqual([
      'Backlog',
      'Aprovado',
      'Em andamento',
      'Bloqueado',
      'Concluído',
      'Encerrado',
    ])
    expect(PRIORITY_OPTIONS.map((o) => o.name)).toEqual(['Alta', 'Média', 'Baixa'])
    expect(DEFAULT_PRIORITY).toBe('Média')
    expect(STATUS_FIELD).toBe('Status')
    expect(PRIORITY_FIELD).toBe('Priority')
    expect(PROJECT_TITLE).toBe('MeuFenil — Spec-Driven Backlog')
  })
})
