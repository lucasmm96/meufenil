// Núcleo testável de test-summary: funções puras sem dependências CLI.
// Importado por test-summary.js (entry point) e test-summary.test.js (testes).

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
