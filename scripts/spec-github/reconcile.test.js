import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reconciliation, runReconcile } from './reconcile.js'

const SPEC = (issue) => `# TEST-0009 — Fixture
**Type:** TEST
**Status:** PROPOSED
**Title:** Fixture
**Issue:** #${issue}
**Created on:** 2026-08-17

## Problem
Fixture.
`

/** Fake REST com captura de chamadas. */
function createFakeRest({ issue = { state: 'closed' }, comments = [] }) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET' })
    if (String(url).includes('/comments?per_page')) {
      return { status: 200, ok: true, json: async () => comments }
    }
    if (init.method === 'POST' && String(url).endsWith('/comments')) {
      return { status: 201, ok: true, json: async () => ({ id: 1, body: JSON.parse(init.body).body }) }
    }
    if (String(url).endsWith('/issues/26')) {
      if (issue === null) return { status: 404, ok: false, json: async () => ({ message: 'Not Found' }) }
      return { status: 200, ok: true, json: async () => issue }
    }
    throw new Error(`URL não esperada: ${url}`)
  }
  return { calls, fetchImpl }
}

function makeClient(fakeRest) {
  const token = 'test-token'
  const rest = {
    getIssue: (n) =>
      fakeRest.fetchImpl(`https://api.github.com/repos/o/r/issues/${n}`).then((r) => (r.status === 404 ? null : r.json())),
    listComments: (n) =>
      fakeRest.fetchImpl(`https://api.github.com/repos/o/r/issues/${n}/comments?per_page=100`).then((r) => r.json()),
    addComment: (n, body) =>
      fakeRest.fetchImpl(`https://api.github.com/repos/o/r/issues/${n}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
  }
  return { token, rest }
}

describe('reconciliation (D-12 CASO 3 — função pura)', () => {
  it('closed + Spec não terminal → divergência com comentário', () => {
    const r = reconciliation({ action: 'closed', issueState: 'closed', specStatus: 'PROPOSED' })
    expect(r.action).toBe('divergence-comment')
    expect(r.comment).toContain('D-12 CASO 3')
  })

  it('reopened + Spec terminal → divergência com comentário', () => {
    const r = reconciliation({ action: 'reopened', issueState: 'open', specStatus: 'IMPLEMENTED' })
    expect(r.action).toBe('divergence-comment')
    expect(r.comment).toContain('D-12 CASO 3')
  })

  it('closed + Spec terminal → no-op', () => {
    expect(reconciliation({ action: 'closed', issueState: 'closed', specStatus: 'IMPLEMENTED' }).action).toBe('no-op')
  })

  it('reopened + Spec não terminal → no-op', () => {
    expect(reconciliation({ action: 'reopened', issueState: 'open', specStatus: 'PROPOSED' }).action).toBe('no-op')
  })

  it('sem Spec → no-op', () => {
    expect(reconciliation({ action: 'closed', issueState: 'closed', specStatus: null }).action).toBe('no-op')
  })
})

describe('runReconcile', () => {
  let tempDirs = []

  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
    tempDirs = []
  })

  function tempBase() {
    const dir = mkdtempSync(join(tmpdir(), 'reconcile-'))
    tempDirs.push(dir)
    mkdirSync(join(dir, 'proposed', 'testing'), { recursive: true })
    writeFileSync(join(dir, 'proposed', 'testing', 'TEST-0009-fixture.md'), SPEC(26))
    return dir
  }

  function terminalFixture(base) {
    const file = join(base, 'proposed', 'testing', 'TEST-0009-fixture.md')
    writeFileSync(file, readFileSync(file, 'utf8').replace('Status:** PROPOSED', 'Status:** IMPLEMENTED'))
  }

  it('closed divergente → posta comentário com marker de dedup', async () => {
    const fakeRest = createFakeRest({ issue: { state: 'closed' } })
    const { token, rest } = makeClient(fakeRest)
    const base = tempBase()

    const result = await runReconcile({ token, rest, issueNumber: 26, action: 'closed', baseDir: base })

    expect(result.action).toBe('divergence-comment')
    expect(fakeRest.calls.filter((c) => c.method === 'POST').length).toBe(1)
  })

  it('não repete comentário quando o marker já existe (idempotente)', async () => {
    const fakeRest = createFakeRest({
      issue: { state: 'closed' },
      comments: [{ body: '<!-- sync:reconcile -->\ncomentário anterior' }],
    })
    const { token, rest } = makeClient(fakeRest)
    const base = tempBase()

    const result = await runReconcile({ token, rest, issueNumber: 26, action: 'closed', baseDir: base })

    expect(result.action).toBe('comment-already-present')
    expect(fakeRest.calls.filter((c) => c.method === 'POST').length).toBe(0)
  })

  it('closed com Spec terminal → no-op, sem transporte de escrita', async () => {
    const fakeRest = createFakeRest({ issue: { state: 'closed' } })
    const { token, rest } = makeClient(fakeRest)
    const base = tempBase()
    terminalFixture(base)

    const result = await runReconcile({ token, rest, issueNumber: 26, action: 'closed', baseDir: base })

    expect(result.action).toBe('no-op')
    expect(fakeRest.calls.filter((c) => c.method === 'POST').length).toBe(0)
  })

  it('Issue sem Spec correspondente → no-spec, sem transporte', async () => {
    const fakeRest = createFakeRest({ issue: { state: 'closed' } })
    const { token, rest } = makeClient(fakeRest)
    const base = tempBase()

    const result = await runReconcile({ token, rest, issueNumber: 99, action: 'closed', baseDir: base })

    expect(result.action).toBe('no-spec')
    expect(fakeRest.calls.length).toBe(0)
  })

  it('dry-run → pré-visual sem transporte', async () => {
    const fakeRest = createFakeRest({ issue: { state: 'closed' } })
    const { token, rest } = makeClient(fakeRest)
    const base = tempBase()

    const result = await runReconcile({ token, rest, issueNumber: 26, action: 'closed', baseDir: base, dryRun: true })

    expect(result.action).toContain('dry-run')
    expect(fakeRest.calls.length).toBe(0)
  })

  it('Issue inexistente no GitHub → issue-not-found', async () => {
    const fakeRest = createFakeRest({ issue: null })
    const { token, rest } = makeClient(fakeRest)
    const base = tempBase()

    const result = await runReconcile({ token, rest, issueNumber: 26, action: 'closed', baseDir: base })

    expect(result.action).toBe('issue-not-found')
  })
})
