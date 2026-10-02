#!/usr/bin/env node
// CLI helper: gera um GitHub App installation token e imprime em stdout.
// Uso típico para criar PRs/Issues como bot:
//
//   GH_TOKEN=$(node scripts/spec-github/bot-token.js) gh pr create --title "..." --body "..."
//
// Pré-requisito: configurar em .env.github (não versionado):
//   GITHUB_BOT_APP_ID=<ID do App>
//   GITHUB_BOT_PRIVATE_KEY_PATH=<caminho para o .pem>   (preferido)
//   GITHUB_BOT_INSTALLATION_ID=<ID da instalação>
//
// O token tem validade de ~1h. Gere um novo no início de cada sessão.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { generateBotToken } from './lib/github-app.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const token = await generateBotToken(REPO_ROOT)

if (!token) {
  process.stderr.write(
    'Erro: credenciais do GitHub App não configuradas.\n' +
      'Configure GITHUB_BOT_APP_ID, GITHUB_BOT_PRIVATE_KEY_PATH e GITHUB_BOT_INSTALLATION_ID em .env.github\n'
  )
  process.exit(1)
}

process.stdout.write(token + '\n')
