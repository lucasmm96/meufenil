# Proposed — Catálogo de Evoluções Possíveis

**Última verificação:** 2026-08-15 (DEBT-0003)

> ⚠️ Este diretório contém POSSIBILIDADES FUTURAS. NADA aqui é comportamento atual, decisão tomada ou plano comprometido. Status inicial de toda proposta: **PROPOSED**. O estado atual do sistema está documentado exclusivamente em `../current/`.
>
> **Regra de arquivamento (ADR-0012, 2026-08-16):** `proposed/` contém SOMENTE propostas ativas. Propostas em estado terminal (IMPLEMENTED/REJECTED/SUPERSEDED) serão movidas para `../archive/<estado>/<categoria>/` durante o retrofit (Fase 8 do ecossistema GitHub). Cada proposta possui uma Issue canônica no GitHub (coluna `Issue`; preenchida no retrofit — campo `Issue:` no arquivo + label `spec:<ID>` na Issue).

## Catálogo

| ID | Type | Title | Status | Issue | Source |
|---|---|---|---|---|---|
| [FEAT-0001](features/FEAT-0001-atribuicao-papel-admin.md) | FEAT | Fluxo de atribuição de papel admin | PROPOSED | — (retrofit) | U-7.2; R-003 (análise 23) |
| [FEAT-0002](features/FEAT-0002-exportar-historico-csv.md) | FEAT | Exportar o histórico de medições em CSV | PROPOSED | — | External #27 (piloto F6) — 2026-08-17 |
| [ENH-0001](enhancements/ENH-0001-pwa-offline.md) | ENH | PWA offline / service worker | PROPOSED | — (retrofit) | FEAT-0014; U-5.2 |
| [ENH-0002](enhancements/ENH-0002-identidade-bot-claude-prs.md) | ENH | Identidade de bot para PRs criados pelo Claude | PROPOSED | #21 | PRs #4/#5/#20 (autoria `lucasmm96`) — decisão do autor 2026-08-16 |
| [REF-0001](refactors/REF-0001-modal-concessao-duplicado.md) | REF | Consolidar modal de concessão duplicado | PROPOSED | — (retrofit) | Divergência Fase 5 |
| [REF-0002](refactors/REF-0002-rpcs-orfas-dashboard.md) | REF | Destino das RPCs órfãs de dashboard | PROPOSED | — (retrofit) | Fase 4; O-003 (análise 25) |
| [DEBT-0001](technical-debt/DEBT-0001-ddl-nao-versionado.md) | DEBT | Versionar objetos sem DDL | IMPLEMENTED | — (retrofit) | Fase 2; O-002 (análise 25) — migration 20260814000000 (dev e prod) |
| [DEBT-0002](technical-debt/DEBT-0002-limite-diario-default-duplicado.md) | DEBT | Limite diário default duplicado (500 × 150) | IMPLEMENTED | — (retrofit) | R-002 (análise 23); BR-025 — migration 20260815000000 (dev e prod) |
| [DEBT-0003](technical-debt/DEBT-0003-atualizar-readme.md) | DEBT | Atualizar README (documentation drift) | IMPLEMENTED | — (retrofit) | Drift Fases 4 e 7 — README.md corrigido (2026-08-15) |
| [DEBT-0004](technical-debt/DEBT-0004-reconciliar-templates.md) | DEBT | Reconciliar templates e convenções do Specification System | IMPLEMENTED | — (retrofit) | O-001/R-004/R-001 (análises 23–25) — Fase 12 |
| [DEBT-0005](technical-debt/DEBT-0005-lint-src-pendencias-eslint.md) | DEBT | Pendências de lint em src/ (57 erros pré-existentes) | PROPOSED | — | CI W1 (PR #25, run 32089115404) — 2026-08-17 |
| [SEC-0001](security/SEC-0001-autorizacao-funcoes-consulta.md) | SEC | Autorização das funções de consulta sem verificação interna | PROPOSED | — (retrofit) | Fatos Fase 3 |
| [TEST-0001](testing/TEST-0001-testes-paginas-componentes.md) | TEST | Cobertura de testes de páginas e componentes | IMPLEMENTED | — (retrofit) | GAP-001/002/003/010 — testes de Perfil, Referencias, Dashboard, AdicionarRegistro e ConsentimentoLGPD (2026-08-15) |
| [TEST-0002](testing/TEST-0002-suites-seguranca-policies.md) | TEST | Suítes de segurança para policies não cobertas | PROPOSED | — (retrofit) | GAP-007/012 |
| [TEST-0003](testing/TEST-0003-testes-server-side.md) | TEST | Testes server-side (edge functions, triggers, CLI) | PROPOSED | — (retrofit) | GAP-005/006/008 |
| [TEST-0004](testing/TEST-0004-testes-services-faltantes.md) | TEST | Completar testes de services faltantes | PROPOSED | — (retrofit) | GAP-004/009 |
| [TEST-0005](testing/TEST-0005-determinismo-testes-seguranca.md) | TEST | Determinismo dos testes de segurança | PROPOSED | — (retrofit) | GAP-011 + O-004 |

## Como usar este catálogo

- Cada proposta descreve o estado ATUAL (com link para `../current/`) e o estado PROPOSTO — nunca confunda os dois.
- Nenhuma proposta é aprovada/priorizada por estar aqui. Fluxo de aprovação: revisão humana (decisão registrada na proposta: `Decision:` + `Approved by/on:`) → implementação (work branch + PR → `development`) → promoção/arquivamento conforme `../CONVENTIONS.md` seções 8, 10 e 18.
- Toda proposta possui Issue canônica no GitHub (ligação 1:1 via campo `Issue:` + label `spec:<ID>` + bloco `SPEC-PROJECTION`) e item no GitHub Project — ver `../CONVENTIONS.md` §18.
- Propostas agrupam múltiplas evidências (ex.: TEST-0001 consolida GAP-001/002/003/010). Mapeamento completo no relatório `.ai/.temp/analyses/26-catalogo-propostas.md`.
- Novas categorias SEC e TEST adicionadas nesta fase (extensão registrada — ver DEBT-0004).
