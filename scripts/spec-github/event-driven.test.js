import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// F6 — Event-Driven Automation (Blueprint §17/§18.1/§19). Matriz de testes da F6:
// "validação de YAML dos workflows" (estrutural — o GitHub Actions valida a sintaxe
// nativamente ao carregar o workflow) + simulação de eventos (reconcile.test.js +
// piloto manual documentado no PR).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const WORKFLOWS = [
  'spec-sync.yml',
  'issue-reconcile.yml',
  'issue-triage.yml',
  'issue-triage-claude.yml',
]

describe('workflows F6 — estrutura comum (§18.1)', () => {
  it.each(WORKFLOWS)('%s existe com on/permissions/concurrency/timeout', (name) => {
    const w = read(`.github/workflows/${name}`)
    expect(w).toMatch(/^name: /m)
    expect(w).toMatch(/^on:/m)
    expect(w).toMatch(/^permissions:/m)
    expect(w).toMatch(/^concurrency:/m)
    expect(w).toMatch(/timeout-minutes:/)
  })

  it('nenhum workflow faz push direto em development/master (§18.1)', () => {
    for (const name of WORKFLOWS) {
      const w = read(`.github/workflows/${name}`)
      expect(w).not.toMatch(/git push[^\n]*(development|master)/)
    }
  })
})

describe('W2 — spec-sync', () => {
  it('dispara em push de development com paths .ai/specs/** e permissões mínimas', () => {
    const w = read('.github/workflows/spec-sync.yml')
    expect(w).toMatch(/branches: \[development\]/)
    expect(w).toMatch(/paths: \['\.ai\/specs\/\*\*'\]/)
    expect(w).toMatch(/^permissions:\n\s+contents: read\n\s+issues: write$/m)
  })

  it('roda os scripts determinísticos; passo de Project condicional ao secret (shell)', () => {
    const w = read('.github/workflows/spec-sync.yml')
    expect(w).toMatch(/node scripts\/spec-github\/sync\.js/)
    expect(w).toMatch(/node scripts\/spec-github\/project-sync\.js/)
    expect(w).toMatch(/if \[ -n "\$GITHUB_PROJECTS_TOKEN" \]/)
    expect(w).not.toMatch(/secrets\.GITHUB_PROJECTS_TOKEN != ''/)
    expect(w).not.toMatch(/anthropics\/claude-code-action/)
  })

  it('não usa secrets em condicionais if (schema do Actions rejeita)', () => {
    for (const name of WORKFLOWS) {
      expect(read(`.github/workflows/${name}`)).not.toMatch(/^\s*if: .*secrets\./m)
    }
  })
})

describe('W4 — issue-reconcile', () => {
  it('dispara em closed/reopened e roda o reconcile.js com o evento', () => {
    const w = read('.github/workflows/issue-reconcile.yml')
    expect(w).toMatch(/types: \[closed, reopened\]/)
    expect(w).toMatch(/node scripts\/spec-github\/reconcile\.js --issue .* --action /s)
  })

  it('nunca fecha nem reabre (D-12: somente comentário de divergência)', () => {
    const w = read('.github/workflows/issue-reconcile.yml')
    expect(w).not.toMatch(/state"?:?\s*["']?(closed|open)|--state/)
  })
})

describe('W3 — issue-triage (wrapper)', () => {
  it('guarda por autor externo e por labels do fluxo (anti-loop)', () => {
    const w = read('.github/workflows/issue-triage.yml')
    expect(w).toMatch(/author_association/)
    expect(w).toMatch(/spec-created/)
    expect(w).toMatch(/duplicate/)
    expect(w).toMatch(/not-planned/)
  })

  it('despacha repository_dispatch event_type issue-triage', () => {
    const w = read('.github/workflows/issue-triage.yml')
    expect(w).toMatch(/dispatches/)
    expect(w).toMatch(/issue-triage/)
  })
})

describe('W3 — issue-triage-claude (Action)', () => {
  it('responde a repository_dispatch com o Claude Code Action e permissões de escrita', () => {
    const w = read('.github/workflows/issue-triage-claude.yml')
    expect(w).toMatch(/repository_dispatch:/)
    expect(w).toMatch(/anthropics\/claude-code-action@v1/)
    expect(w).toMatch(/id-token: write/)
    expect(w).toMatch(/contents: write/)
  })

  it('referencia o prompt fixo e restringe as ferramentas (--allowedTools, --max-turns)', () => {
    const w = read('.github/workflows/issue-triage-claude.yml')
    expect(w).toMatch(/.github\/prompts\/issue-triage\.md/)
    expect(w).toMatch(/--allowedTools/)
    expect(w).toMatch(/--max-turns/)
  })
})

describe('prompt fixo do W3 (.github/prompts/issue-triage.md)', () => {
  it('trata a Issue externa como input não confiável', () => {
    const p = read('.github/prompts/issue-triage.md')
    expect(p).toMatch(/não confiável/i)
    expect(p).toMatch(/nunca.*siga/i)
  })

  it('codifica as stop conditions do §19 (nunca implementa, nunca Decision, nunca fecha exceto duplicate)', () => {
    const p = read('.github/prompts/issue-triage.md')
    expect(p).toMatch(/nunca implementa código/i)
    expect(p).toMatch(/NUNCA decide aceitar\/rejeitar/i)
    expect(p).toMatch(/duplicate.*feche|feche.*duplicate/is)
    expect(p).toMatch(/not-planned.*não.*feche|não.*not-planned/is)
  })
})

describe('ISSUE_TEMPLATE (Blueprint §19)', () => {
  it.each(['bug_report.md', 'feature_request.md'])('%s existe com frontmatter e label triage', (name) => {
    const t = read(`.github/ISSUE_TEMPLATE/${name}`)
    expect(t).toMatch(/^---\nname: /)
    expect(t).toMatch(/description: /)
    expect(t).toMatch(/labels: \[triage/)
  })
})
