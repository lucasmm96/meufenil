import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTraceabilityTable } from './lib/release-traceability.js'
import {
  buildGateComment,
  docsDiffOk,
  docsRequirement,
  GATE_COMMENT_MARKER,
  gitChangedFiles,
  postGateFailure,
  resolveLastTag,
  runReleaseGate,
  clearGateFailure,
} from './release-gate.js'

// W7 — release-gate (Blueprint v1.1-final §18.1; ADR-0013): GATE determinístico
// de produção — nenhuma feature vai a master sem Spec e documentação. Roda em
// pull_request com base master (PR de release): rastreabilidade §23 íntegra
// (Spec existe, frontmatter Issue: bate, Issue existe, PR merged — Issue PODE
// estar aberta no pré-merge, requireIssueClosed: false) + docs: FEAT/ENH exige
// diff em wiki/ vs última release publicada. Determinístico, sem IA.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const FEAT_SPEC = `# FEAT-0002 — Fixture
**Type:** FEAT
**Status:** IMPLEMENTED
**Title:** Exportar histórico CSV
**Issue:** #31
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

// Pré-merge (W7): a Issue da Spec pode estar ABERTA; PR merged é obrigatório.
const GATE_ISSUES = {
  26: { state: 'closed' },
  31: { state: 'open' },
  28: { state: 'closed', pull_request: { merged_at: '2026-08-18T12:00:00Z' } },
  29: { state: 'closed', pull_request: { merged_at: '2026-08-18T12:00:00Z' } },
}

/** Fake REST com captura de chamadas (mesmo padrão do release-traceability.test.js). */
function createFakeRest({ issues = {}, comments = {} } = {}) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body })
    if (String(url).includes('/comments?per_page')) {
      const n = Number(String(url).match(/\/issues\/(\d+)\/comments/)[1])
      return { status: 200, ok: true, json: async () => comments[n] ?? [] }
    }
    if (init.method === 'POST' && String(url).endsWith('/comments')) {
      return { status: 201, ok: true, json: async () => ({ id: 99, body: JSON.parse(init.body).body }) }
    }
    if (init.method === 'PATCH' && /\/issues\/comments\/\d+$/.test(String(url))) {
      const id = Number(String(url).match(/\/comments\/(\d+)$/)[1])
      return { status: 200, ok: true, json: async () => ({ id, body: JSON.parse(init.body).body }) }
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
  return {
    token,
    rest: {
      getIssue: (n) => get(`/repos/o/r/issues/${n}`),
      listComments: (n) => get(`/repos/o/r/issues/${n}/comments?per_page=100`),
      addComment: (n, body) =>
        fakeRest.fetchImpl(`https://api.github.com/repos/o/r/issues/${n}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        }),
      updateComment: (id, body) =>
        fakeRest.fetchImpl(`https://api.github.com/repos/o/r/issues/comments/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ body }),
        }),
    },
  }
}

/** Git injetado: tags versionadas + diff de wiki/. */
function makeRun({ tags = ['v1.9.1', 'v1.9.0', 'v1.8.0'], wikiDiff = [] } = {}) {
  const calls = []
  const run = (cmd, argv) => {
    calls.push({ cmd, argv })
    if (argv[0] === 'tag') return tags.join('\n')
    if (argv[0] === 'diff') return wikiDiff.join('\n')
    return ''
  }
  return { run, calls }
}

describe('docsRequirement (FEAT/ENH → docs exigida)', () => {
  it('qualquer linha FEAT ou ENH exige documentação', () => {
    expect(docsRequirement([{ type: 'FEAT' }])).toBe(true)
    expect(docsRequirement([{ type: 'ENH' }])).toBe(true)
    expect(docsRequirement([{ type: 'DEBT' }, { type: 'FEAT' }])).toBe(true)
  })

  it('release sem FEAT/ENH (DEBT/REF/SEC/TEST) não exige documentação', () => {
    for (const type of ['DEBT', 'REF', 'SEC', 'TEST']) {
      expect(docsRequirement([{ type }])).toBe(false)
    }
    expect(docsRequirement([])).toBe(false)
  })
})

describe('docsDiffOk', () => {
  it('exigida com pelo menos 1 arquivo de wiki/ → ok', () => {
    expect(docsDiffOk({ required: true, changedFiles: ['wiki/Home.md'] })).toBe(true)
  })

  it('exigida sem nenhum arquivo → falha', () => {
    expect(docsDiffOk({ required: true, changedFiles: [] })).toBe(false)
  })

  it('não exigida → ok sempre (independe do diff)', () => {
    expect(docsDiffOk({ required: false, changedFiles: [] })).toBe(true)
    expect(docsDiffOk({ required: false, changedFiles: ['wiki/Home.md'] })).toBe(true)
  })
})

describe('resolveLastTag (tags MISTAS annotated/lightweight)', () => {
  it('retorna a primeira tag do sort por versão decrescente', () => {
    const { run, calls } = makeRun()
    expect(resolveLastTag(run)).toBe('v1.9.1')
    expect(calls[0].argv).toEqual(['tag', '--merged', 'HEAD', '--sort=-version:refname'])
  })

  it('sem nenhuma tag ancestral → null (base do diff indisponível)', () => {
    expect(resolveLastTag(() => '')).toBeNull()
  })
})

describe('gitChangedFiles (diff vs última tag)', () => {
  it('lista arquivos de wiki/ alterados entre a última tag e HEAD', () => {
    const { run, calls } = makeRun({ wikiDiff: ['wiki/Home.md', 'wiki/Funcionalidades.md'] })
    expect(gitChangedFiles(run, { lastTag: 'v1.9.1' })).toEqual(['wiki/Home.md', 'wiki/Funcionalidades.md'])
    expect(calls[0].argv).toEqual(['diff', '--name-only', 'v1.9.1...HEAD', '--', 'wiki'])
  })

  it('sem mudanças → [] (docs exigida → falha)', () => {
    expect(gitChangedFiles(() => '', { lastTag: 'v1.9.1' })).toEqual([])
  })
})

describe('buildGateComment', () => {
  it('bullet por Spec em divergência (mesma semântica do logChecks do W6)', () => {
    const trace = {
      action: 'divergence',
      checks: [
        {
          row: { spec: 'FEAT-0002', issue: 31, pr: 29 },
          specExists: true,
          specIssueMatches: true,
          issueExists: true,
          prExists: true,
          isPr: true,
          prMerged: false,
          ok: false,
        },
      ],
    }
    const comment = buildGateComment({ trace, docs: null })
    expect(comment).toContain(GATE_COMMENT_MARKER)
    expect(comment).toContain('PR #29 não merged')
  })

  it('no-table → orienta o formato da tabela §23', () => {
    const comment = buildGateComment({ trace: { action: 'no-table', checks: [] }, docs: null })
    expect(comment).toContain('tabela de rastreabilidade §23')
    expect(comment).toContain('| Spec | Issue | PR | Título | Tipo |')
  })

  it('malformed-rows → conta as linhas ignoradas', () => {
    const comment = buildGateComment({
      trace: { action: 'malformed-rows', checks: [], malformedRows: ['| FEAT-0002 | #31 | | sem PR | FEAT |'] },
      docs: null,
    })
    expect(comment).toContain('1 linha(s) ignoradas')
  })

  it('docs exigida sem diff → menciona a tag base do diff', () => {
    const comment = buildGateComment({
      trace: { action: 'verified', checks: [] },
      docs: { required: true, lastTag: 'v1.9.1', changedFiles: [], ok: false },
    })
    expect(comment).toContain('sem mudanças em `wiki/`')
    expect(comment).toContain('v1.9.1')
  })

  it('sem tag base → mensagem própria', () => {
    const comment = buildGateComment({
      trace: { action: 'verified', checks: [] },
      docs: { required: true, lastTag: null, changedFiles: [], ok: false },
    })
    expect(comment).toContain('Nenhuma tag de release anterior')
  })
})

describe('runReleaseGate (W7)', () => {
  let tempDirs = []

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
    tempDirs = []
  })

  function tempBase() {
    const dir = mkdtempSync(join(tmpdir(), 'release-gate-'))
    tempDirs.push(dir)
    mkdirSync(join(dir, 'archive', 'implemented', 'features'), { recursive: true })
    mkdirSync(join(dir, 'archive', 'implemented', 'technical-debt'), { recursive: true })
    writeFileSync(join(dir, 'archive', 'implemented', 'features', 'FEAT-0002-fixture.md'), FEAT_SPEC)
    writeFileSync(join(dir, 'archive', 'implemented', 'technical-debt', 'DEBT-0005-fixture.md'), DEBT_SPEC)
    return dir
  }

  async function runWith({ entries = ENTRIES, issues = GATE_ISSUES, run, body } = {}) {
    const fakeRest = createFakeRest({ issues })
    const { rest } = makeClient(fakeRest)
    const result = await runReleaseGate({
      body: body ?? buildTraceabilityTable(entries),
      baseDir: tempBase(),
      rest,
      run: run ?? makeRun().run,
    })
    return { result, fakeRest }
  }

  it('release só com REF/DEBT (sem FEAT/ENH) passa sem exigir docs', async () => {
    const { result, fakeRest } = await runWith({ entries: [ENTRIES[0]], run: makeRun({ wikiDiff: [] }).run })
    expect(result.pass).toBe(true)
    expect(result.docs.required).toBe(false)
    expect(result.docs.ok).toBe(true)
    expect(result.comment).toBeNull()
    expect(fakeRest.calls.filter((c) => c.method !== 'GET')).toHaveLength(0)
  })

  it('FEAT + diff em wiki/ → passa (Issue aberta no pré-merge é aceita)', async () => {
    const { result } = await runWith({ run: makeRun({ wikiDiff: ['wiki/Funcionalidades.md'] }).run })
    expect(result.pass).toBe(true)
    expect(result.docs.required).toBe(true)
    expect(result.docs.changedFiles).toEqual(['wiki/Funcionalidades.md'])
  })

  it('FEAT sem diff em wiki/ → falha com mensagem de docs (AC4)', async () => {
    const { result, fakeRest } = await runWith({ run: makeRun({ wikiDiff: [] }).run })
    expect(result.pass).toBe(false)
    expect(result.docs.ok).toBe(false)
    expect(result.comment).toContain('sem mudanças em `wiki/`')
    expect(fakeRest.calls.filter((c) => c.method !== 'GET')).toHaveLength(0)
  })

  it('sem a tabela §23 → falha sem avaliar docs (no-table)', async () => {
    const { result } = await runWith({ body: '# Só notas, sem tabela' })
    expect(result.pass).toBe(false)
    expect(result.trace.action).toBe('no-table')
    expect(result.docs).toBeNull()
    expect(result.comment).toContain('tabela de rastreabilidade §23')
  })

  it('linha malformada → falha (malformed-rows, nunca assume)', async () => {
    const body = `## Rastreabilidade
| Spec | Issue | PR | Título | Tipo |
|------|-------|-----|--------|------|
| FEAT-0002 | #31 | | sem PR | FEAT |
`
    const { result } = await runWith({ body })
    expect(result.pass).toBe(false)
    expect(result.trace.action).toBe('malformed-rows')
    expect(result.comment).toContain('malformadas')
  })

  it('sem tag de release anterior → falha (base do diff indisponível)', async () => {
    const { result } = await runWith({ run: makeRun({ tags: [] }).run })
    expect(result.pass).toBe(false)
    expect(result.docs.lastTag).toBeNull()
    expect(result.comment).toContain('Nenhuma tag de release anterior')
  })

  it('PR não merged → falha na rastreabilidade (AC5: quebrada sempre falha)', async () => {
    const issues = { ...GATE_ISSUES, 29: { state: 'closed', pull_request: { merged_at: null } } }
    const { result } = await runWith({ issues })
    expect(result.pass).toBe(false)
    expect(result.trace.action).toBe('divergence')
    expect(result.comment).toContain('PR #29 não merged')
  })

  it('Spec inexistente → falha com bullet da Spec', async () => {
    const { result } = await runWith({ entries: [{ spec: 'FEAT-9999', issue: 31, pr: 29, title: 'X', type: 'FEAT' }] })
    expect(result.pass).toBe(false)
    expect(result.comment).toContain('Spec FEAT-9999 não encontrada')
  })

  it('sem transporte (rest null) → decide pela rastreabilidade local apenas', async () => {
    const result = await runReleaseGate({
      body: buildTraceabilityTable([ENTRIES[0]]),
      baseDir: tempBase(),
      rest: null,
      run: makeRun().run,
    })
    expect(result.pass).toBe(false)
    expect(result.trace.action).toBe('divergence')
  })
})

describe('postGateFailure (comentário com marker de dedup no PR)', () => {
  it('posto quando não existe comentário do gate (1 POST)', async () => {
    const fakeRest = createFakeRest({ issues: GATE_ISSUES })
    const { rest } = makeClient(fakeRest)
    const posted = await postGateFailure({ pr: 45, comment: 'msg', rest })
    expect(posted.action).toBe('posted')
    expect(fakeRest.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('atualizado in-place quando o marker já existe (PATCH, sem POST duplicado)', async () => {
    const fakeRest = createFakeRest({
      issues: GATE_ISSUES,
      comments: { 45: [{ id: 7, body: `${GATE_COMMENT_MARKER}\nfalha anterior` }] },
    })
    const { rest } = makeClient(fakeRest)
    const posted = await postGateFailure({ pr: 45, comment: 'nova falha', rest })
    expect(posted.action).toBe('updated')
    expect(posted.id).toBe(7)
    const patch = fakeRest.calls.find((c) => c.method === 'PATCH' && c.url.includes('/issues/comments/7'))
    expect(patch).toBeTruthy()
    expect(fakeRest.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })
})

describe('clearGateFailure (AC1 — comentário deletado quando o gate passa)', () => {
  it('deleta o comentário de falha via updateComment com corpo vazio (PATCH)', async () => {
    const fakeRest = createFakeRest({
      issues: GATE_ISSUES,
      comments: { 45: [{ id: 7, body: `${GATE_COMMENT_MARKER}\nfalha anterior` }] },
    })
    const { rest } = makeClient(fakeRest)

    const cleared = await clearGateFailure({ pr: 45, rest })
    expect(cleared.action).toBe('deleted')
    expect(cleared.id).toBe(7)
    const patch = fakeRest.calls.find((c) => c.method === 'PATCH' && c.url.includes('/issues/comments/7'))
    expect(patch).toBeTruthy()
    expect(JSON.parse(patch.body).body).toBe('')
    expect(fakeRest.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('sem comentário de falha → not-found, sem chamadas de escrita', async () => {
    const fakeRest = createFakeRest({ issues: GATE_ISSUES, comments: {} })
    const { rest } = makeClient(fakeRest)

    const cleared = await clearGateFailure({ pr: 45, rest })
    expect(cleared.action).toBe('not-found')
    expect(fakeRest.calls.filter((c) => c.method !== 'GET')).toHaveLength(0)
  })
})

describe('W7 — release-gate.yml (§18.1/ADR-0013)', () => {
  it('dispara em pull_request com base master e permissões mínimas (pull-requests: write, contents: read)', () => {
    const w = read('.github/workflows/release-gate.yml')
    expect(w).toMatch(/^on:\n\s+pull_request:\n\s+types: \[opened, synchronize, reopened, edited\]/m)
    expect(w).toMatch(/branches: \[master\]/)
    expect(w).toMatch(/^permissions:\n\s+contents: read\n\s+pull-requests: write$/m)
    expect(w).toMatch(/^concurrency:/m)
    expect(w).toMatch(/timeout-minutes:/)
  })

  it('types inclui edited — a tabela §23 vive no corpo do PR (corrigir reavalia)', () => {
    const w = read('.github/workflows/release-gate.yml')
    expect(w).toMatch(/types: \[opened, synchronize, reopened, edited\]/)
  })

  it('checkout com fetch-depth: 0 (tags necessárias para o diff de docs)', () => {
    const w = read('.github/workflows/release-gate.yml')
    expect(w).toMatch(/actions\/checkout@v4/)
    expect(w).toMatch(/fetch-depth: 0/)
  })

  it('roda o release-gate.js com o corpo do PR e o número', () => {
    const w = read('.github/workflows/release-gate.yml')
    expect(w).toMatch(/jq -r \.pull_request\.body/)
    expect(w).toMatch(/node scripts\/spec-github\/release-gate\.js --body-file \/tmp\/release-gate-body\.md --pr /)
  })

  it('sem IA: não referencia claude, ANTHROPIC_API_KEY nem repository_dispatch', () => {
    const w = read('.github/workflows/release-gate.yml')
    expect(w).not.toMatch(/claude|ANTHROPIC|repository_dispatch|dispatches/i)
  })

  it('não usa secrets em condicionais if (schema do Actions rejeita)', () => {
    expect(read('.github/workflows/release-gate.yml')).not.toMatch(/^\s*if: .*secrets\./m)
  })

  it('nunca faz push, nunca cria tag (D-7: tag/publicação são humanas)', () => {
    const w = read('.github/workflows/release-gate.yml')
    expect(w).not.toMatch(/git push|git tag/)
  })
})
