import { describe, expect, it } from 'vitest'
import { parseArgs, RESPONDER_MARKER, responderDecision, runIssueResponder, STATIC_COMMENT } from './issue-responder.js'

const ISSUE = (overrides = {}) => ({
  author_association: 'NONE',
  labels: [],
  ...overrides,
})

/** Fake REST com captura de chamadas. */
function createFakeRest({ issue = ISSUE(), comments = [] } = {}) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET' })
    if (String(url).includes('/comments?per_page')) {
      return { status: 200, ok: true, json: async () => comments }
    }
    if (init.method === 'POST' && String(url).endsWith('/comments')) {
      return { status: 201, ok: true, json: async () => ({ id: 1, body: JSON.parse(init.body).body }) }
    }
    if (init.method === 'POST' && String(url).endsWith('/labels')) {
      return { status: 200, ok: true, json: async () => [] }
    }
    if (String(url).endsWith('/issues/44')) {
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
    addLabels: (n, labels) =>
      fakeRest.fetchImpl(`https://api.github.com/repos/o/r/issues/${n}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }),
  }
  return { token, rest }
}

describe('parseArgs (forma do workflow)', () => {
  it('aceita --issue 44 --dry-run', () => {
    expect(parseArgs(['--issue', '44', '--dry-run'])).toMatchObject({ issue: 44, dryRun: true })
  })

  it('aceita a forma --issue=44', () => {
    expect(parseArgs(['--issue=44'])).toMatchObject({ issue: 44, dryRun: false })
  })
})

describe('responderDecision (W3)', () => {
  it('autor externo (NONE) sem labels e sem marker → respond com o comentário estático', () => {
    const result = responderDecision({ authorAssociation: 'NONE', labels: [], hasMarker: false })
    expect(result.action).toBe('respond')
    expect(result.comment).toContain(RESPONDER_MARKER)
    expect(result.comment).toContain('triage')
  })

  it('autor CONTRIBUTOR responde; OWNER/MEMBER/COLLABORATOR → skip-author', () => {
    expect(responderDecision({ authorAssociation: 'CONTRIBUTOR', labels: [], hasMarker: false }).action).toBe('respond')
    for (const author of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      expect(responderDecision({ authorAssociation: author, labels: [], hasMarker: false }).action).toBe('skip-author')
    }
  })

  it('qualquer label do fluxo → skip-label', () => {
    for (const label of ['spec-driven', 'spec-created', 'duplicate', 'not-planned']) {
      expect(responderDecision({ authorAssociation: 'NONE', labels: [label], hasMarker: false }).action).toBe('skip-label')
    }
  })

  it('marker de dedup já presente → skip-already-responded', () => {
    expect(responderDecision({ authorAssociation: 'NONE', labels: [], hasMarker: true }).action).toBe('skip-already-responded')
  })
})

describe('runIssueResponder (transporte)', () => {
  it('responde: 1 comentário com marker + label triage (POST aditivo em labels)', async () => {
    const fake = createFakeRest()
    const { token, rest } = makeClient(fake)
    const result = await runIssueResponder({ token, rest, issueNumber: 44 })

    expect(result.action).toBe('responded')
    const posts = fake.calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0].url).toContain('/comments')
    expect(posts[1].url).toContain('/labels')
  })

  it('não repete comentário quando o marker existe (idempotente — sem POST)', async () => {
    const fake = createFakeRest({ comments: [{ body: `${RESPONDER_MARKER}\nObrigado!` }] })
    const { token, rest } = makeClient(fake)
    const result = await runIssueResponder({ token, rest, issueNumber: 44 })

    expect(result.action).toBe('skip-already-responded')
    expect(fake.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('Issue inexistente → issue-not-found, sem escrita', async () => {
    const fake = createFakeRest({ issue: null })
    const { token, rest } = makeClient(fake)
    const result = await runIssueResponder({ token, rest, issueNumber: 44 })

    expect(result.action).toBe('issue-not-found')
    expect(fake.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('mantenedor (OWNER) → skip-author, sem escrita', async () => {
    const fake = createFakeRest({ issue: ISSUE({ author_association: 'OWNER' }) })
    const { token, rest } = makeClient(fake)
    const result = await runIssueResponder({ token, rest, issueNumber: 44 })

    expect(result.action).toBe('skip-author')
    expect(fake.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('dry-run → decisão sem escrita', async () => {
    const fake = createFakeRest()
    const { token, rest } = makeClient(fake)
    const result = await runIssueResponder({ token, rest, issueNumber: 44, dryRun: true })

    expect(result.action).toBe('respond (dry-run)')
    expect(fake.calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('sem token → no-token (sem chamadas REST)', async () => {
    const fake = createFakeRest()
    const result = await runIssueResponder({ token: null, rest: null, issueNumber: 44 })

    expect(result.action).toBe('no-token')
    expect(fake.calls).toHaveLength(0)
  })

  it('STATIC_COMMENT carrega o marker de dedup e orienta o autor', () => {
    expect(STATIC_COMMENT).toContain(RESPONDER_MARKER)
    expect(STATIC_COMMENT).toContain('avaliada pelo mantenedor')
    expect(STATIC_COMMENT).toContain('nunca autorizam implementação por si só')
  })
})
