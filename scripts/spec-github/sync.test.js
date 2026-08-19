import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSync } from './sync.js'
import { GitHubClient } from './lib/github.js'
import { MARKER_START, buildBody } from './lib/projection.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'specs')

function copyFixture(tempBase, rel) {
  const dest = join(tempBase, rel)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(join(FIXTURES, rel), dest)
  return dest
}

/** Fake da GitHub API (Issues + Labels) em memória, com rastreio de chamadas. */
function createFakeApi() {
  const issues = new Map()
  const labelsSet = new Set()
  let nextNumber = 1
  const calls = []

  const respond = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data })

  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    const u = new URL(url)
    const method = init.method ?? 'GET'
    const base = '/repos/o/r'

    const labelSingle = u.pathname.match(/^\/repos\/o\/r\/labels\/([^/]+)$/)
    if (labelSingle && method === 'GET') {
      const name = decodeURIComponent(labelSingle[1])
      return labelsSet.has(name) ? respond(200, { name }) : respond(404, { message: 'Not Found' })
    }
    if (method === 'POST' && u.pathname === `${base}/labels`) {
      const body = JSON.parse(init.body)
      if (labelsSet.has(body.name)) return respond(422, { message: 'already_exists' })
      labelsSet.add(body.name)
      return respond(201, body)
    }

    if (method === 'POST' && u.pathname === `${base}/issues`) {
      const body = JSON.parse(init.body)
      const number = nextNumber++
      const issue = {
        number,
        state: 'open',
        title: body.title,
        body: body.body,
        labels: (body.labels ?? []).map((name) => ({ name })),
      }
      issues.set(number, issue)
      return respond(201, issue)
    }

    const single = u.pathname.match(/^\/repos\/o\/r\/issues\/(\d+)$/)
    if (single && method === 'GET') {
      const n = Number(single[1])
      return issues.has(n) ? respond(200, issues.get(n)) : respond(404, { message: 'Not Found' })
    }
    if (single && method === 'PATCH') {
      const n = Number(single[1])
      if (!issues.has(n)) return respond(404, { message: 'Not Found' })
      const body = JSON.parse(init.body)
      const issue = issues.get(n)
      if (body.title !== undefined) issue.title = body.title
      if (body.body !== undefined) issue.body = body.body
      return respond(200, issue)
    }

    const labelsPath = u.pathname.match(/^\/repos\/o\/r\/issues\/(\d+)\/labels$/)
    if (labelsPath && method === 'PUT') {
      const n = Number(labelsPath[1])
      const body = JSON.parse(init.body)
      issues.get(n).labels = body.labels.map((name) => ({ name }))
      return respond(200, body)
    }

    if (method === 'GET' && u.pathname === `${base}/issues`) {
      const label = u.searchParams.get('labels')
      const list = [...issues.values()].filter(
        (i) => label === null || (i.labels ?? []).some((l) => l.name === label)
      )
      return respond(200, list)
    }

    return respond(404, { message: 'Not Found' })
  }

  const seed = (issue) => {
    issues.set(issue.number, issue)
  }

  return { fetchImpl, issues, calls, labelsSet, seed }
}

function makeClient(api) {
  return new GitHubClient({ token: 'test-token', owner: 'o', repo: 'r', fetchImpl: api.fetchImpl })
}

function makeTempBase() {
  return mkdtempSync(join(tmpdir(), 'spec-github-'))
}

describe('sync Spec ↔ Issue', () => {
  let tempDirs = []

  beforeEach(() => {
    tempDirs = []
  })

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  })

  function tempBase() {
    const dir = makeTempBase()
    tempDirs.push(dir)
    return dir
  }

  it('cria a Issue para Spec sem Issue e preenche o frontmatter', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')

    const report = await runSync({ client: makeClient(api), baseDir: base })

    expect(report[0].action).toBe('create')
    expect(report[0].number).toBe(1)
    expect(report[0].backfill).toBe('backfilled')
    expect(report[0].divergences).toEqual([])
    const file = readFileSync(join(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md'), 'utf8')
    expect(file).toContain('**Issue:** #1')
    const issue = api.issues.get(1)
    expect(issue.title).toBe('[DEBT-0001] Versionar objetos sem DDL versionado')
    expect(issue.labels.map((l) => l.name).sort()).toEqual(['spec-driven', 'spec:DEBT-0001', 'technical-debt'].sort())
    expect(issue.body).toContain(MARKER_START)
  })

  it('garante a existência das labels antes de criar Issues', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')

    await runSync({ client: makeClient(api), baseDir: base })

    expect(api.labelsSet.has('spec-driven')).toBe(true)
    expect(api.labelsSet.has('spec:DEBT-0001')).toBe(true)
    expect(api.labelsSet.has('technical-debt')).toBe(true)
  })

  it('é idempotente: segunda execução não cria nem altera nada', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')

    const first = await runSync({ client: makeClient(api), baseDir: base })
    expect(first[0].action).toBe('create')

    const mutateCalls = api.calls.length
    const second = await runSync({ client: makeClient(api), baseDir: base })
    expect(second[0].action).toBe('ok')
    expect(second[0].divergences).toEqual([])
    expect(api.issues.size).toBe(1)
    const nonReads = api.calls.slice(mutateCalls).filter((c) => !c.init.method || c.init.method !== 'GET')
    expect(nonReads.length).toBe(0)
  })

  it('atualiza o bloco projetado quando a Spec muda, preservando o conteúdo humano', async () => {
    const api = createFakeApi()
    const base = tempBase()
    const file = copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')

    await runSync({ client: makeClient(api), baseDir: base })

    const issue = api.issues.get(1)
    issue.body = issue.body.replace(
      'Discussão operacional:',
      'Discussão operacional:\n\nComentário do autor sobre o problema.'
    )

    const text = readFileSync(file, 'utf8')
    writeFileSync(
      file,
      text.replace(
        'Parte do schema real não possui DDL em nenhuma migration.',
        'Problema atualizado com novo contexto.'
      )
    )

    const report = await runSync({ client: makeClient(api), baseDir: base })
    expect(report[0].action).toBe('update')
    expect(api.issues.get(1).body).toContain('Problema atualizado com novo contexto.')
    expect(api.issues.get(1).body).toContain('Comentário do autor sobre o problema.')
  })

  it('CASO 3: Issue fechada com Spec ativa → divergência reportada, nada revertido', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')

    api.seed({
      number: 5,
      state: 'closed',
      title: '[DEBT-0001] Versionar objetos sem DDL versionado',
      body: buildBody({
        id: 'DEBT-0001',
        type: 'DEBT',
        status: 'PROPOSED',
        title: 'Versionar objetos sem DDL versionado',
        decision: 'TBD',
        path: 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md',
        problem: 'Parte do schema real não possui DDL em nenhuma migration.',
        proposed: 'Versionar os objetos com migration de baseline.',
        acs: '- [ ] DDL versionado consistente com o catálogo.',
      }),
      labels: [{ name: 'spec:DEBT-0001' }, { name: 'spec-driven' }, { name: 'technical-debt' }],
    })

    const report = await runSync({ client: makeClient(api), baseDir: base })
    expect(report[0].divergences.join(' ')).toContain('CASO 3')
    expect(api.issues.get(5).state).toBe('closed')
    const issuesPath = '/repos/o/r/issues'
    const createdIssues = api.calls.filter(
      (c) => c.init.method === 'POST' && new URL(c.url).pathname === issuesPath
    )
    expect(createdIssues.length).toBe(0)
  })

  it('Spec terminal com Issue aberta → divergência reportada; sync não fecha a Issue (D-12)', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'archive/implemented/technical-debt/DEBT-0004-reconciliar-templates.md')

    const spec = {
      id: 'DEBT-0004',
      type: 'DEBT',
      status: 'IMPLEMENTED',
      title: 'Reconciliar templates e convenções do Specification System',
      decision: 'A',
      path: 'archive/implemented/technical-debt/DEBT-0004-reconciliar-templates.md',
      problem: 'Templates e convenções divergentes.',
      proposed: 'Reconciliar templates com a governança.',
      acs: '- [x] Templates alinhados.',
    }
    api.seed({
      number: 7,
      state: 'open',
      title: '[DEBT-0004] Reconciliar templates e convenções do Specification System',
      body: buildBody(spec),
      labels: [{ name: 'spec:DEBT-0004' }, { name: 'spec-driven' }, { name: 'technical-debt' }],
    })

    const report = await runSync({ client: makeClient(api), baseDir: base })
    expect(report[0].divergences.join(' ')).toContain('fechamento é ato explícito')
    expect(api.issues.get(7).state).toBe('open')
  })

  it('corpo sem marcadores → divergência; corpo NÃO é sobrescrito', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')

    api.seed({
      number: 3,
      state: 'open',
      title: '[DEBT-0001] Versionar objetos sem DDL versionado',
      body: 'Issue criado manualmente, sem bloco projetado.',
      labels: [{ name: 'spec:DEBT-0001' }, { name: 'spec-driven' }, { name: 'technical-debt' }],
    })

    const report = await runSync({ client: makeClient(api), baseDir: base })
    expect(report[0].divergences.join(' ')).toContain('sem marcadores')
    expect(api.issues.get(3).body).toBe('Issue criado manualmente, sem bloco projetado.')
  })

  it('frontmatter com número errado é corrigido para o Issue encontrado por label', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/testing/TEST-0002-suites-seguranca-policies.md')

    const spec = {
      id: 'TEST-0002',
      type: 'TEST',
      status: 'PROPOSED',
      title: 'Suítes de segurança para policies não cobertas',
      decision: 'TBD',
      path: 'proposed/testing/TEST-0002-suites-seguranca-policies.md',
      problem: 'Policies sem cobertura de teste de segurança.',
      proposed: 'Criar suítes para as policies não cobertas.',
      acs: '- [ ] Suítes criadas e verdes.',
    }
    api.seed({
      number: 8,
      state: 'open',
      title: '[TEST-0002] Suítes de segurança para policies não cobertas',
      body: buildBody(spec),
      labels: [{ name: 'spec:TEST-0002' }, { name: 'spec-driven' }, { name: 'testing' }],
    })

    const report = await runSync({ client: makeClient(api), baseDir: base })
    const entry = report.find((e) => e.id === 'TEST-0002')
    expect(entry.divergences.join(' ')).toContain('não existe no GitHub')
    expect(entry.backfill).toBe('backfilled')
    const file = readFileSync(join(base, 'proposed/testing/TEST-0002-suites-seguranca-policies.md'), 'utf8')
    expect(file).toContain('**Issue:** #8')
    expect(file).not.toContain('**Issue:** #42')
  })

  it('dry-run sem token: pré-visual local, sem chamadas de API e sem escrita', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')

    const report = await runSync({ token: null, client: null, baseDir: base, dryRun: true })
    expect(report[0].action).toContain('local-preview')
    expect(api.calls.length).toBe(0)
    const file = readFileSync(join(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md'), 'utf8')
    expect(file).not.toContain('**Issue:**')
  })

  it('aceita base-dir com fixtures parciais sem quebrar (arquivos não-spec são ignorados)', async () => {
    const api = createFakeApi()
    const base = tempBase()
    copyFixture(base, 'proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md')
    writeFileSync(join(base, 'proposed', 'index.md'), '# Catálogo\n')
    const report = await runSync({ client: makeClient(api), baseDir: base })
    expect(report.map((e) => e.id)).toEqual(['DEBT-0001'])
  })
})
