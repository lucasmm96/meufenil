import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTraceabilityTable, parseTraceabilityTable } from './lib/release-traceability.js'
import { closeMilestone, milestoneMatchesTag, runReleaseVerify, verifyTraceability } from './release-verify.js'

// F7 — Release Traceability (Blueprint §12/§23/§15.5/§18.1; CONVENTIONS §18.9).
// Matriz de testes da F7 (§29): "geração da tabela de rastreabilidade a partir
// de dados fictícios" + verificação do W6 + conformidade do agente release-manager,
// da subordinação do release-notes (§15.7) e do workflow release-verify.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const SPEC = (issue) => `# FEAT-0002 — Fixture
**Type:** FEAT
**Status:** IMPLEMENTED
**Title:** Exportar histórico CSV
**Issue:** #${issue}
**Created on:** 2026-08-17

## Problem
Fixture.
`

const DEBT_SPEC = `# DEBT-0005 — Fixture
**Type:** DEBT
**Status:** IMPLEMENTED
**Title:** Dívida de lint
**Issue:** #26
**Created on:** 2026-08-17

## Problem
Fixture.
`

const ENTRIES = [
  { spec: 'DEBT-0005', issue: 26, pr: 28, title: 'Dívida de lint', type: 'DEBT' },
  { spec: 'FEAT-0002', issue: 31, pr: 29, title: 'Exportar histórico CSV', type: 'FEAT' },
]

const RELEASE_BODY = `## Release Notes — MeuFenil v1.8.0

Seções por categoria no padrão histórico.

${buildTraceabilityTable(ENTRIES)}
`

/** Fake REST com captura de chamadas (mesmo padrão do reconcile.test.js). */
function createFakeRest({ issues = {}, comments = {}, milestones = [] }) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET' })
    if (String(url).includes('/milestones?state=open')) {
      return { status: 200, ok: true, json: async () => milestones }
    }
    if (init.method === 'PATCH' && /\/milestones\/\d+$/.test(String(url))) {
      return { status: 200, ok: true, json: async () => ({ state: JSON.parse(init.body).state }) }
    }
    if (String(url).includes('/comments?per_page')) {
      const n = Number(String(url).match(/\/issues\/(\d+)\/comments/)[1])
      return { status: 200, ok: true, json: async () => comments[n] ?? [] }
    }
    if (init.method === 'POST' && String(url).endsWith('/comments')) {
      const n = Number(String(url).match(/\/issues\/(\d+)\/comments/)[1])
      return { status: 201, ok: true, json: async () => ({ id: 1, body: JSON.parse(init.body).body }) }
    }
    const m = String(url).match(/\/issues\/(\d+)$/)
    if (m) {
      const n = Number(m[1])
      if (!(n in issues)) return { status: 404, ok: false, json: async () => ({ message: 'Not Found' }) }
      return { status: 200, ok: true, json: async () => issues[n] }
    }
    throw new Error(`URL não esperada: ${url}`)
  }
  return { calls, fetchImpl }
}

function makeClient(fakeRest) {
  const token = 'test-token'
  const get = (url) => fakeRest.fetchImpl(`https://api.github.com${url}`).then((r) => (r.status === 404 ? null : r.json()))
  const rest = {
    getIssue: (n) => get(`/repos/o/r/issues/${n}`),
    listComments: (n) => get(`/repos/o/r/issues/${n}/comments?per_page=100`),
    addComment: (n, body) =>
      fakeRest.fetchImpl(`https://api.github.com/repos/o/r/issues/${n}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    listMilestones: () => get('/repos/o/r/milestones?state=open&per_page=100'),
    updateMilestone: (n, state) =>
      fakeRest.fetchImpl(`https://api.github.com/repos/o/r/milestones/${n}`, {
        method: 'PATCH',
        body: JSON.stringify({ state }),
      }),
  }
  return { token, rest }
}

const VERIFIED_ISSUES = {
  26: { state: 'closed' },
  31: { state: 'closed' },
  28: { state: 'closed', pull_request: { merged_at: '2026-08-18T12:00:00Z' } },
  29: { state: 'closed', pull_request: { merged_at: '2026-08-18T12:00:00Z' } },
}

describe('buildTraceabilityTable (§23 — dados fictícios)', () => {
  it('gera o cabeçalho canônico e as linhas com #N', () => {
    const table = buildTraceabilityTable(ENTRIES)
    expect(table).toBe(
      '## Rastreabilidade\n' +
        '| Spec | Issue | PR | Título | Tipo |\n' +
        '|------|-------|-----|--------|------|\n' +
        '| DEBT-0005 | #26 | #28 | Dívida de lint | DEBT |\n' +
        '| FEAT-0002 | #31 | #29 | Exportar histórico CSV | FEAT |'
    )
  })

  it('ordena por Spec ID', () => {
    const table = buildTraceabilityTable([ENTRIES[0], ENTRIES[1]])
    expect(table.indexOf('DEBT-0005')).toBeLessThan(table.indexOf('FEAT-0002'))
  })

  it('round-trip: parse(build(entries)) recupera os mesmos itens', () => {
    const parsed = parseTraceabilityTable(buildTraceabilityTable(ENTRIES))
    expect(parsed.rows).toEqual(ENTRIES)
    expect(parsed.malformedRows).toEqual([])
  })
})

describe('parseTraceabilityTable', () => {
  it('retorna null quando a seção ## Rastreabilidade não existe', () => {
    expect(parseTraceabilityTable('# Só notas, sem tabela')).toBeNull()
  })

  it('ignora cabeçalho e separador; preserva a ordem das linhas', () => {
    const parsed = parseTraceabilityTable(RELEASE_BODY)
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toMatchObject({ spec: 'DEBT-0005', issue: 26, pr: 28, type: 'DEBT' })
  })

  it('tolera links markdown nas células ([#31](url))', () => {
    const body = `## Rastreabilidade
| Spec | Issue | PR | Título | Tipo |
|------|-------|-----|--------|------|
| FEAT-0002 | [#31](https://github.com/lucasmm96/meufenil/issues/31) | [#29](https://github.com/lucasmm96/meufenil/pull/29) | Exportar histórico CSV | FEAT |
`
    expect(parseTraceabilityTable(body).rows[0]).toMatchObject({ issue: 31, pr: 29 })
  })

  it('tolera finais de linha CRLF (bodies do GitHub)', () => {
    const parsed = parseTraceabilityTable(RELEASE_BODY.replace(/\n/g, '\r\n'))
    expect(parsed.rows).toHaveLength(2)
  })

  it('reporta linha malformada em malformedRows (nunca assume)', () => {
    const body = `## Rastreabilidade
| Spec | Issue | PR | Título | Tipo |
|------|-------|-----|--------|------|
| FEAT-0002 | #31 | | sem PR | FEAT |
`
    const parsed = parseTraceabilityTable(body)
    expect(parsed.rows).toEqual([])
    expect(parsed.malformedRows).toHaveLength(1)
  })
})

describe('milestoneMatchesTag (§24 — milestone = versão)', () => {
  it('normaliza o prefixo v', () => {
    expect(milestoneMatchesTag('v1.8.0', '1.8.0')).toBe(true)
    expect(milestoneMatchesTag('1.8.0', 'v1.8.0')).toBe(true)
    expect(milestoneMatchesTag('v1.8.0', 'v1.8.0')).toBe(true)
  })

  it('rejeita versões diferentes', () => {
    expect(milestoneMatchesTag('v1.8.0', 'v1.9.0')).toBe(false)
  })
})

describe('verifyTraceability (W6)', () => {
  let tempDirs = []

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
    tempDirs = []
  })

  function tempBase() {
    const dir = mkdtempSync(join(tmpdir(), 'release-verify-'))
    tempDirs.push(dir)
    mkdirSync(join(dir, 'archive', 'implemented', 'features'), { recursive: true })
    mkdirSync(join(dir, 'archive', 'implemented', 'technical-debt'), { recursive: true })
    writeFileSync(join(dir, 'archive', 'implemented', 'features', 'FEAT-0002-fixture.md'), SPEC(31))
    writeFileSync(join(dir, 'archive', 'implemented', 'technical-debt', 'DEBT-0005-fixture.md'), DEBT_SPEC)
    return dir
  }

  async function verifyWith(issues, base, body = RELEASE_BODY) {
    const fakeRest = createFakeRest({ issues })
    const { rest } = makeClient(fakeRest)
    const result = await verifyTraceability({ body, baseDir: base, rest })
    return { result, fakeRest }
  }

  it('release inteira verificada → verified, sem transporte de escrita', async () => {
    const { result, fakeRest } = await verifyWith(VERIFIED_ISSUES, tempBase())
    expect(result.action).toBe('verified')
    expect(result.checks.every((c) => c.ok)).toBe(true)
    expect(fakeRest.calls.filter((c) => c.method !== 'GET').length).toBe(0)
  })

  it('Issue aberto → divergence', async () => {
    const { result } = await verifyWith({ ...VERIFIED_ISSUES, 31: { state: 'open' } }, tempBase())
    expect(result.action).toBe('divergence')
    const check = result.checks.find((c) => c.row.spec === 'FEAT-0002')
    expect(check).toMatchObject({ issueClosed: false, ok: false })
  })

  it('PR não merged (merged_at null) → divergence', async () => {
    const { result } = await verifyWith(
      { ...VERIFIED_ISSUES, 29: { state: 'closed', pull_request: { merged_at: null } } },
      tempBase()
    )
    expect(result.action).toBe('divergence')
    const check = result.checks.find((c) => c.row.spec === 'FEAT-0002')
    expect(check).toMatchObject({ prMerged: false, ok: false })
  })

  it('PR inexistente → divergence', async () => {
    const issues = { ...VERIFIED_ISSUES }
    delete issues[29]
    const { result } = await verifyWith(issues, tempBase())
    expect(result.action).toBe('divergence')
    const check = result.checks.find((c) => c.row.spec === 'FEAT-0002')
    expect(check).toMatchObject({ prExists: false, isPr: null })
  })

  it('frontmatter Issue: da Spec não bate com a linha → divergence', async () => {
    const base = tempBase()
    const { result } = await verifyWith(VERIFIED_ISSUES, base, buildTraceabilityTable([{ ...ENTRIES[1], issue: 99 }]))
    expect(result.action).toBe('divergence')
    expect(result.checks[0]).toMatchObject({ specExists: true, specIssueMatches: false })
  })

  it('Spec ausente do repositório → divergence', async () => {
    const { result } = await verifyWith(
      VERIFIED_ISSUES,
      tempBase(),
      buildTraceabilityTable([{ spec: 'FEAT-9999', issue: 31, pr: 29, title: 'Inexistente', type: 'FEAT' }])
    )
    expect(result.action).toBe('divergence')
    expect(result.checks[0]).toMatchObject({ specExists: false })
  })

  it('sem a tabela §23 → no-table (Failure Mode #20)', async () => {
    const { result } = await verifyWith(VERIFIED_ISSUES, tempBase(), '# Só notas, sem tabela')
    expect(result.action).toBe('no-table')
    expect(result.checks).toEqual([])
  })

  it('linhas malformadas → malformed-rows', async () => {
    const body = `## Rastreabilidade
| Spec | Issue | PR | Título | Tipo |
|------|-------|-----|--------|------|
| FEAT-0002 | #31 | | sem PR | FEAT |
`
    const { result } = await verifyWith(VERIFIED_ISSUES, tempBase(), body)
    expect(result.action).toBe('malformed-rows')
    expect(result.malformedRows).toHaveLength(1)
  })

  it('sem transporte (rest null) → checks parciais e divergence', async () => {
    const result = await verifyTraceability({ body: RELEASE_BODY, baseDir: tempBase(), rest: null })
    expect(result.action).toBe('divergence')
    expect(result.checks[0]).toMatchObject({ issueExists: false, issueClosed: null })
  })
})

describe('runReleaseVerify (comentários + milestone)', () => {
  let tempDirs = []

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
    tempDirs = []
  })

  function tempBase() {
    const dir = mkdtempSync(join(tmpdir(), 'release-verify-run-'))
    tempDirs.push(dir)
    mkdirSync(join(dir, 'archive', 'implemented', 'features'), { recursive: true })
    mkdirSync(join(dir, 'archive', 'implemented', 'technical-debt'), { recursive: true })
    writeFileSync(join(dir, 'archive', 'implemented', 'features', 'FEAT-0002-fixture.md'), SPEC(31))
    writeFileSync(join(dir, 'archive', 'implemented', 'technical-debt', 'DEBT-0005-fixture.md'), DEBT_SPEC)
    return dir
  }

  it('verified → comenta cada Issue canônico e fecha o milestone da tag', async () => {
    const fakeRest = createFakeRest({
      issues: VERIFIED_ISSUES,
      milestones: [{ number: 7, title: 'v1.8.0' }],
    })
    const { rest } = makeClient(fakeRest)

    const result = await runReleaseVerify({ tag: 'v1.8.0', body: RELEASE_BODY, baseDir: tempBase(), rest })

    expect(result.action).toBe('verified')
    expect(result.milestone).toEqual({ closed: 'v1.8.0' })
    const posts = fakeRest.calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(fakeRest.calls.some((c) => c.method === 'PATCH' && c.url.includes('/milestones/7'))).toBe(true)
  })

  it('não repete comentário quando o marker da tag já existe (idempotente)', async () => {
    const fakeRest = createFakeRest({
      issues: VERIFIED_ISSUES,
      comments: { 26: [{ body: '<!-- sync:release-verify:v1.8.0 -->\nanterior' }] },
      milestones: [{ number: 7, title: 'v1.8.0' }],
    })
    const { rest } = makeClient(fakeRest)

    await runReleaseVerify({ tag: 'v1.8.0', body: RELEASE_BODY, baseDir: tempBase(), rest })

    expect(fakeRest.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('divergence → nenhum comentário, nenhum milestone alterado', async () => {
    const fakeRest = createFakeRest({
      issues: { ...VERIFIED_ISSUES, 31: { state: 'open' } },
      milestones: [{ number: 7, title: 'v1.8.0' }],
    })
    const { rest } = makeClient(fakeRest)

    const result = await runReleaseVerify({ tag: 'v1.8.0', body: RELEASE_BODY, baseDir: tempBase(), rest })

    expect(result.action).toBe('divergence')
    expect(fakeRest.calls.filter((c) => c.method !== 'GET')).toHaveLength(0)
  })

  it('milestone ausente ou ambíguo → nada fechado (nota, sem PATCH)', async () => {
    const none = createFakeRest({ issues: VERIFIED_ISSUES, milestones: [] })
    expect(await closeMilestone({ tag: 'v1.8.0', rest: makeClient(none).rest })).toHaveProperty('note')

    const ambiguous = createFakeRest({
      issues: VERIFIED_ISSUES,
      milestones: [
        { number: 7, title: 'v1.8.0' },
        { number: 8, title: '1.8.0' },
      ],
    })
    const rest = makeClient(ambiguous).rest
    await closeMilestone({ tag: 'v1.8.0', rest })
    expect(ambiguous.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('dry-run → sem comentários e sem milestone', async () => {
    const fakeRest = createFakeRest({ issues: VERIFIED_ISSUES, milestones: [{ number: 7, title: 'v1.8.0' }] })
    const { rest } = makeClient(fakeRest)

    const result = await runReleaseVerify({ tag: 'v1.8.0', body: RELEASE_BODY, baseDir: tempBase(), rest, dryRun: true })

    expect(result.action).toBe('verified')
    expect(fakeRest.calls.filter((c) => c.method !== 'GET')).toHaveLength(0)
  })
})

describe('agente release-manager (§15.5)', () => {
  it('existe com frontmatter completo (name/description/tools)', () => {
    const a = read('.claude/agents/release-manager.md')
    expect(a).toMatch(/^---\nname: release-manager/)
    expect(a).toMatch(/description: .+/)
    expect(a).toMatch(/tools: .+/)
  })

  it('declara fronteira humana, stop conditions e boundaries §15.5', () => {
    const a = read('.claude/agents/release-manager.md')
    expect(a).toMatch(/fronteira humana/i)
    expect(a).toMatch(/stop conditions/i)
    expect(a).toMatch(/^## Não/m)
    expect(a).toMatch(/não publica release/i)
    expect(a).toMatch(/não cria tag/i)
    expect(a).toMatch(/não decide versão/i)
    expect(a).toMatch(/não reescreve histórico/i)
  })

  it('§15.0: agentes não chamam agentes — release-notes é invocado via orquestrador', () => {
    const a = read('.claude/agents/release-manager.md')
    expect(a).toMatch(/agentes NÃO chamam agentes/i)
    expect(a).toMatch(/release-notes.*orquestrador|orquestrador.*release-notes/is)
  })

  it('referencia a tabela §23 com o formato canônico', () => {
    const a = read('.claude/agents/release-manager.md')
    expect(a).toMatch(/\| Spec \| Issue \| PR \| Título \| Tipo \|/)
  })
})

describe('release-notes (§15.7 — subordinação)', () => {
  it('a description indica a subordinação ao release-manager', () => {
    const description = read('.claude/agents/release-notes.md').match(/^description: (.+)$/m)[1]
    expect(description).toMatch(/subordinado ao release-manager/i)
    expect(description).toMatch(/§15\.5\/§15\.7/)
  })
})

describe('W6 — release-verify.yml (§18.1)', () => {
  it('dispara em release.published com permissões mínimas (issues: write, contents: read)', () => {
    const w = read('.github/workflows/release-verify.yml')
    expect(w).toMatch(/^on:\n\s+release:\n\s+types: \[published\]/m)
    expect(w).toMatch(/^permissions:\n\s+contents: read\n\s+issues: write$/m)
    expect(w).toMatch(/^concurrency:/m)
    expect(w).toMatch(/timeout-minutes:/)
  })

  it('roda o release-verify.js com a tag e o corpo extraídos do evento', () => {
    const w = read('.github/workflows/release-verify.yml')
    expect(w).toMatch(/jq -r \.release\.body/)
    expect(w).toMatch(/node scripts\/spec-github\/release-verify\.js --tag "\$\{\{ github\.event\.release\.tag_name \}\}" --body-file \/tmp\/release-body\.md/)
  })

  it('não usa secrets em condicionais if (schema do Actions rejeita)', () => {
    expect(read('.github/workflows/release-verify.yml')).not.toMatch(/^\s*if: .*secrets\./m)
  })

  it('nunca faz push, nunca cria tag (D-7: tag/publicação são humanas)', () => {
    const w = read('.github/workflows/release-verify.yml')
    expect(w).not.toMatch(/git push|git tag/)
  })
})
