import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTraceabilityTable } from './lib/release-traceability.js'
import { checkBody } from './pre-release-check.js'

// REF-0005 — pre-release-check: verificação do corpo da Release (tabela §23).
// Garante que heading com sufixo (ex.: `## Rastreabilidade (§23)`) resulte em
// falha — o parser W6/W7 exige a forma literal `## Rastreabilidade`.

const ENTRIES = [{ spec: 'REF-0005', issue: 54, pr: 99, title: 'Heading canônico', type: 'REF' }]

const SPEC_FIXTURE = `# REF-0005 — Fixture
**Type:** REF
**Status:** PROPOSED
**Title:** Heading canônico
**Issue:** #54
**Created on:** 2026-09-03

## Problem
Fixture de teste.
`

function makeReleaseBody(heading = '## Rastreabilidade') {
  const table = buildTraceabilityTable(ENTRIES)
  return `## Release Notes\n\n${table.replace('## Rastreabilidade', heading)}\n`
}

describe('checkBody — corpo da Release (REF-0005)', () => {
  let tmpDir, specsDir, bodyPath

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pre-release-check-'))
    specsDir = join(tmpDir, 'specs')
    const specDir = join(specsDir, 'proposed', 'refactors')
    mkdirSync(specDir, { recursive: true })
    writeFileSync(join(specDir, 'REF-0005-fixture.md'), SPEC_FIXTURE)
    bodyPath = join(tmpDir, 'body.md')
  })

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }))

  it('passa com heading canônico `## Rastreabilidade`', async () => {
    writeFileSync(bodyPath, makeReleaseBody())
    const { failures } = await checkBody(bodyPath, 'corpo da Release', specsDir)
    expect(failures).toHaveLength(0)
  })

  it('falha com heading `## Rastreabilidade (§23)` — no-table', async () => {
    writeFileSync(bodyPath, makeReleaseBody('## Rastreabilidade (§23)'))
    const { failures } = await checkBody(bodyPath, 'corpo da Release', specsDir)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('corpo da Release')
    expect(failures[0]).toContain('## Rastreabilidade')
  })

  it('falha quando não há tabela de rastreabilidade', async () => {
    writeFileSync(bodyPath, '## Release Notes\n\nSomente notas, sem tabela.\n')
    const { failures } = await checkBody(bodyPath, 'corpo da Release', specsDir)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('corpo da Release')
  })

  it('falha quando Spec referenciada não existe nas fixtures', async () => {
    const table = buildTraceabilityTable([{ spec: 'FEAT-9999', issue: 1, pr: 2, title: 'Inexistente', type: 'FEAT' }])
    writeFileSync(bodyPath, `## Release Notes\n\n${table}\n`)
    const { failures } = await checkBody(bodyPath, 'corpo da Release', specsDir)
    expect(failures.some((f) => f.includes('FEAT-9999'))).toBe(true)
  })

  it('retorna os rows da tabela', async () => {
    writeFileSync(bodyPath, makeReleaseBody())
    const { rows } = await checkBody(bodyPath, 'corpo da Release', specsDir)
    expect(rows).toHaveLength(1)
    expect(rows[0].spec).toBe('REF-0005')
    expect(rows[0].issue).toBe(54)
  })

  it('usa o label no corpo do PR quando especificado', async () => {
    writeFileSync(bodyPath, '## Notas\n\nSem tabela.\n')
    const { failures } = await checkBody(bodyPath, 'corpo do PR', specsDir)
    expect(failures[0]).toContain('corpo do PR')
  })
})
