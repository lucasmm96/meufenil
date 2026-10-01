import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, 'spec-locate.js')

describe('spec-locate — busca por ID exato', () => {
  it('encontra ENH-0001 com "enh1"', () => {
    const result = spawnSync('node', [SCRIPT, 'enh1'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.normalized).toBe('ENH-0001')
    expect(parsed.count).toBeGreaterThan(0)
    expect(parsed.matches[0].id).toBe('ENH-0001')
  })

  it('encontra ENH-0001 com formato canônico "ENH-0001"', () => {
    const result = spawnSync('node', [SCRIPT, 'ENH-0001'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.matches[0].id).toBe('ENH-0001')
  })

  it('encontra ENH-0001 com "--spec enh-1"', () => {
    const result = spawnSync('node', [SCRIPT, '--spec', 'enh-1'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.matches[0].id).toBe('ENH-0001')
  })

  it('cada match contém id, repoPath, area, status, title', () => {
    const result = spawnSync('node', [SCRIPT, 'enh1'], { encoding: 'utf8' })
    const parsed = JSON.parse(result.stdout)
    const m = parsed.matches[0]
    expect(m).toHaveProperty('id')
    expect(m).toHaveProperty('repoPath')
    expect(m).toHaveProperty('area')
    expect(m).toHaveProperty('status')
    expect(m).toHaveProperty('title')
  })

  it('repoPath é relativo ao repositório (começa com .ai/specs/)', () => {
    const result = spawnSync('node', [SCRIPT, 'enh1'], { encoding: 'utf8' })
    const parsed = JSON.parse(result.stdout)
    expect(parsed.matches[0].repoPath).toMatch(/^\.ai\/specs\//)
  })
})

describe('spec-locate — busca por prefixo (sem número)', () => {
  it('retorna múltiplos resultados para "ref"', () => {
    const result = spawnSync('node', [SCRIPT, 'ref'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.count).toBeGreaterThan(1)
    expect(parsed.matches.every((m) => m.id.startsWith('REF-'))).toBe(true)
  })

  it('retorna specs de todas as áreas (proposed + archive) para prefixo', () => {
    const result = spawnSync('node', [SCRIPT, 'enh'], { encoding: 'utf8' })
    const parsed = JSON.parse(result.stdout)
    const areas = [...new Set(parsed.matches.map((m) => m.area))]
    expect(areas.length).toBeGreaterThan(1)
  })

  it('normalized é o prefixo em maiúsculas quando sem número', () => {
    const result = spawnSync('node', [SCRIPT, 'sec'], { encoding: 'utf8' })
    const parsed = JSON.parse(result.stdout)
    expect(parsed.normalized).toBe('SEC')
  })
})

describe('spec-locate — error paths', () => {
  it('exit 1 e uso em stderr sem argumento', () => {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Uso:')
  })

  it('exit 1 e count 0 para spec inexistente', () => {
    const result = spawnSync('node', [SCRIPT, 'enh9999'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.count).toBe(0)
    expect(parsed.matches).toEqual([])
  })

  it('exit 1 e mensagem de erro para query inválida', () => {
    const result = spawnSync('node', [SCRIPT, '!!!'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('inválido')
  })
})
