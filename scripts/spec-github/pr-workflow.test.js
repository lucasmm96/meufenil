import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// F5 — PR Workflow (Blueprint §11): template de PR (§11.2), CI W1 (§18.1) e
// agentes pr-manager/test-manager (§15.4/§15.6). Matriz de testes da F5:
// "template de PR; reconciliação de fechamento sem merge".

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

describe('template de PR (§11.2)', () => {
  it('existe com os campos obrigatórios', () => {
    const t = read('.github/pull_request_template.md')
    expect(t).toMatch(/^\*\*Spec:\*\* /m)
    expect(t).toMatch(/\*\*Issue:\*\* Part of #N/m)
    expect(t).toMatch(/Related to #N/m)
    expect(t).toMatch(/NUNCA "Closes #N" em Issue canônica/m)
    expect(t).toMatch(/\*\*Tipo:\*\* FEAT\|ENH\|REF\|DEBT\|SEC\|TEST/m)
    expect(t).toMatch(/\*\*Autorização:\*\* Decision aprovada/m)
  })

  it('checklist cobre ACs, Current Specs, testes e mudança HIGH', () => {
    const t = read('.github/pull_request_template.md')
    expect(t).toMatch(/- \[ \] ACs validadas com evidência/m)
    expect(t).toMatch(/- \[ \] Current Specs sincronizadas/m)
    expect(t).toMatch(/- \[ \] Testes:/m)
    expect(t).toMatch(/- \[ \] Sem mudança HIGH sem autorização explícita/m)
    expect(t).toMatch(/- \[ \] Merge: aguardando aprovação humana/m)
  })
})

describe('CI W1 (.github/workflows/ci.yml)', () => {
  it('existe, roda lint (escopado até DEBT-0005)/testes/build e usa permissões mínimas', () => {
    const w = read('.github/workflows/ci.yml')
    expect(w).toMatch(/^permissions:\n\s+contents: read$/m)
    expect(w).toMatch(/npx eslint scripts\/spec-github/)
    expect(w).toMatch(/DEBT-0005/)
    expect(w).toMatch(/npm run test:run/)
    expect(w).toMatch(/npm run build/)
  })

  it('o escopo do lint está ligado à DEBT-0005 (restaurar npm run lint completo)', () => {
    const debt = read('.ai/specs/proposed/technical-debt/DEBT-0005-lint-src-pendencias-eslint.md')
    expect(debt).toMatch(/restaurar o passo `npm run lint` completo no W1/i)
    expect(debt).toMatch(/W1 executa `npm run lint` completo novamente/i)
  })

  it('é sem IA: não referencia ANTHROPIC_API_KEY nem Claude Code Action', () => {
    const w = read('.github/workflows/ci.yml')
    expect(w).not.toMatch(/ANTHROPIC_API_KEY|claude/i)
  })

  it('usa concurrency por grupo', () => {
    expect(read('.github/workflows/ci.yml')).toMatch(/^concurrency:/m)
  })
})

describe('pr-manager (§15.4)', () => {
  it('declara reconciliação de fechamento sem merge (Project Aprovado + comentário)', () => {
    const a = read('.claude/agents/pr-manager.md')
    expect(a).toMatch(/sem merge.+Project.+Aprovado.+(comentário|comentario)/is)
  })

  it('declara merged → housekeeping e as boundaries de merge/aprovação/push', () => {
    const a = read('.claude/agents/pr-manager.md')
    expect(a).toMatch(/merged.+housekeeping/is)
    expect(a).toMatch(/nunca aprova o próprio PR/i)
    expect(a).toMatch(/não faz merge sem aprovação humana explícita/i)
    expect(a).toMatch(/push.+autorização explícita/is)
    expect(a).toMatch(/NUNCA .Closes #N. em Issue canônica/s)
  })
})

describe('test-manager (§15.6)', () => {
  it('executa as suítes canônicas e nunca altera testes para "passar"', () => {
    const a = read('.claude/agents/test-manager.md')
    expect(a).toMatch(/npm run test:run/)
    expect(a).toMatch(/npm run lint/)
    expect(a).toMatch(/npm run build/)
    expect(a).toMatch(/nunca altera testes existentes para "passar"/i)
  })

  it('nunca commita nem faz merge', () => {
    const a = read('.claude/agents/test-manager.md')
    expect(a).toMatch(/não commita nem faz merge/i)
  })
})

describe('agentes da F5 — conformidade estrutural', () => {
  it.each(['pr-manager', 'test-manager'])('%s tem frontmatter completo e fronteira humana', (name) => {
    const a = read(`.claude/agents/${name}.md`)
    expect(a).toMatch(/^---\nname: [a-z-]+/)
    expect(a).toMatch(/description: .+/)
    expect(a).toMatch(/tools: .+/)
    expect(a).toMatch(/fronteira humana/i)
    expect(a).toMatch(/stop conditions/i)
    expect(a).toMatch(/^## Não/m)
    expect(a).toMatch(/agentes NÃO chamam agentes/i)
  })
})
