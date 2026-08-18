// Cliente mínimo da GitHub GraphQL API (Projects v2), sem dependências externas.
// Transporte injetável (testes usam mock). Erros GraphQL viram exceção explícita.

export class GraphQLError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GraphQLError'
  }
}

export class GraphQLClient {
  constructor({ token, fetchImpl = globalThis.fetch, endpoint = 'https://api.github.com/graphql' }) {
    this.token = token
    this.fetchImpl = fetchImpl
    this.endpoint = endpoint
  }

  async query(query, variables = {}) {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    const json = await response.json()
    if (json.errors && json.errors.length > 0) {
      throw new GraphQLError(json.errors.map((e) => `${e.type ?? 'ERROR'} ${e.message}`).join('; '))
    }
    return json.data
  }
}
