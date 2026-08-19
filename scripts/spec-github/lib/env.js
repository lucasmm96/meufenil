// Carregamento de variáveis sensíveis do GitHub: variável de ambiente ou arquivos locais de env
// (NÃO versionados — cobertos pelo .gitignore via `.env*`). Segurança: Blueprint v1.1-final §16.4.
//
// Ordem de leitura: `.env.github` (dedicado, preferido) → `.env.development` → `.env.production`.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ENV_FILES = ['.env.github', '.env.development', '.env.production']

export function loadVar(name, repoRoot) {
  if (process.env[name]) return process.env[name]

  for (const fileName of ENV_FILES) {
    const envFile = join(repoRoot, fileName)
    if (!existsSync(envFile)) continue
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(new RegExp(`^${name}\\s*=\\s*(.+)$`))
      if (match && match[1].trim()) return match[1].trim()
    }
  }
  return null
}

export function loadToken(repoRoot) {
  return loadVar('GITHUB_TOKEN', repoRoot)
}

/** Token para Projects v2: GITHUB_PROJECTS_TOKEN dedicado, com fallback no GITHUB_TOKEN. */
export function loadProjectsToken(repoRoot) {
  return loadVar('GITHUB_PROJECTS_TOKEN', repoRoot) ?? loadToken(repoRoot)
}
