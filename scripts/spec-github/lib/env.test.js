import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadToken } from './env.js'

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
