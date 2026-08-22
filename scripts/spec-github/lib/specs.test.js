import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { backfillIssueNumber, listSpecs, parseSpec } from './specs.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '__fixtures__', 'specs')

const SAMPLE = `# DEBT-0001 — Versionar objetos sem DDL versionado

**Type:** DEBT
**Status:** PROPOSED
**Title:** Versionar objetos sem DDL versionado

## Problem

Parte do schema não tem DDL.

## Proposed State

Versionar os objetos.

## Acceptance Criteria

- [ ] DDL versionado.

## Alternatives

A — migration de baseline · B — status quo
**Decision:** TBD

## References

N/A
`

const MULTILINE = [
  '# ENH-0003 — Histórico das execuções com seletor e paginação numerada',
  '',
  '**Type:** ENH',
  '**Status:** PROPOSED',
  '**Title:** Histórico das execuções com seletor de tamanho de página e paginação numerada',
  '',
  '## Problem',
  '',
  'No painel administrativo, a lista "Histórico das execuções" carrega 20 itens por página.',
  '',
  '## Proposed State',
  '',
  '- **Seletor de tamanho de página (3 / 10 / 20)** com default 3.',
  '- **Paginação numerada** (números com elisão) além de Anterior/Próxima.',
  '- Troca de filtro reseta para a página 1.',
  '- Nenhuma mudança em banco, RLS, RPC ou backend.',
  '',
  '## Acceptance Criteria',
  '',
  '- [ ] AC1: seletor de page size com opções 3/10/20; default 3.',
  '- [ ] AC2: a lista exibe no máximo N execuções do conjunto filtrado.',
  '- [ ] AC3: paginação numerada com elisão + Anterior/Próxima.',
  '- [ ] AC4: trocar filtro/page size reseta para a página 1.',
  '- [ ] AC5: nenhuma mudança em banco/RLS/RPC/backend.',
  '- [ ] AC6: testes atualizados e novos com suíte verde.',
  '- [ ] AC7: comportamento responsivo mantido (mobile e desktop).',
  '',
  '## Alternatives',
  '',
  'A — reduzir default · B — paginação numerada · C — botão "Ver mais" · D — seletor',
  '**Decision:** TBD',
  '',
  '## References',
  '',
  'N/A',
].join(String.fromCharCode(10))


describe('specs', () => {
  it('extrai header e seções de uma Spec', () => {
    const spec = parseSpec(SAMPLE, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')
    expect(spec.id).toBe('DEBT-0001')
    expect(spec.type).toBe('DEBT')
    expect(spec.status).toBe('PROPOSED')
    expect(spec.title).toBe('Versionar objetos sem DDL versionado')
    expect(spec.issue).toBeNull()
    expect(spec.decision).toBe('TBD')
    expect(spec.problem).toContain('Parte do schema não tem DDL.')
    expect(spec.proposed).toContain('Versionar os objetos.')
    expect(spec.acs).toContain('- [ ] DDL versionado.')
  })

  it('lista Specs de proposed/ e archive/ ordenadas por ID', () => {
    const specs = listSpecs(FIXTURES)
    expect(specs.map((s) => s.id)).toEqual(['DEBT-0001', 'DEBT-0004', 'TEST-0002'])
    expect(specs.find((s) => s.id === 'DEBT-0001').area).toBe('proposed')
    expect(specs.find((s) => s.id === 'DEBT-0004').area).toBe('archive/implemented')
    expect(specs.find((s) => s.id === 'TEST-0002').issue).toBe(42)
  })

  it('backfill: insere o campo Issue após Status', () => {
    const spec = parseSpec(SAMPLE, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')
    spec.filePath = join(FIXTURES, 'proposed', 'technical-debt', 'DEBT-0001-ddl-nao-versionado.md')
    const updated = backfillIssueNumber(spec, 12)
    expect(updated).toContain('**Issue:** #12')
    expect(updated.indexOf('**Issue:** #12')).toBeGreaterThan(updated.indexOf('**Status:** PROPOSED'))
  })

  it('backfill: null quando o número já está correto', () => {
    const file42 = join(FIXTURES, 'proposed', 'testing', 'TEST-0002-suites-seguranca-policies.md')
    expect(backfillIssueNumber({ filePath: file42 }, 42)).toBeNull()
  })

  it('backfill: corrige número divergente', () => {
    const file42 = join(FIXTURES, 'proposed', 'testing', 'TEST-0002-suites-seguranca-policies.md')
    const spec = listSpecs(FIXTURES).find((s) => s.id === 'TEST-0002')
    const updated = backfillIssueNumber(spec, 8)
    expect(updated).toContain('**Issue:** #8')
    expect(updated).not.toContain('#42')
    void file42
  })

  it('extrai seções multi-linha por completo (ACs e Proposed State)', () => {
    const spec = parseSpec(MULTILINE, 'proposed/enhancements/ENH-0003-historico-execucoes-seletor-paginacao.md')
    expect(spec.problem).toContain('carrega 20 itens por página')
    expect(spec.proposed.match(/^- /gm)).toHaveLength(4)
    expect(spec.proposed).toContain('- **Paginação numerada**')
    expect(spec.proposed).toContain('- Nenhuma mudança em banco')
    expect(spec.acs.match(/AC[0-9]/g)).toHaveLength(7)
    expect(spec.acs).toContain('- [ ] AC7:')
  })
})
