#!/usr/bin/env node
// S-007 — spec-locate: localiza specs por identificador parcial (ex: "enh2", "feat15", "ref")
// Output: JSON em stdout, erros em stderr, exit 0 (≥1 match) / 1 (sem match ou erro)
// Invocação: node scripts/ai-workflows/spec-locate.js <query>
//            node scripts/ai-workflows/spec-locate.js --spec enh2

import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listSpecs } from '../spec-github/lib/specs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const SPECS_DIR = join(REPO_ROOT, '.ai', 'specs')

const PREFIX_TO_CATEGORY = {
  FEAT: 'features',
  ENH: 'enhancements',
  REF: 'refactors',
  DEBT: 'technical-debt',
  SEC: 'security',
  TEST: 'testing',
}

function parseArgs(argv) {
  const specIdx = argv.indexOf('--spec')
  const query = specIdx >= 0 ? argv[specIdx + 1] : argv[0]
  if (!query) {
    process.stderr.write('Uso: node scripts/ai-workflows/spec-locate.js <query>\n')
    process.stderr.write('Exemplos: enh2  enh-2  ENH-0002  feat15  ref  sec\n')
    process.exit(1)
  }
  return { query }
}

function normalize(query) {
  const match = query.trim().toUpperCase().match(/^([A-Z]+)[-]?(\d+)?$/)
  if (!match) return null
  const [, prefix, digits] = match
  const id = digits ? `${prefix}-${digits.padStart(4, '0')}` : null
  return { prefix, id }
}

function repoRelative(absolutePath) {
  return absolutePath
    .replace(/\\/g, '/')
    .replace(REPO_ROOT.replace(/\\/g, '/') + '/', '')
}

function run(argv) {
  const { query } = parseArgs(argv)
  const parsed = normalize(query)

  if (!parsed) {
    process.stderr.write(`spec-locate: formato de query inválido: "${query}"\n`)
    process.stderr.write('Formatos aceitos: enh2, ENH-0002, feat15, ref\n')
    process.exit(1)
  }

  const { prefix, id } = parsed
  const allSpecs = listSpecs(SPECS_DIR)

  let matches
  if (id) {
    matches = allSpecs.filter((s) => s.id === id)
    if (matches.length === 0) {
      matches = allSpecs.filter((s) => s.id.startsWith(id))
    }
  } else {
    const category = PREFIX_TO_CATEGORY[prefix]
    matches = category
      ? allSpecs.filter((s) => s.category === category)
      : allSpecs.filter((s) => s.id.startsWith(prefix + '-'))
  }

  return {
    query,
    normalized: id ?? prefix,
    matches: matches.map((s) => ({
      id: s.id,
      repoPath: repoRelative(s.filePath),
      area: s.area,
      status: s.status,
      title: s.title,
    })),
    count: matches.length,
    generatedAt: new Date().toISOString(),
  }
}

try {
  const result = run(process.argv.slice(2))
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (result.count === 0) process.exit(1)
} catch (err) {
  process.stderr.write(`spec-locate: ${err.message}\n`)
  process.exit(1)
}
