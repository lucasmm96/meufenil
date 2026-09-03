#!/usr/bin/env node
// pre-release-check.js — Script de verificação local antes do push (AC3)
// Executa validação da tabela de rastreabilidade §23 e requisitos de documentação
// Uso: node scripts/spec-github/pre-release-check.js --body-file <md> [--pr N]

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { verifyTraceability } from './lib/traceability-verify.js';

// Parse command line arguments
const args = process.argv.slice(2);
const bodyFileArg = args.find(arg => arg.startsWith('--body-file=')) ||
                  args.find(arg => arg.startsWith('--body-file '));
if (!bodyFileArg) {
  console.error('Erro: --body-file é obrigatório');
  process.exit(1);
}
const bodyFilePath = bodyFileArg.includes('=')
  ? bodyFileArg.split('=')[1]
  : bodyFileArg.split(' ')[1];

// Resolve path and read body
const bodyUrl = pathToFileURL(bodyFilePath);
const body = readFileSync(bodyUrl, 'utf8');

// Run local validation (no GitHub API)
const run = () => {
  // Mock git commands for local execution
  try {
    // Simulate git tag lookup (for last release tag)
    return `v1.9.1\n`; // Mocked response for resolveLastTag
  } catch (e) {
    return '';
  }
};

const result = await verifyTraceability({
  body,
  baseDir: join(dirname(bodyUrl), '..', '..'), // REPO_ROOT equivalent
  rest: null,
  run
});

// Generate report
console.log('=== Pre-release Check Report ===');
console.log(`Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Action: ${result.trace?.action || 'N/A'}`);
if (result.docs) {
  console.log(`Documentation: ${result.docs.ok ? '✅ OK' : '❌ MISSING'}`);
  console.log(`Last release tag: ${result.docs.lastTag || 'N/A'}`);
}
console.log('--- Checks ---');
if (result.trace?.checks) {
  result.trace.checks.forEach(check => {
    const status = check.ok ? '✅' : '❌';
    console.log(`${status} ${check.spec} - ${check.note || 'No note'}`);
  });
} else {
  console.log('❌ No traceability checks found (no table in PR body)');
}
console.log('==============================');
process.exit(result.pass ? 0 : 1);