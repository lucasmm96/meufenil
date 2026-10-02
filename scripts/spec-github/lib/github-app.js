// GitHub App authentication: JWT (RS256, node:crypto) + installation token exchange.
// Sem dependências externas — usa somente APIs nativas do Node.js e da GitHub REST API.
//
// Fluxo:
//   1. generateJWT(appId, privateKeyPem) → JWT assinado com RS256
//   2. getInstallationToken(jwt, installationId) → installation token (validade ~1h)
//   3. generateBotToken(repoRoot) → fluxo completo via env.js

import { createPrivateKey, createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadBotAppId, loadBotPrivateKey, loadBotInstallationId } from './env.js'

/**
 * Gera um JWT de GitHub App (RS256).
 * @param {string|number} appId  — App ID do GitHub App
 * @param {string} privateKeyPem — conteúdo PEM da chave privada RSA
 * @param {number} [now]         — timestamp Unix em segundos (injetável em testes)
 */
export function generateJWT(appId, privateKeyPem, now = Math.floor(Date.now() / 1000)) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ iss: String(appId), iat: now - 60, exp: now + 600 })
  ).toString('base64url')
  const signing = `${header}.${payload}`
  const sign = createSign('RSA-SHA256')
  sign.update(signing)
  sign.end()
  const key = createPrivateKey(privateKeyPem)
  const signature = sign.sign(key).toString('base64url')
  return `${signing}.${signature}`
}

/**
 * Troca um JWT de App por um installation token (POST /app/installations/:id/access_tokens).
 * @param {string} jwt            — JWT gerado por generateJWT
 * @param {string|number} installationId
 * @param {Function} [fetchImpl]  — injetável em testes
 * @returns {Promise<string>}     — installation token
 */
export async function getInstallationToken(jwt, installationId, fetchImpl = globalThis.fetch) {
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub App token request failed: HTTP ${response.status}`)
  }
  const data = await response.json()
  return data.token
}

/**
 * Fluxo completo: carrega credenciais do bot via env.js, gera JWT e obtém installation token.
 * Retorna null quando as credenciais não estão configuradas (modo graceful degradation).
 * @param {string} repoRoot   — caminho absoluto da raiz do repositório
 * @param {Function} [fetchImpl]
 * @returns {Promise<string|null>}
 */
export async function generateBotToken(repoRoot, fetchImpl = globalThis.fetch) {
  const appId = loadBotAppId(repoRoot)
  const installationId = loadBotInstallationId(repoRoot)
  const privateKey = loadBotPrivateKey(repoRoot)

  if (!appId || !installationId || !privateKey) return null

  const jwt = generateJWT(appId, privateKey)
  return getInstallationToken(jwt, installationId, fetchImpl)
}
