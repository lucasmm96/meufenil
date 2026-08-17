import { describe, expect, it } from 'vitest'
import {
  MARKER_END,
  MARKER_START,
  buildBody,
  buildProjectionBlock,
  issueTitle,
  labels,
  replaceProjectionBlock,
  specLabel,
  typeLabel,
} from './projection.js'

const spec = {
  id: 'DEBT-0001',
  type: 'DEBT',
  status: 'PROPOSED',
  title: 'Versionar objetos sem DDL versionado',
  decision: 'TBD',
  path: 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md',
  problem: 'Parte do schema não tem DDL.',
  proposed: 'Versionar os objetos.',
  acs: '- [ ] DDL versionado.',
}

describe('projection', () => {
  it('mapeia labels a partir do ID e do tipo', () => {
    expect(specLabel('DEBT-0001')).toBe('spec:DEBT-0001')
    expect(typeLabel('DEBT')).toBe('technical-debt')
    expect(typeLabel('FEAT')).toBe('feat')
    expect(typeLabel('TEST')).toBe('testing')
    expect(typeLabel('XX')).toBeNull()
    expect(labels(spec)).toEqual(['spec-driven', 'spec:DEBT-0001', 'technical-debt'])
  })

  it('gera o título [ID] Título', () => {
    expect(issueTitle(spec)).toBe('[DEBT-0001] Versionar objetos sem DDL versionado')
  })

  it('gera o corpo com bloco SPEC-PROJECTION, seções e decisão', () => {
    const body = buildBody(spec)
    expect(body).toContain(MARKER_START)
    expect(body).toContain(MARKER_END)
    expect(body).toContain('`DEBT-0001`')
    expect(body).toContain('.ai/specs/proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')
    expect(body).toContain('## Problema')
    expect(body).toContain('Parte do schema não tem DDL.')
    expect(body).toContain('## Critérios de aceitação')
    expect(body).toContain('— (aguardando decisão humana)')
    expect(body).toContain('NUNCA sobrescrito')
  })

  it('projeta a decisão escolhida quando não é TBD', () => {
    expect(buildProjectionBlock({ ...spec, decision: 'A' })).toContain('## Decisão')
    expect(buildProjectionBlock({ ...spec, decision: 'A' })).toContain('A')
  })

  it('substitui apenas o interior do bloco, preservando o conteúdo humano fora dele', () => {
    const existing = [
      '> **Spec:** `DEBT-0001`',
      '',
      `${MARKER_START} — antigo -->`,
      'conteúdo antigo',
      MARKER_END,
      '',
      '---',
      '',
      'Comentário humano preservado.',
    ].join('\n')
    const updated = replaceProjectionBlock(existing, buildBody({ ...spec, problem: 'Problema novo.' }))
    expect(updated).toContain('Problema novo.')
    expect(updated).not.toContain('conteúdo antigo')
    expect(updated).toContain('Comentário humano preservado.')
    expect(updated.indexOf(MARKER_START)).toBeGreaterThan(-1)
    expect(updated.indexOf(MARKER_END)).toBeGreaterThan(updated.indexOf(MARKER_START))
  })

  it('retorna null quando o corpo existente não tem os marcadores (divergência — não sobrescrever)', () => {
    expect(replaceProjectionBlock('corpo sem marcadores', buildBody(spec))).toBeNull()
    expect(replaceProjectionBlock(null, buildBody(spec))).toBeNull()
  })
})
