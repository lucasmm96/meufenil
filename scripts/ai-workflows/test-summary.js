#!/usr/bin/env node
// S-006 — test-summary: executa vitest com reporter JSON e retorna resumo estruturado
// Output: JSON em stdout, erros em stderr, exit 0 (passed) / 1 (failed)
// Invocação: node scripts/ai-workflows/test-summary.js [--coverage]

import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')

function parseArgs(argv) {
  return { coverage: argv.includes('--coverage') }
}

export function inferSkipReason(name) {
  if (/SUPABASE_SERVICE_ROLE_KEY/i.test(name)) return 'SUPABASE_SERVICE_ROLE_KEY ausente'
  if (/supabase|database|db/i.test(name)) return 'variável de banco ausente'
  return 'condição de skip não identificada'
}

export function parseVitestReport(report) {
  const allTests = (report.testResults ?? []).flatMap((suite) => suite.assertionResults ?? [])

  const failed = allTests
    .filter((t) => t.status === 'failed')
    .map((t) => ({
      name: t.fullName ?? t.title,
      file: t.ancestorTitles?.[0] ?? null,
      error: t.failureMessages?.[0]?.split('\n')[0] ?? null,
    }))

  const skipped = allTests
    .filter((t) => t.status === 'pending' || t.status === 'todo')
    .map((t) => ({
      name: t.fullName ?? t.title,
      reason: inferSkipReason(t.fullName ?? ''),
    }))

  const total = allTests.length
  const passedCount = allTests.filter((t) => t.status === 'passed').length
  const failedCount = failed.length
  const skippedCount = skipped.length
  const duration = (report.startTime && report.endTime)
    ? Math.round((report.endTime - report.startTime) / 100) / 10
    : null

  return {
    summary: { total, passed: passedCount, failed: failedCount, skipped: skippedCount },
    failed,
    skipped,
    duration,
    passed: failedCount === 0,
    generatedAt: new Date().toISOString(),
  }
}

function run(argv) {
  const { coverage } = parseArgs(argv)
  const coverageFlag = coverage ? ' --coverage' : ''
  const cmd = `node_modules/.bin/vitest run --reporter=json${coverageFlag}`

  let raw
  try {
    raw = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (err) {
    raw = err.stdout ?? ''
    if (!raw.trim()) {
      process.stderr.write(`test-summary: vitest falhou sem output JSON\n${err.stderr ?? ''}\n`)
      process.exit(1)
    }
  }

  let report
  try {
    report = JSON.parse(raw)
  } catch {
    process.stderr.write(`test-summary: output do vitest não é JSON válido\n`)
    process.exit(1)
  }

  return parseVitestReport(report)
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === new URL(process.argv[1], 'file:').pathname

if (isMain) {
  try {
    const result = run(process.argv.slice(2))
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    if (!result.passed) process.exit(1)
  } catch (err) {
    process.stderr.write(`test-summary: ${err.message}\n`)
    process.exit(1)
  }
}
