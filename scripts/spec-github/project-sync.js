#!/usr/bin/env node
// Sync GitHub Project ← Specs (Fase 3 — Blueprint v1.1-final §10/§21).
//
// IDEMPOTENTE: executar duas vezes não duplica items nem regrava valores idênticos.
// O Project é DERIVADO das Specs: Status = f(Spec Status); Priority tem default (Média)
// e nunca é sobrescrito quando já definido. O item do Project É a Issue canônica.
//
// Uso:
//   node scripts/spec-github/project-sync.js                 # requer GITHUB_PROJECTS_TOKEN ou GITHUB_TOKEN
//   node scripts/spec-github/project-sync.js --dry-run       # pré-visual local

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { listSpecs } from './lib/specs.js'
import { GitHubClient } from './lib/github.js'
import { GraphQLClient, GraphQLError } from './lib/graphql.js'
import { loadProjectsToken } from './lib/env.js'
import {
  DEFAULT_PRIORITY,
  DEFAULT_STATUS_OPTIONS,
  KANBAN_VIEW_NAME,
  PRIORITY_FIELD,
  PRIORITY_OPTIONS,
  PROJECT_TITLE,
  STATUS_FIELD,
  STATUS_OPTIONS,
  projectStatus,
} from './lib/project-mapping.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function parseArgs(argv) {
  const args = { dryRun: false, baseDir: join(REPO_ROOT, '.ai', 'specs'), repo: 'lucasmm96/meufenil' }
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--base-dir=')) args.baseDir = resolve(arg.slice('--base-dir='.length))
    else if (arg.startsWith('--repo=')) args.repo = arg.slice('--repo='.length)
  }
  return args
}

const QUERIES = {
  viewer: `query { viewer { id login projectsV2(first: 50) { nodes { id title number } } } }`,
  repositoryId: `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }`,
  createProject: `mutation($input: CreateProjectV2Input!) { createProjectV2(input: $input) { projectV2 { id number title } } }`,
  linkRepository: `mutation($input: LinkProjectV2ToRepositoryInput!) { linkProjectV2ToRepository(input: $input) { repository { name } } }`,
  fields: `query($projectId: ID!) { node(id: $projectId) { ... on ProjectV2 { fields(first: 50) { nodes { ... on ProjectV2Field { id name dataType } ... on ProjectV2SingleSelectField { id name dataType options { id name } } } } } } }`,
  createField: `mutation($input: CreateProjectV2FieldInput!) { createProjectV2Field(input: $input) { projectV2Field { ... on ProjectV2Field { id name } ... on ProjectV2SingleSelectField { id name } } } }`,
  updateField: `mutation($input: UpdateProjectV2FieldInput!) { updateProjectV2Field(input: $input) { projectV2Field { ... on ProjectV2Field { id name } ... on ProjectV2SingleSelectField { id name } } } }`,
  items: `query($projectId: ID!) { node(id: $projectId) { ... on ProjectV2 { items(first: 100) { nodes { id content { ... on Issue { id number } } status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name optionId } } priority: fieldValueByName(name: "Priority") { ... on ProjectV2ItemFieldSingleSelectValue { name optionId } } } } } } }`,
  addItem: `mutation($input: AddProjectV2ItemByIdInput!) { addProjectV2ItemById(input: $input) { item { id } } }`,
  setField: `mutation($input: UpdateProjectV2ItemFieldValueInput!) { updateProjectV2ItemFieldValue(input: $input) { projectV2Item { id } } }`,
  views: `query($projectId: ID!) { node(id: $projectId) { ... on ProjectV2 { views(first: 20) { nodes { id name layout groupBy(first: 10) { nodes { name } } } } } } }`,
  updateView: `mutation($input: UpdateProjectV2ViewInput!) { updateProjectV2View(input: $input) { projectV2View { id name layout } } }`,
  createView: `mutation($input: CreateProjectV2ViewInput!) { createProjectV2View(input: $input) { projectV2View { id name layout } } }`,
}

function findProject(viewerData, title) {
  const nodes = viewerData?.projectsV2?.nodes ?? []
  return nodes.find((p) => p.title === title) ?? null
}

function findField(fieldsData, name) {
  const nodes = fieldsData?.node?.fields?.nodes ?? []
  const field = nodes.find((f) => f.name === name)
  if (!field) return null
  return { id: field.id, options: field.options ?? null }
}

function findItem(itemsData, contentId) {
  const nodes = itemsData?.node?.items?.nodes ?? []
  return nodes.find((i) => i.content?.id === contentId) ?? null
}

/**
 * Sincroniza o Project com as Specs. Retorna relatório por Spec.
 * @param {object} opts { token, rest, gql, baseDir, dryRun }
 */
export async function runProjectSync({ token, rest, gql, baseDir, dryRun = false }) {
  const specs = listSpecs(baseDir).filter((s) => s.issue !== null)
  const report = []

  if (dryRun || !token) {
    for (const spec of specs) {
      const status = projectStatus(spec.status)
      report.push({
        id: spec.id,
        issue: spec.issue,
        action: status ? `local-preview (Status → ${status})` : 'local-preview (sem mapeamento)',
        divergences: [],
      })
    }
    return report
  }

  // 1. Localizar (ou criar) o Project pelo título — idempotente.
  const viewer = await gql.query(QUERIES.viewer)
  let project = findProject(viewer.viewer, PROJECT_TITLE)
  if (!project) {
    const created = await gql.query(QUERIES.createProject, {
      input: { ownerId: viewer.viewer.id, title: PROJECT_TITLE },
    })
    project = created.createProjectV2.projectV2
  }

  // 2. Linkar ao repositório (idempotente: erro de "already linked" é ignorado).
  try {
    const repoData = await gql.query(QUERIES.repositoryId, { owner: rest.owner, name: rest.repo })
    const repositoryId = repoData.repository?.id
    if (repositoryId) {
      await gql.query(QUERIES.linkRepository, { input: { projectId: project.id, repositoryId } })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/already|linked/i.test(message)) throw error
  }

  // 3. Garantir campos Status e Priority (idempotente).
  //    Projects v2 novos já vêm com um campo Status built-in (Todo/In Progress/Done) que a
  //    GraphQL não deixa deletar nem criar por cima. updateProjectV2Field aceita built-ins,
  //    então o padrão intacto é atualizado com as opções do Blueprint §10.2 (a Board view
  //    padrão agrupa por esse campo). Campo personalizado por humano ou com item usando
  //    valor nunca é alterado (a divergência é reportada no passo 4). Obs.: a API exige
  //    `description` em cada opção single-select.
  const createSingleSelect = async (name, options) => {
    await gql.query(QUERIES.createField, {
      input: { projectId: project.id, name, dataType: 'SINGLE_SELECT', singleSelectOptions: options },
    })
    fields = await gql.query(QUERIES.fields, { projectId: project.id })
    return findField(fields, name)
  }

  const values = await gql.query(QUERIES.items, { projectId: project.id })
  const currentItems = values?.node?.items?.nodes ?? []
  let fields = await gql.query(QUERIES.fields, { projectId: project.id })
  let statusField = findField(fields, STATUS_FIELD)

  if (!statusField) {
    statusField = await createSingleSelect(STATUS_FIELD, STATUS_OPTIONS)
  } else if (!statusField.options?.some((o) => STATUS_OPTIONS.some((s) => s.name === o.name))) {
    const names = (statusField.options ?? []).map((o) => o.name)
    const isGitHubDefault =
      names.length === DEFAULT_STATUS_OPTIONS.length &&
      DEFAULT_STATUS_OPTIONS.every((n) => names.includes(n))
    const itemsUseStatus = currentItems.some((i) => i.status?.name)
    if (isGitHubDefault && !itemsUseStatus) {
      await gql.query(QUERIES.updateField, {
        input: { fieldId: statusField.id, name: STATUS_FIELD, singleSelectOptions: STATUS_OPTIONS },
      })
      fields = await gql.query(QUERIES.fields, { projectId: project.id })
      statusField = findField(fields, STATUS_FIELD)
    }
  }

  let priorityField = findField(fields, PRIORITY_FIELD)
  if (!priorityField) {
    priorityField = await createSingleSelect(PRIORITY_FIELD, PRIORITY_OPTIONS)
  }

  // 4. Items: adicionar Issues canônicas e aplicar Status/Priority derivados.

  for (const spec of specs) {
    const entry = { id: spec.id, issue: spec.issue, action: 'ok', divergences: [] }
    const issueData = await rest.getIssue(spec.issue)
    if (!issueData) {
      entry.divergences.push(`Issue #${spec.issue} não encontrada no GitHub`)
      entry.action = 'skipped'
      report.push(entry)
      continue
    }
    const contentId = issueData.node_id

    let item = findItem({ node: { items: { nodes: currentItems } } }, contentId)
    if (!item) {
      const added = await gql.query(QUERIES.addItem, { input: { projectId: project.id, contentId } })
      item = { id: added.addProjectV2ItemById.item.id }
      entry.action = 'item-added'
    }

    const current = currentItems.find((i) => i.content?.id === contentId) ?? null
    const currentStatus = current?.status?.name ?? null
    const currentPriority = current?.priority?.name ?? null
    const desiredStatus = projectStatus(spec.status)

    if (desiredStatus && currentStatus !== desiredStatus) {
      const option = statusField.options?.find((o) => o.name === desiredStatus)
      if (!option) {
        entry.divergences.push(`opção "${desiredStatus}" ausente no campo Status`)
      } else {
        await gql.query(QUERIES.setField, {
          input: {
            projectId: project.id,
            itemId: item.id,
            fieldId: statusField.id,
            value: { singleSelectOptionId: option.id },
          },
        })
        entry.action = entry.action === 'item-added' ? 'item-added + status' : 'status-set'
      }
    }

    if (!currentPriority) {
      const option = priorityField?.options?.find((o) => o.name === DEFAULT_PRIORITY)
      if (!option) {
        entry.divergences.push(`opção "${DEFAULT_PRIORITY}" ausente no campo Priority`)
      } else {
        await gql.query(QUERIES.setField, {
          input: {
            projectId: project.id,
            itemId: item.id,
            fieldId: priorityField.id,
            value: { singleSelectOptionId: option.id },
          },
        })
        if (entry.action === 'ok') entry.action = 'priority-default'
      }
    }

    report.push(entry)
  }

  // 5. View Kanban (idempotente): garantir BOARD_LAYOUT com nome "Kanban".
  //    O groupBy (colunas por Status) não é exposto pela GraphQL — conferir uma única
  //    vez na UI (View → Settings → Board → Column by → Status); a nota abaixo lembra até isso ser feito.
  const viewsData = await gql.query(QUERIES.views, { projectId: project.id })
  const views = viewsData?.node?.views?.nodes ?? []
  const kanban = views.find((v) => v.name === KANBAN_VIEW_NAME) ?? views[0] ?? null
  const groupedByStatus = Boolean(kanban?.groupBy?.nodes?.some((g) => g.name === STATUS_FIELD))
  if (!kanban) {
    await gql.query(QUERIES.createView, {
      input: { projectId: project.id, name: KANBAN_VIEW_NAME, layout: 'BOARD_LAYOUT' },
    })
  } else if (kanban.name !== KANBAN_VIEW_NAME || kanban.layout !== 'BOARD_LAYOUT') {
    await gql.query(QUERIES.updateView, {
      input: { viewId: kanban.id, name: KANBAN_VIEW_NAME, layout: 'BOARD_LAYOUT' },
    })
  }
  if (!groupedByStatus) {
    console.log('NOTA: view "Kanban" sem colunas por Status confirmadas — a GraphQL não expõe o groupBy de Board views; confira uma vez na UI (View → Settings → Board → Column by → Status).')
  }

  return report
}

function printReport(report, dryRun) {
  console.log(`\nProject sync${dryRun ? ' (DRY-RUN)' : ''} — ${report.length} specs com Issue\n`)
  for (const entry of report) {
    const line = [
      entry.id.padEnd(12),
      entry.issue ? `#${String(entry.issue).padEnd(5)}` : '      ',
      String(entry.action).padEnd(28),
    ].join('  ')
    console.log(line)
    for (const d of entry.divergences) console.log(`  ⚠ ${d}`)
  }
  const divergences = report.reduce((n, e) => n + e.divergences.length, 0)
  console.log(`\nDivergências: ${divergences}`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  const [owner, repo] = args.repo.split('/')
  const token = loadProjectsToken(REPO_ROOT)
  if (!token && !args.dryRun) {
    console.error('GITHUB_PROJECTS_TOKEN/GITHUB_TOKEN ausente — defina em .env.github (não versionado).')
    process.exit(1)
  }
  try {
    const gql = token ? new GraphQLClient({ token }) : null
    const rest = token ? new GitHubClient({ token, owner, repo }) : null
    const report = await runProjectSync({ token, rest, gql, baseDir: args.baseDir, dryRun: args.dryRun })
    printReport(report, args.dryRun)
  } catch (error) {
    if (error instanceof GraphQLError) {
      console.error(`Falha GraphQL: ${error.message}`)
    } else {
      console.error(error)
    }
    process.exit(1)
  }
}
