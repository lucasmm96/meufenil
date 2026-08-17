// Carregamento do token do GitHub: variável de ambiente GITHUB_TOKEN ou arquivos locais de env
// (NÃO versionados — cobertos pelo .gitignore via `.env*`). Segurança: Blueprint v1.1-final §16.4.
//
// Ordem de leitura: `.env.github` (dedicado, preferido) → `.env.development` → `.env.production`
// (locais onde o autor armazenou o token em 2026-08-16 — aceitos como fallback).

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ENV_FILES = ['.env.github', '.env.development', '.env.production']

export function loadToken(repoRoot) {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN

  for (const name of ENV_FILES) {
    const envFile = join(repoRoot, name)
    if (!existsSync(envFile)) continue
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^GITHUB_TOKEN\s*=\s*(.+)$/)
      if (match && match[1].trim()) return match[1].trim()
    }
  }
  return null
}
