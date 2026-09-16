#!/usr/bin/env node
/**
 * wiki-precheck.js — Deterministic hash-computation for wiki incremental generation.
 *
 * Reads wiki/.wiki-state.json (previous state), computes SHA-256 hashes of source
 * files for each wiki page, and writes wiki/.wiki-precheck.json:
 *   { "Page.md": { changed: bool, hash: string, prevHash: string|null, sources: [] } }
 *
 * Used by wiki-documenter to decide which pages need regeneration without requiring
 * an LLM invocation for the hash-computation step.
 *
 * Usage: node scripts/wiki-precheck.js
 */

'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const WIKI_STATE_PATH = 'wiki/.wiki-state.json';
const WIKI_PRECHECK_PATH = 'wiki/.wiki-precheck.json';

// Source globs for each wiki page (directories → all .md/.ts/.tsx/.sql files in them)
const PAGE_SOURCES = {
  'Home.md': [
    '.ai/specs/current/system-map.md',
    '.ai/specs/current/domain/business-rules.md',
    '.ai/specs/current/domain/traceability.md',
  ],
  'Guia-Usuario.md': [
    '.ai/specs/current/features',
    '.ai/specs/current/product',
    '.ai/specs/current/domain',
  ],
  'Guia-Desenvolvedor.md': [
    '.ai/specs/current/features',
    '.ai/specs/current/architecture',
    '.ai/specs/current/frontend',
    '.ai/specs/current/backend',
    '.ai/specs/current/database',
    '.ai/specs/current/testing',
  ],
  'Arquitetura.md': [
    '.ai/specs/current/architecture',
    '.ai/specs/current/security',
  ],
  'Funcionalidades.md': [
    '.ai/specs/current/features',
    '.ai/specs/proposed/features',
  ],
  'Referencias-Tecnicas.md': [
    '.ai/specs/current/database',
    '.ai/specs/current/backend',
  ],
  '_Sidebar.md': ['wiki'],
};

const SOURCE_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.sql', '.json']);

function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return 'MISSING';
  }
}

function collectFiles(sourcePath) {
  const absPath = path.resolve(sourcePath);
  try {
    const stat = fs.statSync(absPath);
    if (stat.isFile()) return [absPath];
    if (stat.isDirectory()) {
      return fs.readdirSync(absPath)
        .filter(f => SOURCE_EXTENSIONS.has(path.extname(f)))
        .map(f => path.join(absPath, f))
        .filter(f => {
          try { return fs.statSync(f).isFile(); } catch { return false; }
        });
    }
  } catch {
    // source path doesn't exist — silently skip
  }
  return [];
}

function computePageHash(sources) {
  const allFiles = sources.flatMap(collectFiles).sort();
  const combined = allFiles
    .map(f => `${f}:${hashFile(f)}`)
    .join('\n');
  return {
    hash: crypto.createHash('sha256').update(combined).digest('hex'),
    fileCount: allFiles.length,
  };
}

function main() {
  let prevState = {};
  try {
    prevState = JSON.parse(fs.readFileSync(WIKI_STATE_PATH, 'utf8'));
  } catch {
    // no previous state — all pages will be flagged as changed
  }

  const precheck = {};
  for (const [page, sources] of Object.entries(PAGE_SOURCES)) {
    const { hash, fileCount } = computePageHash(sources);
    const prevHash = prevState[page]?.hash ?? null;
    precheck[page] = {
      changed: hash !== prevHash,
      hash,
      prevHash,
      fileCount,
      sources,
    };
  }

  fs.mkdirSync('wiki', { recursive: true });
  fs.writeFileSync(WIKI_PRECHECK_PATH, JSON.stringify(precheck, null, 2) + '\n');

  const changed = Object.entries(precheck).filter(([, v]) => v.changed);
  const unchanged = Object.entries(precheck).filter(([, v]) => !v.changed);

  console.log(`\nwiki-precheck: ${changed.length} página(s) para regenerar, ${unchanged.length} inalterada(s)`);
  if (changed.length) {
    console.log('  Regenerar:', changed.map(([p]) => p).join(', '));
  }
  if (unchanged.length) {
    console.log('  Preservar:', unchanged.map(([p]) => p).join(', '));
  }
  console.log(`\nRelatório salvo em ${WIKI_PRECHECK_PATH}\n`);
}

main();
