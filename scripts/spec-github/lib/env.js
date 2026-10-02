// Carregamento de variáveis sensíveis do GitHub: variável de ambiente ou arquivos locais de env
// (NÃO versionados — cobertos pelo .gitignore via `.env*`). Segurança: Blueprint v1.1-final §16.4.
//
// Ordem de leitura: `.env.github` (dedicado, preferido) → `.env.development` → `.env.production`.

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

// ── GitHub App (ENH-0002) ─────────────────────────────────────────────────────

/** App ID do GitHub App `meufenil-claude` (GITHUB_BOT_APP_ID). */
export function loadBotAppId(repoRoot) {
  return loadVar('GITHUB_BOT_APP_ID', repoRoot)
}

/**
 * Chave privada PEM do GitHub App.
 * Lê GITHUB_BOT_PRIVATE_KEY_PATH (caminho para arquivo .pem — preferido)
 * ou GITHUB_BOT_PRIVATE_KEY (conteúdo PEM inline, com \n literais).
 */
export function loadBotPrivateKey(repoRoot) {
  const keyPath = loadVar('GITHUB_BOT_PRIVATE_KEY_PATH', repoRoot)
  if (keyPath) {
    const abs = keyPath.startsWith('/') || /^[A-Za-z]:\\/.test(keyPath)
      ? keyPath
      : resolve(repoRoot, keyPath)
    return readFileSync(abs, 'utf8')
  }
  const inline = loadVar('GITHUB_BOT_PRIVATE_KEY', repoRoot)
  if (inline) return inline.replace(/\\n/g, '\n')
  return null
}

/** ID da instalação do App no repositório (GITHUB_BOT_INSTALLATION_ID). */
export function loadBotInstallationId(repoRoot) {
  return loadVar('GITHUB_BOT_INSTALLATION_ID', repoRoot)
}
