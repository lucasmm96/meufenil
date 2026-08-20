# Proposed — Catálogo de Evoluções Possíveis

**Última verificação:** 2026-08-19 (retrofit F8 — todas as 17 propostas verificadas contra o código)

> ⚠️ Este diretório contém POSSIBILIDADES FUTURAS. NADA aqui é comportamento atual, decisão tomada ou plano comprometido. Status inicial de toda proposta: **PROPOSED**. O estado atual do sistema está documentado exclusivamente em `../current/`.
>
> **Regra de arquivamento (ADR-0012, 2026-08-16):** `proposed/` contém SOMENTE propostas ativas. Propostas em estado terminal (IMPLEMENTED/REJECTED/SUPERSEDED) são movidas para `../archive/<estado>/<categoria>/`. Cada proposta possui uma Issue canônica no GitHub (coluna `Issue` — campo `Issue:` no arquivo + label `spec:<ID>` na Issue) e um item no GitHub Project (Status derivado, CONVENTIONS §18).

## Catálogo

| ID | Type | Title | Status | Issue | Source |
|---|---|---|---|---|---|
| [FEAT-0015](features/FEAT-0015-atribuicao-papel-admin.md) | FEAT | Fluxo de atribuição de papel admin | PROPOSED | #11 | U-7.2; R-003 (análise 23) |
| [FEAT-0002](features/FEAT-0002-exportar-historico-csv.md) | FEAT | Exportar o histórico de medições em CSV | PROPOSED | #31 | External #27 (piloto F6) — 2026-08-17 |
| [ENH-0001](enhancements/ENH-0001-pwa-offline.md) | ENH | PWA offline / service worker | PROPOSED | #10 | FEAT-0014; U-5.2 |
| [ENH-0002](enhancements/ENH-0002-identidade-bot-claude-prs.md) | ENH | Identidade de bot para PRs criados pelo Claude | PROPOSED | #21 | PRs #4/#5/#20 (autoria `lucasmm96`) — decisão do autor 2026-08-16 |
| [REF-0001](refactors/REF-0001-modal-concessao-duplicado.md) | REF | Consolidar modal de concessão duplicado | PROPOSED | #12 | Divergência Fase 5 |
| [REF-0002](refactors/REF-0002-rpcs-orfas-dashboard.md) | REF | Destino das RPCs órfãs de dashboard | PROPOSED | #13 | Fase 4; O-003 (análise 25) |
| [DEBT-0005](technical-debt/DEBT-0005-lint-src-pendencias-eslint.md) | DEBT | Pendências de lint em src/ (57 erros pré-existentes) | PROPOSED | #26 | CI W1 (PR #25, run 32089115404) — 2026-08-17 |
| [SEC-0001](security/SEC-0001-autorizacao-funcoes-consulta.md) | SEC | Autorização das funções de consulta sem verificação interna | PROPOSED | #14 | Fatos Fase 3 |
| [TEST-0002](testing/TEST-0002-suites-seguranca-policies.md) | TEST | Suítes de segurança para policies não cobertas | PROPOSED | #16 | GAP-007/012 |
| [TEST-0003](testing/TEST-0003-testes-server-side.md) | TEST | Testes server-side (edge functions, triggers, CLI) | PROPOSED | #17 | GAP-005/006/008 |
| [TEST-0004](testing/TEST-0004-testes-services-faltantes.md) | TEST | Completar testes de services faltantes | PROPOSED | #18 | GAP-004/009 |
| [TEST-0005](testing/TEST-0005-determinismo-testes-seguranca.md) | TEST | Determinismo dos testes de segurança | PROPOSED | #19 | GAP-011 + O-004 |

## Arquivadas

Propostas em estado terminal, movidas de `proposed/` para `../archive/implemented/<categoria>/` no retrofit (Fase 8, 2026-08-19). Linhas nunca são apagadas — histórico do catálogo. `Implemented Through` completo com evidência no arquivo.

| ID | Type | Title | Status | Issue | Implemented Through (resumo) |
|---|---|---|---|---|---|
| [DEBT-0001](../archive/implemented/technical-debt/DEBT-0001-ddl-nao-versionado.md) | DEBT | Versionar objetos sem DDL | IMPLEMENTED | #6 | migration `20260814000000` (dev e prod) — commits `f1d4af5`/`a4d3017` |
| [DEBT-0002](../archive/implemented/technical-debt/DEBT-0002-limite-diario-default-duplicado.md) | DEBT | Limite diário default duplicado (500 × 150) | IMPLEMENTED | #7 | migration `20260815000000` (dev e prod) — commit `5e6467b` |
| [DEBT-0003](../archive/implemented/technical-debt/DEBT-0003-atualizar-readme.md) | DEBT | Atualizar README (documentation drift) | IMPLEMENTED | #8 | README.md corrigido (2026-08-15) — commit `0eb2e9b` |
| [DEBT-0004](../archive/implemented/technical-debt/DEBT-0004-reconciliar-templates.md) | DEBT | Reconciliar templates e convenções do Specification System | IMPLEMENTED | #9 | Fase 12 — commits `683ed63`/`fb67c5e`/`1180de8` |
| [TEST-0001](../archive/implemented/testing/TEST-0001-testes-paginas-componentes.md) | TEST | Cobertura de testes de páginas e componentes | IMPLEMENTED | #15 | 69 testes novos (suíte 128 → 197) — commit `6645b1a` |
| [FEAT-0016](../archive/implemented/features/FEAT-0016-geracao-automatica-de-documentacao-via-agente-wiki-documenter.md) | FEAT | Geração automática da documentação pública via agente wiki-documenter | IMPLEMENTED | #36 | PR #37 — merge `cd9b3fa` (2026-08-20) |


## Como usar este catálogo

- Cada proposta descreve o estado ATUAL (com link para `../current/`) e o estado PROPOSTO — nunca confunda os dois.
- Nenhuma proposta é aprovada/priorizada por estar aqui. Fluxo de aprovação: revisão humana (decisão registrada na proposta: `Decision:` + `Approved by/on:`) → implementação (work branch + PR → `development`) → promoção/arquivamento conforme `../CONVENTIONS.md` seções 8, 10 e 18.
- Toda proposta possui Issue canônica no GitHub (ligação 1:1 via campo `Issue:` + label `spec:<ID>` + bloco `SPEC-PROJECTION`) e item no GitHub Project — ver `../CONVENTIONS.md` §18.
- Propostas agrupam múltiplas evidências (ex.: TEST-0001 consolida GAP-001/002/003/010). Mapeamento completo no relatório `.ai/.temp/analyses/26-catalogo-propostas.md`.
- Novas categorias SEC e TEST adicionadas nesta fase (extensão registrada — ver DEBT-0004).
