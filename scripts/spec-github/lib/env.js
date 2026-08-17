// Carregamento do token do GitHub: variável de ambiente GITHUB_TOKEN ou arquivo local .env.github
// (NÃO versionado — coberto pelo .gitignore via `.env*`). Segurança: Blueprint v1.1-final §16.4.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadToken(repoRoot) {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN

  const envFile = join(repoRoot, '.env.github')
  if (!existsSync(envFile)) return null

  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^GITHUB_TOKEN\s*=\s*(.+)$/)
    if (match && match[1].trim()) return match[1].trim()
  }
  return null
}
