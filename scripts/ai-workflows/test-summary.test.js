import { describe, expect, it } from 'vitest'
import { parseVitestReport, inferSkipReason } from './test-summary.js'

const MOCK_REPORT_ALL_PASSED = {
  startTime: 1000,
  endTime: 13400,
  testResults: [
    {
      assertionResults: [
        { fullName: 'suite > test 1', status: 'passed' },
        { fullName: 'suite > test 2', status: 'passed' },
        { fullName: 'suite > test 3', status: 'passed', ancestorTitles: ['suite'] },
      ],
    },
  ],
}

const MOCK_REPORT_WITH_FAILURES = {
  startTime: 1000,
  endTime: 5000,
  testResults: [
    {
      assertionResults: [
        { fullName: 'suite > test ok', status: 'passed' },
        {
          fullName: 'suite > test falhou',
          status: 'failed',
          ancestorTitles: ['suite'],
          failureMessages: ['AssertionError: expected 1 to equal 2\n  at ...'],
        },
      ],
    },
  ],
}

const MOCK_REPORT_WITH_SKIP = {
  startTime: 1000,
  endTime: 3000,
  testResults: [
    {
      assertionResults: [
        { fullName: 'security > RLS > requires SUPABASE_SERVICE_ROLE_KEY', status: 'pending' },
        { fullName: 'suite > test ok', status: 'passed' },
      ],
    },
  ],
}

describe('parseVitestReport — happy path (todos passaram)', () => {
  it('passed: true quando não há falhas', () => {
    const result = parseVitestReport(MOCK_REPORT_ALL_PASSED)
    expect(result.passed).toBe(true)
  })

  it('summary.total = 3, passed = 3, failed = 0', () => {
    const result = parseVitestReport(MOCK_REPORT_ALL_PASSED)
    expect(result.summary.total).toBe(3)
    expect(result.summary.passed).toBe(3)
    expect(result.summary.failed).toBe(0)
    expect(result.summary.skipped).toBe(0)
  })

  it('failed e skipped são arrays vazios', () => {
    const result = parseVitestReport(MOCK_REPORT_ALL_PASSED)
    expect(result.failed).toEqual([])
    expect(result.skipped).toEqual([])
  })

  it('duration é número calculado a partir de startTime/endTime', () => {
    const result = parseVitestReport(MOCK_REPORT_ALL_PASSED)
    expect(result.duration).toBe(12.4)
  })

  it('generatedAt é string ISO', () => {
    const result = parseVitestReport(MOCK_REPORT_ALL_PASSED)
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('parseVitestReport — error path (com falhas)', () => {
  it('passed: false quando há falhas', () => {
    const result = parseVitestReport(MOCK_REPORT_WITH_FAILURES)
    expect(result.passed).toBe(false)
  })

  it('failed contém nome e mensagem de erro resumida', () => {
    const result = parseVitestReport(MOCK_REPORT_WITH_FAILURES)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].name).toBe('suite > test falhou')
    expect(result.failed[0].error).toContain('AssertionError')
  })

  it('summary.failed = 1', () => {
    const result = parseVitestReport(MOCK_REPORT_WITH_FAILURES)
    expect(result.summary.failed).toBe(1)
  })
})

describe('parseVitestReport — com skips', () => {
  it('skipped contém testes com status pending', () => {
    const result = parseVitestReport(MOCK_REPORT_WITH_SKIP)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].name).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(result.skipped[0].reason).toBe('SUPABASE_SERVICE_ROLE_KEY ausente')
  })

  it('summary.skipped = 1', () => {
    const result = parseVitestReport(MOCK_REPORT_WITH_SKIP)
    expect(result.summary.skipped).toBe(1)
  })
})

describe('inferSkipReason', () => {
  it('detecta SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(inferSkipReason('security > requires SUPABASE_SERVICE_ROLE_KEY')).toBe(
      'SUPABASE_SERVICE_ROLE_KEY ausente'
    )
  })

  it('detecta referências a banco', () => {
    expect(inferSkipReason('supabase connection test')).toBe('variável de banco ausente')
  })

  it('retorna razão genérica para skip desconhecido', () => {
    expect(inferSkipReason('some random test')).toBe('condição de skip não identificada')
  })
})

describe('parseVitestReport — relatório vazio', () => {
  it('aceita testResults vazio sem lançar', () => {
    const result = parseVitestReport({ testResults: [] })
    expect(result.summary.total).toBe(0)
    expect(result.passed).toBe(true)
  })

  it('aceita relatório sem startTime/endTime (duration null)', () => {
    const result = parseVitestReport({ testResults: [] })
    expect(result.duration).toBeNull()
  })
})
