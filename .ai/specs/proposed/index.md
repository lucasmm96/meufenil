# Proposed — Catálogo de Evoluções Possíveis

**Última verificação:** 2026-09-02 (ENH-0004, FEAT-0017 e REF-0004 registradas — 16 propostas ativas, 6 arquivadas)

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
| [REF-0003](../archive/implemented/refactors/REF-0003-fluxos-automaticos-deterministicos.md) | REF | Fluxos automáticos determinísticos sem IA — resposta estática de Issues externas e gate de produção (Spec + Documentação) | IMPLEMENTED | #44 | W3 + W7 + ADR-0013 (PR #45, merge `b7090d4`) — 2026-08-24 |
| [DEBT-0005](../archive/implemented/technical-debt/DEBT-0005-lint-src-pendencias-eslint.md) | DEBT | Pendências de lint em src/ (57 erros pré-existentes) | IMPLEMENTED | #26 | lint verde + W1 restaurado (PR #42, merge `9c583ceb`) — 2026-08-23 |
| [DEBT-0006](../archive/implemented/technical-debt/DEBT-0006-restaurar-keepalive-dev.md) | DEBT | Restaurar keepalive do ambiente dev (regressão 879a6c0) | IMPLEMENTED | #40 | multi-alvo restaurado (PR #41, merge `4ac65fa`) — 2026-08-23 |
| [SEC-0001](security/SEC-0001-autorizacao-funcoes-consulta.md) | SEC | Autorização das funções de consulta sem verificação interna | PROPOSED | #14 | Fatos Fase 3 |
| [TEST-0002](testing/TEST-0002-suites-seguranca-policies.md) | TEST | Suítes de segurança para policies não cobertas | PROPOSED | #16 | GAP-007/012 |
| [TEST-0003](testing/TEST-0003-testes-server-side.md) | TEST | Testes server-side (edge functions, triggers, CLI) | PROPOSED | #17 | GAP-005/006/008 |
| [TEST-0004](testing/TEST-0004-testes-services-faltantes.md) | TEST | Completar testes de services faltantes | PROPOSED | #18 | GAP-004/009 |
| [TEST-0005](testing/TEST-0005-determinismo-testes-seguranca.md) | TEST | Determinismo dos testes de segurança | PROPOSED | #19 | GAP-011 + O-004 |
| [ENH-0004](enhancements/ENH-0004-modelo-identidade-referencias.md) | ENH | Modelo canônico e identidade imutável de referências | PROPOSED | #49 | Draft 001-auto-refresh-database (arquivado) — refinamento 2026-09-02 |
| [FEAT-0017](features/FEAT-0017-sincronizacao-referencias-anvisa.md) | FEAT | Sincronização controlada de referências com a fonte ANVISA/Power BI | PROPOSED | #50 | Draft 001-auto-refresh-database (arquivado) — refinamento 2026-09-02 |
| [REF-0004](refactors/REF-0004-automacao-residuo-gate-e-prevencao-tentativa-erro.md) | REF | Automação de limpeza de resíduo do gate + padrão preventivo para release | PROPOSED | #51 | W7 + ADR-0013 — descoberto no PR #48 (release v1.10.0), 2026-08-28 |

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
| [ENH-0003](../archive/implemented/enhancements/ENH-0003-historico-execucoes-seletor-paginacao.md) | ENH | Histórico das execuções com seletor de tamanho de página | IMPLEMENTED | #39 | PR #47 — merge `bbda6a1` (2026-08-27) |


## Como usar este catálogo

- Cada proposta descreve o estado ATUAL (com link para `../current/`) e o estado PROPOSTO — nunca confunda os dois.
- Nenhuma proposta é aprovada/priorizada por estar aqui. Fluxo de aprovação: revisão humana (decisão registrada na proposta: `Decision:` + `Approved by/on:`) → implementação (work branch + PR → `development`) → promoção/arquivamento conforme `../CONVENTIONS.md` seções 8, 10 e 18.
- Toda proposta possui Issue canônica no GitHub (ligação 1:1 via campo `Issue:` + label `spec:<ID>` + bloco `SPEC-PROJECTION`) e item no GitHub Project — ver `../CONVENTIONS.md` §18.
- Propostas agrupam múltiplas evidências (ex.: TEST-0001 consolida GAP-001/002/003/010). Mapeamento completo no relatório `.ai/.temp/analyses/26-catalogo-propostas.md`.
- Novas categorias SEC e TEST adicionadas nesta fase (extensão registrada — ver DEBT-0004).
