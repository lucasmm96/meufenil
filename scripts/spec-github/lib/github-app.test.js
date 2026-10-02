import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateJWT, getInstallationToken, generateBotToken } from './github-app.js'

function makeTestKeyPem() {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return privateKey.export({ type: 'pkcs8', format: 'pem' })
}

const FIXED_NOW = 1700000000

describe('generateJWT', () => {
  it('retorna string com 3 partes separadas por ponto (header.payload.signature)', () => {
    const jwt = generateJWT('12345', makeTestKeyPem(), FIXED_NOW)
    expect(jwt.split('.')).toHaveLength(3)
  })

  it('header tem alg=RS256 e typ=JWT', () => {
    const jwt = generateJWT('12345', makeTestKeyPem(), FIXED_NOW)
    const header = JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString())
    expect(header.alg).toBe('RS256')
    expect(header.typ).toBe('JWT')
  })

  it('payload tem iss=appId (string), iat=now-60, exp=now+600', () => {
    const jwt = generateJWT('99', makeTestKeyPem(), FIXED_NOW)
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
    expect(payload.iss).toBe('99')
    expect(payload.iat).toBe(FIXED_NOW - 60)
    expect(payload.exp).toBe(FIXED_NOW + 600)
  })

  it('converte appId numérico para string no claim iss', () => {
    const jwt = generateJWT(42, makeTestKeyPem(), FIXED_NOW)
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
    expect(payload.iss).toBe('42')
  })
})

describe('getInstallationToken', () => {
  it('faz POST na URL correta com JWT como Authorization Bearer', async () => {
    let capturedUrl, capturedOpts
    const mockFetch = (url, opts) => {
      capturedUrl = url
      capturedOpts = opts
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: 'ghs_test_token' }),
      })
    }
    const token = await getInstallationToken('jwt-value', '456', mockFetch)
    expect(capturedUrl).toBe('https://api.github.com/app/installations/456/access_tokens')
    expect(capturedOpts.method).toBe('POST')
    expect(capturedOpts.headers.Authorization).toBe('Bearer jwt-value')
    expect(token).toBe('ghs_test_token')
  })

  it('inclui Accept e X-GitHub-Api-Version nos headers', async () => {
    let capturedHeaders
    const mockFetch = (_url, opts) => {
      capturedHeaders = opts.headers
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'tok' }) })
    }
    await getInstallationToken('jwt', '1', mockFetch)
    expect(capturedHeaders.Accept).toBe('application/vnd.github+json')
    expect(capturedHeaders['X-GitHub-Api-Version']).toBe('2022-11-28')
  })

  it('lança erro quando a resposta não é ok', async () => {
    const mockFetch = () => Promise.resolve({ ok: false, status: 401 })
    await expect(getInstallationToken('bad-jwt', '1', mockFetch)).rejects.toThrow(
      'GitHub App token request failed: HTTP 401'
    )
  })
})

describe('generateBotToken', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'bot-token-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('retorna null quando nenhuma credencial está configurada', async () => {
    expect(await generateBotToken(tmpDir)).toBeNull()
  })

  it('retorna null quando só GITHUB_BOT_APP_ID está configurado', async () => {
    writeFileSync(join(tmpDir, '.env.github'), 'GITHUB_BOT_APP_ID=123\n')
    expect(await generateBotToken(tmpDir)).toBeNull()
  })

  it('gera JWT e chama getInstallationToken quando credenciais completas estão presentes', async () => {
    const pem = makeTestKeyPem()
    const pemPath = join(tmpDir, 'app.pem')
    writeFileSync(pemPath, pem)
    writeFileSync(
      join(tmpDir, '.env.github'),
      `GITHUB_BOT_APP_ID=777\nGHITHUB_BOT_PRIVATE_KEY_PATH=${pemPath}\nGITHUB_BOT_INSTALLATION_ID=999\n`
    )
    const mockFetch = (_url, _opts) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'ghs_bot_token' }) })
    // Sobrescreve variável inline para simplificar: usa loadBotPrivateKey direto
    // Este teste valida o fluxo completo via env com inline key
    writeFileSync(
      join(tmpDir, '.env.github'),
      `GITHUB_BOT_APP_ID=777\nGITHUB_BOT_PRIVATE_KEY=${pem.replace(/\n/g, '\\n')}\nGITHUB_BOT_INSTALLATION_ID=999\n`
    )
    const token = await generateBotToken(tmpDir, mockFetch)
    expect(token).toBe('ghs_bot_token')
  })
})
