// Cliente mínimo da GitHub REST API (Issues e Labels), sem dependências externas.
// O token é injetado; o cliente é substituível nos testes (fetch impl).

export class GitHubApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
  }
}

export class GitHubClient {
  constructor({ token, owner, repo, fetchImpl = globalThis.fetch, baseUrl = 'https://api.github.com' }) {
    this.token = token
    this.owner = owner
    this.repo = repo
    this.fetchImpl = fetchImpl
    this.baseUrl = baseUrl
  }

  headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    }
  }

  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`
    const response = await this.fetchImpl(url, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.status === 404) return null
    if (!response.ok) {
      throw new GitHubApiError(`GitHub API ${method} ${path} → HTTP ${response.status}`, response.status)
    }
    return response.json()
  }

  /** Garante a existência da label (cria quando não existe; 422 = já existe). */
  async ensureLabel(name) {
    const existing = await this.request(
      'GET',
      `/repos/${this.owner}/${this.repo}/labels/${encodeURIComponent(name)}`
    )
    if (existing !== null) return

    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/labels`
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name, color: 'd4c5f9' }),
    })
    if (response.status === 422) return
    if (!response.ok) {
      throw new GitHubApiError(`GitHub API POST labels → HTTP ${response.status}`, response.status)
    }
  }

  /** Busca o Issue por número; null quando não existe. */
  getIssue(number) {
    return this.request('GET', `/repos/${this.owner}/${this.repo}/issues/${number}`)
  }

  /** Busca Issues pela label spec:<ID> (exclui PRs). */
  async findIssuesByLabel(label) {
    const issues = await this.request(
      'GET',
      `/repos/${this.owner}/${this.repo}/issues?state=all&per_page=100&labels=${encodeURIComponent(label)}`
    )
    if (!Array.isArray(issues)) return []
    return issues.filter((i) => !i.pull_request)
  }

  createIssue({ title, body, labels }) {
    return this.request('POST', `/repos/${this.owner}/${this.repo}/issues`, { title, body, labels })
  }

  updateIssue(number, { title, body }) {
    return this.request('PATCH', `/repos/${this.owner}/${this.repo}/issues/${number}`, { title, body })
  }

  setLabels(number, labels) {
    return this.request('PUT', `/repos/${this.owner}/${this.repo}/issues/${number}/labels`, { labels })
  }

  /** Adiciona labels ao Issue (POST aditivo — não substitui o conjunto atual). */
  addLabels(number, labels) {
    return this.request('POST', `/repos/${this.owner}/${this.repo}/issues/${number}/labels`, { labels })
  }

  /** Atualiza um comentário existente (PATCH) — update-in-place de comentários com marker. */
  updateComment(commentId, body) {
    return this.request('PATCH', `/repos/${this.owner}/${this.repo}/issues/comments/${commentId}`, { body })
  }

  /** Lista comentários do Issue (mais recentes por último). */
  listComments(number) {
    return this.request('GET', `/repos/${this.owner}/${this.repo}/issues/${number}/comments?per_page=100`)
  }

  addComment(number, body) {
    return this.request('POST', `/repos/${this.owner}/${this.repo}/issues/${number}/comments`, { body })
  }

  /** Lista milestones do estado dado (padrão open) — o alvo de release (§18.9). */
  listMilestones(state = 'open') {
    return this.request('GET', `/repos/${this.owner}/${this.repo}/milestones?state=${state}&per_page=100`)
  }

  /** Fecha/reabre um milestone (state: closed|open) — pós-publicação (§12.1 passo 6). */
  updateMilestone(number, state) {
    return this.request('PATCH', `/repos/${this.owner}/${this.repo}/milestones/${number}`, { state })
  }
}
