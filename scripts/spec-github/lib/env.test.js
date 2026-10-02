import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadToken, loadBotAppId, loadBotInstallationId, loadBotPrivateKey } from './env.js'

function makeEnvDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'env-test-'))
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe('env', () => {
  let previous

  beforeEach(() => {
    // Neutraliza GITHUB_TOKEN do ambiente (ex.: injetado pelo vitest.config a partir de .env.development)
    // para que os testes sejam determinísticos.
    previous = process.env.GITHUB_TOKEN
    delete process.env.GITHUB_TOKEN
  })

  afterEach(() => {
    if (previous === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = previous
  })

  it('lê o token de .env.github (preferido)', () => {
    const dir = makeEnvDir({
      '.env.github': 'GITHUB_TOKEN=pat-file\n',
      '.env.development': 'GITHUB_TOKEN=pat-dev\n',
    })
    try {
      expect(loadToken(dir)).toBe('pat-file')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('usa .env.development como fallback quando .env.github não existe', () => {
    const dir = makeEnvDir({ '.env.development': 'OUTRA=1\nGITHUB_TOKEN=pat-dev\n' })
    try {
      expect(loadToken(dir)).toBe('pat-dev')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('usa .env.production como fallback final', () => {
    const dir = makeEnvDir({ '.env.production': 'GITHUB_TOKEN=pat-prod\n' })
    try {
      expect(loadToken(dir)).toBe('pat-prod')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('retorna null quando não há token em lugar nenhum', () => {
    const dir = makeEnvDir({ '.env.development': 'OUTRA=1\n' })
    try {
      expect(loadToken(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefere a variável de ambiente', () => {
    const dir = makeEnvDir({ '.env.github': 'GITHUB_TOKEN=pat-file\n' })
    try {
      process.env.GITHUB_TOKEN = 'pat-env'
      expect(loadToken(dir)).toBe('pat-env')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('bot credentials (ENH-0002)', () => {
  let savedAppId, savedInstId, savedPrivKey, savedPrivKeyPath

  beforeEach(() => {
    savedAppId = process.env.GITHUB_BOT_APP_ID
    savedInstId = process.env.GITHUB_BOT_INSTALLATION_ID
    savedPrivKey = process.env.GITHUB_BOT_PRIVATE_KEY
    savedPrivKeyPath = process.env.GITHUB_BOT_PRIVATE_KEY_PATH
    delete process.env.GITHUB_BOT_APP_ID
    delete process.env.GITHUB_BOT_INSTALLATION_ID
    delete process.env.GITHUB_BOT_PRIVATE_KEY
    delete process.env.GITHUB_BOT_PRIVATE_KEY_PATH
  })

  afterEach(() => {
    if (savedAppId === undefined) delete process.env.GITHUB_BOT_APP_ID
    else process.env.GITHUB_BOT_APP_ID = savedAppId
    if (savedInstId === undefined) delete process.env.GITHUB_BOT_INSTALLATION_ID
    else process.env.GITHUB_BOT_INSTALLATION_ID = savedInstId
    if (savedPrivKey === undefined) delete process.env.GITHUB_BOT_PRIVATE_KEY
    else process.env.GITHUB_BOT_PRIVATE_KEY = savedPrivKey
    if (savedPrivKeyPath === undefined) delete process.env.GITHUB_BOT_PRIVATE_KEY_PATH
    else process.env.GITHUB_BOT_PRIVATE_KEY_PATH = savedPrivKeyPath
  })

  it('loadBotAppId lê GITHUB_BOT_APP_ID de .env.github', () => {
    const dir = makeEnvDir({ '.env.github': 'GITHUB_BOT_APP_ID=12345\n' })
    try {
      expect(loadBotAppId(dir)).toBe('12345')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadBotAppId retorna null quando não configurado', () => {
    const dir = makeEnvDir({ '.env.github': 'GITHUB_TOKEN=tok\n' })
    try {
      expect(loadBotAppId(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadBotInstallationId lê GITHUB_BOT_INSTALLATION_ID de .env.github', () => {
    const dir = makeEnvDir({ '.env.github': 'GITHUB_BOT_INSTALLATION_ID=99\n' })
    try {
      expect(loadBotInstallationId(dir)).toBe('99')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadBotPrivateKey lê conteúdo inline de GITHUB_BOT_PRIVATE_KEY (decodifica \\n)', () => {
    const dir = makeEnvDir({
      '.env.github': 'GITHUB_BOT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\nABCD\\n-----END PRIVATE KEY-----\n',
    })
    try {
      const key = loadBotPrivateKey(dir)
      expect(key).toContain('-----BEGIN PRIVATE KEY-----')
      expect(key).toContain('\n')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadBotPrivateKey lê arquivo .pem via GITHUB_BOT_PRIVATE_KEY_PATH (caminho absoluto)', () => {
    const dir = makeEnvDir({})
    const pemPath = join(dir, 'app.pem')
    writeFileSync(pemPath, '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n')
    writeFileSync(join(dir, '.env.github'), `GITHUB_BOT_PRIVATE_KEY_PATH=${pemPath}\n`)
    try {
      const key = loadBotPrivateKey(dir)
      expect(key).toContain('-----BEGIN PRIVATE KEY-----')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadBotPrivateKey prefere PATH sobre inline', () => {
    const dir = makeEnvDir({})
    const pemPath = join(dir, 'app.pem')
    writeFileSync(pemPath, 'from-path')
    writeFileSync(
      join(dir, '.env.github'),
      `GITHUB_BOT_PRIVATE_KEY_PATH=${pemPath}\nGITHUB_BOT_PRIVATE_KEY=inline\n`
    )
    try {
      expect(loadBotPrivateKey(dir)).toBe('from-path')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadBotPrivateKey retorna null quando não configurado', () => {
    const dir = makeEnvDir({ '.env.github': 'GITHUB_TOKEN=tok\n' })
    try {
      expect(loadBotPrivateKey(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
