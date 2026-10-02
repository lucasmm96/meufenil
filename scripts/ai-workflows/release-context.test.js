import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(__dirname, 'release-context.js')

describe('release-context — happy path', () => {
  it('retorna JSON válido com exit 0', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(result).toHaveProperty('currentVersion')
    expect(result).toHaveProperty('lastTag')
    expect(result).toHaveProperty('commitsSinceLastTag')
    expect(result).toHaveProperty('specsInRelease')
    expect(result).toHaveProperty('proposedBump')
    expect(result).toHaveProperty('proposedVersion')
    expect(result).toHaveProperty('traceabilityRows')
    expect(result).toHaveProperty('missingIssues')
    expect(result).toHaveProperty('generatedAt')
  })

  it('currentVersion é string semver', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(result.currentVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('proposedBump é minor ou patch', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(['minor', 'patch']).toContain(result.proposedBump)
  })

  it('proposedVersion é string v-semver', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(result.proposedVersion).toMatch(/^v\d+\.\d+\.\d+$/)
  })

  it('commitsSinceLastTag é array (pode ser vazio)', () => {
    const output = execFileSync('node', [SCRIPT], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(Array.isArray(result.commitsSinceLastTag)).toBe(true)
  })

  it('aceita --since= como argumento', () => {
    const output = execFileSync('node', [SCRIPT, '--since=v1.0.0'], { encoding: 'utf8' })
    const result = JSON.parse(output)
    expect(result.lastTag).toBe('v1.0.0')
  })
})

describe('release-context — error path', () => {
  it('retorna JSON válido mesmo sem commits desde a última tag', () => {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(Array.isArray(parsed.commitsSinceLastTag)).toBe(true)
  })
})
