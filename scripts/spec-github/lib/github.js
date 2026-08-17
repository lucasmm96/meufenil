// Cliente mínimo da GitHub REST API (Issues), sem dependências externas.
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

  async request(method, path, body) {
    const url = `${this.baseUrl}${path}`
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.status === 404) return null
    if (!response.ok) {
      throw new GitHubApiError(`GitHub API ${method} ${path} → HTTP ${response.status}`, response.status)
    }
    return response.json()
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
}
