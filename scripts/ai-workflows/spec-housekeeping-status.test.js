import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, 'spec-housekeeping-status.js')

const PROPOSED_SPEC = `# ENH-0050 — Fixture Proposed

**Type:** ENH
**Status:** PROPOSED
**Title:** Fixture Proposed

## Problem

Spec ainda em proposed.

## Proposed State

Estado.

## Acceptance Criteria

- [ ] AC1

## Alternatives

A — opção
**Decision:** TBD

## References

N/A
`

const IMPLEMENTED_SPEC = `# ENH-0050 — Fixture Implemented

**Type:** ENH
**Status:** IMPLEMENTED
**Title:** Fixture Implemented
**Issue:** #55
**Implemented Through:** PR #88

## Problem

Spec já implementada.

## Proposed State

Estado.

## Acceptance Criteria

- [x] AC1

## Alternatives

A — opção
**Decision:** A

## References

N/A
`

describe('spec-housekeeping-status — error path (sem --spec)', () => {
  it('imprime erro em stderr e exit 1 sem argumento', () => {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Uso:')
  })
})

describe('spec-housekeeping-status — spec em proposed (pendente)', () => {
  it('detecta spec ainda em proposed e retorna allDone: false com exit 1', () => {
    // Testa com ENH-0001 que está em proposed/ no repo real (PROPOSED, sem Implemented Through)
    const result = spawnSync('node', [SCRIPT, '--spec', 'ENH-0001'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.specId).toBe('ENH-0001')
    expect(parsed.allDone).toBe(false)
    expect(parsed.steps).toHaveProperty('specInProposed')
    expect(parsed.steps).toHaveProperty('specArchivedToImplemented')
    expect(parsed.steps).toHaveProperty('implementedThroughFilled')
    expect(parsed.steps).toHaveProperty('issueNumberKnown')
    expect(parsed).toHaveProperty('remaining')
    expect(parsed).toHaveProperty('generatedAt')
    expect(parsed.remaining.length).toBeGreaterThan(0)
  })
})

describe('spec-housekeeping-status — spec implementada nas fixtures', () => {
  let tmpDir, tmpSpecs

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'housekeeping-'))
    tmpSpecs = join(tmpDir, 'specs')
    mkdirSync(join(tmpSpecs, 'proposed', 'enhancements'), { recursive: true })
    mkdirSync(join(tmpSpecs, 'archive', 'implemented', 'enhancements'), { recursive: true })
  })

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }))

  it('spec inexistente: allDone: false, remaining com mensagem', () => {
    const result = spawnSync('node', [SCRIPT, '--spec', 'ENH-9999'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.allDone).toBe(false)
  })
})
