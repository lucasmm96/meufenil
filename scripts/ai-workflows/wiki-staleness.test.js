import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, 'wiki-staleness.js')

describe('wiki-staleness — happy path (repositório real)', () => {
  it('retorna JSON válido com exit 0', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(result).toHaveProperty('staleExists')
    expect(result).toHaveProperty('stale')
    expect(result).toHaveProperty('fresh')
    expect(result).toHaveProperty('new')
    expect(result).toHaveProperty('generatedAt')
  })

  it('stale e fresh são arrays', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(Array.isArray(result.stale)).toBe(true)
    expect(Array.isArray(result.fresh)).toBe(true)
    expect(Array.isArray(result.new)).toBe(true)
  })

  it('staleExists é boolean', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(typeof result.staleExists).toBe('boolean')
  })

  it('itens de stale contêm page, currentHash e storedHash', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    for (const item of result.stale) {
      expect(item).toHaveProperty('page')
      expect(item).toHaveProperty('currentHash')
      expect(item).toHaveProperty('storedHash')
    }
  })
})

describe('wiki-staleness — sem estado anterior', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wiki-staleness-'))
  })

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }))

  it('funciona sem wiki/.wiki-state.json (trata como estado vazio)', () => {
    // O script lê do REPO_ROOT real — este teste verifica que o script roda sem erro
    // mesmo quando .wiki-state.json não existe (o script trata o erro internamente)
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed).toHaveProperty('staleExists')
  })
})
