import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Conformidade dos agentes Claude da F4 (Blueprint §15; CONVENTIONS §18.5/linha 289):
// arquivos em .claude/agents/ com frontmatter completo, fronteira humana embutida,
// boundaries e as regras transversais §15.0.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const AGENTS_DIR = join(ROOT, '.claude', 'agents')

const F4_AGENTS = ['spec-manager', 'github-manager', 'project-manager']
const OWNERS = { 'spec-manager': 'Spec', 'github-manager': 'Issue', 'project-manager': 'Project' }

function readAgent(name) {
  return readFileSync(join(AGENTS_DIR, `${name}.md`), 'utf8')
}

describe('agentes da F4 (.claude/agents/)', () => {
  it.each(F4_AGENTS)('%s existe com frontmatter completo (name/description/tools)', (name) => {
    const content = readAgent(name)
    expect(content).toMatch(/^---\nname: [a-z-]+/)
    expect(content).toMatch(/description: .+/)
    expect(content).toMatch(/tools: .+/)
  })

  it.each(F4_AGENTS)('%s declara fronteira humana e boundaries', (name) => {
    const content = readAgent(name)
    expect(content).toMatch(/fronteira humana/i)
    expect(content).toMatch(/stop conditions/i)
    expect(content).toMatch(/^## Não/m)
  })

  it('§15.0: agentes não chamam agentes', () => {
    for (const name of F4_AGENTS) {
      expect(readAgent(name)).toMatch(/agentes NÃO chamam agentes/i)
    }
  })

  it('§15.0: um dono por artefato — cada agente declara o próprio e os alheios', () => {
    for (const [name, artifact] of Object.entries(OWNERS)) {
      const content = readAgent(name)
      expect(content).toMatch(new RegExp(`dono do artefato ${artifact}`, 'i'))
      for (const other of Object.values(OWNERS)) {
        if (other !== artifact) {
          expect(content).toMatch(new RegExp(other, 'i'))
        }
      }
    }
  })

  it('release-notes integrado às regras transversais §15.0', () => {
    expect(readAgent('release-notes')).toMatch(/Regras transversais \(Blueprint §15\.0\)/)
  })
})
