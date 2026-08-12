import '@testing-library/jest-dom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Carrega variáveis de ambiente do .env.development para que os testes
// de segurança (que precisam de DATABASE_URL) funcionem sem configuração extra.
// As variáveis são carregadas apenas no processo Node.js (contexto do vitest),
// NUNCA expostas ao browser. Variáveis VITE_* já são carregadas automaticamente.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname)

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

// Carrega .env.development (contém SUPABASE_DATABASE_URL, etc.)
loadEnvFile(path.join(rootDir, '.env.development'))
// Também carrega .env (base) se existir
loadEnvFile(path.join(rootDir, '.env'))

