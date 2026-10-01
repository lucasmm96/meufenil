import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, 'spec-index-check.js')
const FIXTURES = join(__dirname, '__fixtures__', 'specs')

// Helper: invoca o script apontando SPECS_DIR para as fixtures via monkey-patch de args.
// Como o script usa SPECS_DIR hardcoded, testamos a função run() exportada indiretamente
// injetando um specsDir via variável de ambiente customizada.
// Alternativa: importar e testar as funções internas — usamos importação direta.

import { listSpecs } from '../spec-github/lib/specs.js'

// Testa a lógica de nextId isoladamente reutilizando listSpecs nas fixtures.
describe('spec-index-check — lógica de nextIds', () => {
  it('calcula próximo ID de ENH corretamente com fixtures', () => {
    const specs = listSpecs(FIXTURES)
    const enhIds = specs
      .filter((s) => s.id.startsWith('ENH-'))
      .map((s) => parseInt(s.id.split('-')[1], 10))
    const max = Math.max(...enhIds)
    const next = `ENH-${String(max + 1).padStart(4, '0')}`
    expect(next).toBe('ENH-0003')
  })

  it('inclui specs de archive/implemented na contagem de IDs', () => {
    const specs = listSpecs(FIXTURES)
    const ids = specs.map((s) => s.id)
    expect(ids).toContain('ENH-0002')
    expect(ids).toContain('ENH-0001')
    expect(ids).toContain('FEAT-0001')
  })

  it('distingue area proposed vs archive/implemented', () => {
    const specs = listSpecs(FIXTURES)
    expect(specs.find((s) => s.id === 'ENH-0001')?.area).toBe('proposed')
    expect(specs.find((s) => s.id === 'ENH-0002')?.area).toBe('archive/implemented')
  })
})

describe('spec-index-check — script CLI (happy path)', () => {
  it('retorna JSON válido com exit 0 no repositório real', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(result).toHaveProperty('nextIds')
    expect(result).toHaveProperty('consistency')
    expect(result).toHaveProperty('activeCounts')
    expect(result).toHaveProperty('generatedAt')
    expect(Object.keys(result.nextIds)).toContain('ENH')
    expect(Object.keys(result.nextIds)).toContain('FEAT')
  })

  it('nextIds contém todas as 6 categorias', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(Object.keys(result.nextIds)).toEqual(
      expect.arrayContaining(['FEAT', 'ENH', 'REF', 'DEBT', 'SEC', 'TEST'])
    )
  })

  it('consistency.ok é boolean', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(typeof result.consistency.ok).toBe('boolean')
  })
})
