import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runProjectSync } from './project-sync.js'
import { GitHubClient } from './lib/github.js'
import { GraphQLClient } from './lib/graphql.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'specs')

function copyFixture(tempBase, rel) {
  const dest = join(tempBase, rel)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(join(FIXTURES, rel), dest)
  return dest
}

/** Fake GraphQL (Projects v2) com estado em memória. */
function createFakeGql() {
  const state = { projects: [], fields: [], items: [], views: [], calls: [] }
  const json = (payload) => ({ ok: true, json: async () => payload })

  const transport = async (endpoint, init) => {
    const { query, variables } = JSON.parse(init.body)
    state.calls.push({ query, variables })

    if (query.includes('projectsV2(first: 50)')) {
      return json({ data: { viewer: { id: 'U_1', login: 'lucasmm96', projectsV2: { nodes: state.projects } } } })
    }
    if (query.includes('createProjectV2Field')) {
      const field = {
        id: `F_${variables.input.name}`,
        name: variables.input.name,
        options: (variables.input.singleSelectOptions ?? []).map((o, i) => ({ id: `O_${o.name}_${i}`, name: o.name })),
      }
      state.fields.push(field)
      return json({ data: { createProjectV2Field: { projectV2Field: field } } })
    }
    if (query.includes('updateProjectV2Field')) {
      const field = state.fields.find((f) => f.id === variables.input.fieldId)
      field.name = variables.input.name
      field.options = (variables.input.singleSelectOptions ?? []).map((o, i) => ({ id: `O_${o.name}_${i}`, name: o.name }))
      return json({ data: { updateProjectV2Field: { projectV2Field: field } } })
    }
    if (query.includes('createProjectV2View')) {
      const view = { id: 'PVTV_1', name: variables.input.name, layout: variables.input.layout, groupBy: { nodes: [] } }
      state.views.push(view)
      return json({ data: { createProjectV2View: { projectV2View: view } } })
    }
    if (query.includes('createProjectV2')) {
      const project = { id: 'PVT_1', number: 1, title: variables.input.title }
      state.projects.push(project)
      return json({ data: { createProjectV2: { projectV2: project } } })
    }
    if (query.includes('repository(owner')) {
      return json({ data: { repository: { id: 'R_1' } } })
    }
    if (query.includes('linkProjectV2ToRepository')) {
      return json({ data: { linkProjectV2ToRepository: { repository: { name: 'meufenil' } } } })
    }
    if (query.includes('fields(first: 50)')) {
      return json({ data: { node: { fields: { nodes: state.fields } } } })
    }
    if (query.includes('fieldValueByName')) {
      return json({ data: { node: { items: { nodes: state.items } } } })
    }
    if (query.includes('views(first: 20)')) {
      return json({ data: { node: { views: { nodes: state.views } } } })
    }
    if (query.includes('updateProjectV2View')) {
      const view = state.views.find((v) => v.id === variables.input.viewId)
      view.name = variables.input.name
      view.layout = variables.input.layout
      return json({ data: { updateProjectV2View: { projectV2View: view } } })
    }
    if (query.includes('addProjectV2ItemById')) {
      const item = {
        id: `PVTI_${variables.input.contentId}`,
        content: { id: variables.input.contentId, number: null },
        status: null,
        priority: null,
      }
      state.items.push(item)
      return json({ data: { addProjectV2ItemById: { item } } })
    }
    if (query.includes('updateProjectV2ItemFieldValue')) {
      const item = state.items.find((i) => i.id === variables.input.itemId)
      const field = state.fields.find((f) => f.id === variables.input.fieldId)
      const option = field.options.find((o) => o.id === variables.input.value.singleSelectOptionId)
      if (field.name === 'Status') item.status = { name: option.name, optionId: option.id }
      else item.priority = { name: option.name, optionId: option.id }
      return json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: item.id } } } })
    }
    throw new Error(`query não reconhecida: ${query.slice(0, 60)}`)
  }

  return { state, transport }
}

/** Fake REST que devolve node_id por número de Issue. */
function createFakeRest(nodeIds) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push({ url: String(url) })
    const number = Number(new URL(url).pathname.split('/').pop())
    if (nodeIds[number]) {
      return { status: 200, ok: true, json: async () => ({ number, node_id: nodeIds[number] }) }
    }
    return { status: 404, ok: false, json: async () => ({ message: 'Not Found' }) }
  }
  return { calls, fetchImpl }
}

function makeClient(gqlApi, nodeIds) {
  const rest = new GitHubClient({
    token: 'test-token',
    owner: 'o',
    repo: 'r',
    fetchImpl: createFakeRest(nodeIds).fetchImpl,
  })
  const gql = new GraphQLClient({ token: 'test-token', fetchImpl: gqlApi.transport })
  return { rest, gql }
}

describe('project-sync', () => {
  let tempDirs = []

  beforeEach(() => {
    tempDirs = []
  })

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  })

  function tempBase() {
    const dir = mkdtempSync(join(tmpdir(), 'project-sync-'))
    tempDirs.push(dir)
    return dir
  }

  const NODE_IDS = { 42: 'N_42', 7: 'N_7' }

  function seedFixtures(base) {
    copyFixture(base, 'proposed/testing/TEST-0002-suites-seguranca-policies.md')
    copyFixture(base, 'archive/implemented/technical-debt/DEBT-0004-reconciliar-templates.md')
  }

  it('cria Project, campos, items e aplica Status/Priority derivados', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)

    const report = await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    expect(gqlApi.state.projects.length).toBe(1)
    expect(gqlApi.state.projects[0].title).toBe('MeuFenil — Spec-Driven Backlog')
    expect(gqlApi.state.fields.map((f) => f.name).sort()).toEqual(['Priority', 'Status'])
    expect(gqlApi.state.items.length).toBe(2)

    const testItem = gqlApi.state.items.find((i) => i.content.id === 'N_42')
    const debtItem = gqlApi.state.items.find((i) => i.content.id === 'N_7')
    expect(testItem.status.name).toBe('Backlog')
    expect(testItem.priority.name).toBe('Média')
    expect(debtItem.status.name).toBe('Concluído')
    expect(debtItem.priority.name).toBe('Média')

    const actions = report.map((e) => e.action)
    expect(actions.some((a) => a.includes('item-added'))).toBe(true)
  })

  /** Project novo como o GitHub entrega: campo Status padrão (Todo/In Progress/Done). */
  function seedGitHubDefaultStatus(gqlApi) {
    gqlApi.state.projects.push({ id: 'PVT_1', number: 1, title: 'MeuFenil — Spec-Driven Backlog' })
    gqlApi.state.fields.push({
      id: 'F_Status',
      name: 'Status',
      options: [
        { id: 'O_Todo', name: 'Todo' },
        { id: 'O_IP', name: 'In Progress' },
        { id: 'O_Done', name: 'Done' },
      ],
    })
  }

  it('substitui o Status padrão do GitHub pelo Status custom do Blueprint §10.2', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)
    seedGitHubDefaultStatus(gqlApi)

    await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    const updates = gqlApi.state.calls.filter((c) => c.query.includes('updateProjectV2Field'))
    expect(updates.length).toBe(1)
    expect(gqlApi.state.calls.filter((c) => c.query.includes('createProjectV2(')).length).toBe(0)
    const statusField = gqlApi.state.fields.find((f) => f.name === 'Status')
    expect(statusField.options.map((o) => o.name)).toEqual([
      'Backlog',
      'Aprovado',
      'Em andamento',
      'Bloqueado',
      'Concluído',
      'Encerrado',
    ])
    const testItem = gqlApi.state.items.find((i) => i.content.id === 'N_42')
    expect(testItem.status.name).toBe('Backlog')
  })

  it('não deleta o Status padrão quando há item usando o campo', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)
    seedGitHubDefaultStatus(gqlApi)
    gqlApi.state.items.push({
      id: 'PVTI_N_42',
      content: { id: 'N_42', number: 42 },
      status: { name: 'Todo', optionId: 'O_Todo' },
      priority: null,
    })

    const report = await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    const updates = gqlApi.state.calls.filter((c) => c.query.includes('updateProjectV2Field'))
    expect(updates.length).toBe(0)
    const entry = report.find((e) => e.id === 'TEST-0002')
    expect(entry.divergences.join(' ')).toContain('ausente no campo Status')
  })

  it('não altera Status com opções personalizadas por humano', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)
    gqlApi.state.projects.push({ id: 'PVT_1', number: 1, title: 'MeuFenil — Spec-Driven Backlog' })
    gqlApi.state.fields.push({
      id: 'F_Status',
      name: 'Status',
      options: [{ id: 'O_Custom', name: 'Custom' }],
    })

    const report = await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    const updates = gqlApi.state.calls.filter((c) => c.query.includes('updateProjectV2Field'))
    expect(updates.length).toBe(0)
    const entry = report.find((e) => e.id === 'TEST-0002')
    expect(entry.divergences.join(' ')).toContain('ausente no campo Status')
  })

  it('atualiza a view padrão TABLE para Kanban BOARD', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)
    gqlApi.state.projects.push({ id: 'PVT_1', number: 1, title: 'MeuFenil — Spec-Driven Backlog' })
    gqlApi.state.views.push({ id: 'PVTV_1', name: 'View 1', layout: 'TABLE_LAYOUT', groupBy: { nodes: [] } })

    await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    const updates = gqlApi.state.calls.filter((c) => c.query.includes('updateProjectV2View'))
    expect(updates.length).toBe(1)
    expect(gqlApi.state.views[0]).toMatchObject({ name: 'Kanban', layout: 'BOARD_LAYOUT' })
  })

  it('cria view Kanban quando o Project não tem views', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)
    gqlApi.state.projects.push({ id: 'PVT_1', number: 1, title: 'MeuFenil — Spec-Driven Backlog' })

    await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    const creates = gqlApi.state.calls.filter((c) => c.query.includes('createProjectV2View'))
    expect(creates.length).toBe(1)
    expect(gqlApi.state.views[0]).toMatchObject({ name: 'Kanban', layout: 'BOARD_LAYOUT' })
  })

  it('não altera view Kanban já configurada com groupBy Status', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)
    gqlApi.state.projects.push({ id: 'PVT_1', number: 1, title: 'MeuFenil — Spec-Driven Backlog' })
    gqlApi.state.views.push({
      id: 'PVTV_1',
      name: 'Kanban',
      layout: 'BOARD_LAYOUT',
      groupBy: { nodes: [{ name: 'Status' }] },
    })

    await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    const mutations = gqlApi.state.calls.filter(
      (c) => c.query.includes('updateProjectV2View') || c.query.includes('createProjectV2View'),
    )
    expect(mutations.length).toBe(0)
  })

  it('é idempotente: segunda execução não adiciona items nem regrava valores', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)

    await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })
    const addsAfterFirst = gqlApi.state.calls.filter((c) => c.query.includes('addProjectV2ItemById')).length
    const setsAfterFirst = gqlApi.state.calls.filter((c) => c.query.includes('updateProjectV2ItemFieldValue')).length

    const second = await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })
    const addsAfterSecond = gqlApi.state.calls.filter((c) => c.query.includes('addProjectV2ItemById')).length
    const setsAfterSecond = gqlApi.state.calls.filter((c) => c.query.includes('updateProjectV2ItemFieldValue')).length

    expect(addsAfterFirst).toBe(2)
    expect(addsAfterSecond).toBe(2)
    expect(setsAfterSecond).toBe(setsAfterFirst)
    expect(gqlApi.state.calls.filter((c) => c.query.includes('updateProjectV2Field')).length).toBe(0)
    expect(gqlApi.state.projects.length).toBe(1)
    expect(gqlApi.state.items.length).toBe(2)
    expect(second.every((e) => e.action === 'ok')).toBe(true)
  })

  it('não sobrescreve Priority já definida', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, NODE_IDS)

    // Pré-existente: item com Priority Alta (definida por humano).
    gqlApi.state.items.push({
      id: 'PVTI_N_42',
      content: { id: 'N_42', number: 42 },
      status: { name: 'Backlog', optionId: 'O_Backlog_0' },
      priority: { name: 'Alta', optionId: 'O_Alta_0' },
    })

    await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })

    const testItem = gqlApi.state.items.find((i) => i.content.id === 'N_42')
    expect(testItem.priority.name).toBe('Alta')
  })

  it('dry-run sem token: pré-visual local, sem transportes', async () => {
    const base = tempBase()
    seedFixtures(base)
    const report = await runProjectSync({ token: null, rest: null, gql: null, baseDir: base, dryRun: true })
    expect(report.length).toBe(2)
    expect(report[0].action).toContain('local-preview')
    expect(report.find((e) => e.id === 'DEBT-0004').action).toContain('Concluído')
  })

  it('Issue inexistente no GitHub → divergência e skip', async () => {
    const gqlApi = createFakeGql()
    const base = tempBase()
    seedFixtures(base)
    const { rest, gql } = makeClient(gqlApi, { 42: 'N_42' }) // #7 ausente

    const report = await runProjectSync({ token: 'test-token', rest, gql, baseDir: base })
    const entry = report.find((e) => e.id === 'DEBT-0004')
    expect(entry.action).toBe('skipped')
    expect(entry.divergences.join(' ')).toContain('não encontrada')
  })
})
