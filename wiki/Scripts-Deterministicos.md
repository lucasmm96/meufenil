# Scripts Determinísticos

Scripts em `scripts/` que executam lógica de projeto sem IA — seguindo ADR-0013.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Convenções de Tooling](Convencoes-Tooling)

---

## Princípio (ADR-0013)

Toda automação (GitHub Actions, scripts de CI/CD) é **100% determinística, sem IA**. Claude Code é invocado manualmente pelo dev na sessão interativa local. Scripts existem para tarefas que são puramente computacionais ou que exigem resultados reprodutíveis — sem síntese, sem julgamento.

---

## scripts/spec-github/

Scripts para sincronização do Specification System com o GitHub.

| Script | npm run | Propósito |
|---|---|---|
| `sync.js` | `spec:github:sync` / `:dry` | Sincroniza Specs → Issues (cria/atualiza Issues canônicas) |
| `project-sync.js` | `spec:project:sync` / `:dry` | Sincroniza Status do Project com estado das Specs |
| `release-gate.js` | `spec:github:gate` / `:dry` | Gate de release: verifica se todas as condições estão satisfeitas |
| `pre-release-check.js` | _(sem npm run)_ | Verificações pré-release detalhadas |
| `release-verify.js` | _(sem npm run)_ | Verificação pós-release (rastreabilidade W6) |
| `reconcile.js` | _(sem npm run)_ | Reconciliação Spec ↔ GitHub (detecção de drift) |
| `issue-responder.js` | _(sem npm run)_ | Resposta estática a Issues externas (workflow W3) |

**Dry-run:** todos os scripts de sync e gate têm variante `:dry` — executam a lógica e reportam o que fariam sem fazer alterações. Sempre use o dry-run antes do real.

### Uso típico

```bash
# Ver o que seria sincronizado
npm run spec:github:sync:dry

# Executar o sync real (após confirmar o dry-run)
npm run spec:github:sync

# Verificar se a release pode prosseguir
npm run spec:github:gate:dry
```

Os slash commands `/sync-specs` e `/check-release` encapsulam esses workflows — ver [Skills e Commands](Skills-e-Commands).

---

## scripts/cli/

CLI interna para operações Supabase.

| Script | npm run | Propósito |
|---|---|---|
| `cli/index.js` | `cli` | CLI interna — gestão de operações Supabase com RLS-awareness |

---

## scripts/wiki-precheck.js

Script de hash-based precheck para a geração incremental da wiki.

**O que faz:**
1. Lê `wiki/.wiki-state.json` (estado anterior, se existir).
2. Para cada página wiki, calcula o hash SHA-256 combinado dos arquivos fonte relevantes.
3. Compara com o estado anterior.
4. Escreve `wiki/.wiki-precheck.json` com: `{ "Page.md": { changed: bool, hash, prevHash, sources } }`.
5. Imprime um resumo: páginas para regenerar vs. preservar.

**Quando usar:** antes de invocar o `wiki-documenter` para identificar quais páginas precisam regeneração sem consumir tokens do agent para isso.

```bash
node scripts/wiki-precheck.js
```

**Output esperado:**
```
wiki-precheck: 2 página(s) para regenerar, 5 inalterada(s)
  Regenerar: Funcionalidades.md, Referencias-Tecnicas.md
  Preservar: Home.md, Guia-Usuario.md, Guia-Desenvolvedor.md, Arquitetura.md, _Sidebar.md

Relatório salvo em wiki/.wiki-precheck.json
```

---

## scripts/apply-supabase-migrations.sh

Script shell para aplicação de migrations no banco de dados Supabase.

**Propósito:** aplicar migrations locais ao ambiente Supabase usando o mecanismo oficial. Nunca invente outro mecanismo de migration.

**Quando usar:** ao aplicar novas migrations criadas em `supabase/migrations/`.

---

## Regra de uso

Use scripts quando a tarefa for **puramente computacional** (sync, hash, gate, verificação). Use agents de IA quando a tarefa exigir **síntese, julgamento, redação ou análise contextualizada**. Quando houver dúvida: prefira o script determinístico e consulte o agent apenas para interpretação do resultado.
