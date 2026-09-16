# Feature Spec: Sincronização controlada de referências com a fonte ANVISA/Power BI

**ID:** FEAT-0017
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-09-14 (BR-044 revisada por decisão do usuário — duplicidade conflitante na origem rejeita o par inteiro, não invalida a sync; precisão decimal do fenil — até 2 casas em toda a cadeia: validação da origem, `chaveFenil`, coluna `numeric(10,2)` e input do modal)

## Purpose

Mecanismo recorrente, controlado e auditável de sincronização do conjunto `is_global = true` de `referencias` com a origem (relatório Power BI associado à ANVISA): extrai, valida, compara, aplica mudanças seguras automaticamente (apenas em sync confiável), abre curadoria humana para mudanças substantivas, tira snapshot/backup por execução e permite rollback seletivo e restauração excepcional auditados. Entregue nos marcos M1–M6: schema (M1), extração/validação/snapshot/backup (M2), motor puro (M3), aplicação + curadoria (M4), rollback/restauração (M5), seed de bootstrap + UI admin (M6).

## Actors

- Vercel Cron (produtor agendado — semanal); Admin (UI de sincronizações/curadoria/recuperação)
- Ator Sistema (`sistema@meufenil.local` — identidade real no Supabase Auth, provisionada por `scripts/provisionar-ator-sistema.js`): autor das criações/arquivamentos automáticos
- service_role (rota `/api/referencias-sync`)

## Preconditions

- Modelo canônico do ENH-0004 aplicado (coluna `marca`; identidade `nome+marca+fenil_mg_por_100g`) `[CONFIRMED: migrations, código]`
- Ator Sistema provisionado no ambiente antes da 1ª sync com criações `[CONFIRMED: migration 20260906000000 — fail-high]`

## Main Flow

1. Gatilho: cron semanal (`vercel.json` — `/api/referencias-sync`, `0 12 * * 1`) ou execução manual sob demanda; rota registra a sync como linha `running` em `referencia_syncs` (single-flight: segunda simultânea viola índice parcial e responde 409) + evento `sync_started` `[CONFIRMED: configuration — vercel.json; migration 20260905000000:90-92]`.
2. Extração (estágio 2): decode/extract da origem em `src/shared/powerbi/` (módulos portados do `powerbi-export` — B1) `[CONFIRMED: code]`.
3. Validação (estágio 3): checks estruturais/tipos/duplicidades. Estrutura inesperada ou nenhuma linha válida restante → abort, status `origin_invalid`, nada aplicado. Anomalias de campo/tipo são rejeições **individuais**: a linha sai do payload (reportada com linha/nome/motivo no evento `validation`) e o sync segue com as válidas; marca nula = produto sem marca declarada → entra como `''`. Duplicidade conflitante (mesmo nome+marca, fenil divergente — BR-044 revisada 2026-09-14) rejeita **todas as linhas do grupo** (par inteiro — nenhum valor arbitrário vence; o produto fica fora até a origem estabilizar); não invalida a sync `[CONFIRMED: code — validate.ts; migration — rota]`.
4. Snapshot (estágio 4): payload decodificado **das linhas válidas** gravado em `referencia_snapshots` com sha256 e contagem + evento `snapshot_created` `[CONFIRMED: code]`.
5. Backup (estágio 5): estado pré-aplicação de `referencias` (globais) em `referencia_backups` com sha256 e contagem + evento `backup_created` `[CONFIRMED: code]`.
6. Comparação e aplicação (estágios 6–7, motor M3 + RPC M4): `canonical.ts`/`compare.ts` (matching determinístico; `derivarModoSync` decide `bootstrap` × `pos_bootstrap`) geram o plano (versão 1) e `aplicar_sync_referencias` (RPC, service_role) aplica: criações/arquivamentos automáticos (só pós-bootstrap confiável), pendências de curadoria 1:1, seed `pre_sync_inativa` quando `modo = 'bootstrap'` — tudo na mesma transação, com guardas de estado (mudou entre comparação e aplicação → exceção 23505 → rollback total) `[CONFIRMED: migrations 20260906000000/20260907000000; code — compare.ts:117-122]`.
7. Curadoria: admin decide pendências via RPC `decidir_pendencia_referencia` — aprovar executa a mudança por tipo (substitution = arquivar + criar; absence = arquivar; new_item = criar), rejeitar exige motivo; a decisão da última pendência `open` marca a sync `success` `[CONFIRMED: migration 20260906000000:226-450]`.
8. Conclusão (estágio 8): rota finaliza a sync (status por resumo — `success` sem divergências desconhecidas / `pending_review` com pendências open / `failure`) e fecha `finished_at` `[CONFIRMED: code — rota]`.

## Alternative Flows

- **Sync não confiável nunca aplica** (BR-039): validação falhou OU nenhuma sync anterior confiável (`derivarModoSync` → `bootstrap`) → zero efeito automático no catálogo; no bootstrap TODA divergência vira pendência de curadoria `[CONFIRMED: code — compare.ts:117-122; migration 20260907000000 header]`.
- **Arquivada-pela-origem reaparece** (BR-042): tratada como referência NOVA — criada (auto pós-bootstrap; pendência `new_item` no bootstrap) `[CONFIRMED: code — compare.ts]`.
- **Bloqueio manual preservado** (BR-042): global inativa sem evento de arquivamento por sync → presença na origem é silêncio; seed grava `pre_sync_inativa` (actor NULL) só para legadas sem evento `[CONFIRMED: code; migration 20260907000000]`.
- **Rejeição** (BR-043): divergência vira conhecida e deliberada; reapresentada nas syncs seguintes até decisão; não cria regra permanente `[CONFIRMED: code — compare.ts map de decisões; migration 20260906000000]`.
- **Rollback/restauração** (BR-046): cancelam pendências `open` (evento `pendencia_cancelada` — sem nova decisão); flips de reativação auditados como `rollback`/`restore`, nunca `is_ativa_manual` `[CONFIRMED: migration 20260906010000]`.

## Error Flows

- Origem inválida/não confiável → `origin_invalid`/`failure` antes de efeito (B9 — sem retry) `[CONFIRMED: migration, code]`
- Estado mudou durante a sync (23505/linha alterada) → exceção → sync `failure` (retry limpo na próxima) `[CONFIRMED: migration 20260906000000]`
- Ator Sistema ausente e plano com criações → fail-high (`raise exception` orienta `scripts/provisionar-ator-sistema.js`) `[CONFIRMED: migration 20260906000000:83-85]`
- Sync simultânea → 409 single-flight sem registrar linha `[CONFIRMED: migration 20260905000000; teste REAL]`
- Chamadas sem autorização (RPCs de recuperação sem `pode_operar_recuperacao`, não-admin em curadoria, aplicar fora de service_role) → permissão negada `[CONFIRMED: migrations 20260906000000/20260906010000]`
- Restauração com payload corrompido → sha256 não confere → aborta antes de qualquer efeito `[CONFIRMED: migration 20260906010000:434-437]`

## Business Rules

- [BR-038](Specs-Current-Domain-Business-Rules) — sincronização controla apenas globais
- [BR-039](Specs-Current-Domain-Business-Rules) — sync não confiável jamais cria, arquiva ou altera
- [BR-040](Specs-Current-Domain-Business-Rules) — mudança substantiva = arquivar + criar, só por curadoria
- [BR-041](Specs-Current-Domain-Business-Rules) — matching determinístico decide identidade
- [BR-042](Specs-Current-Domain-Business-Rules) — arquivada não reativa; reaparição = nova; bloqueio manual preservado
- [BR-043](Specs-Current-Domain-Business-Rules) — curadoria por sync; rejeição exige motivo
- [BR-044](Specs-Current-Domain-Business-Rules) — duplicidade conflitante rejeita o par inteiro
- [BR-045](Specs-Current-Domain-Business-Rules) — sync é unidade com ID único; single-flight; canceladas sem nova decisão
- [BR-046](Specs-Current-Domain-Business-Rules) — backup pré-aplicação, retenção 12m; rollback preserva posteriores; restore com sha256
- [BR-047](Specs-Current-Domain-Business-Rules) — auditoria de sync/curadoria e de `is_ativa` manual; ator Sistema; fronteira OQ4

Afetadas (ressalvas em [business-rules.md](Specs-Current-Domain-Business-Rules)): BR-023, BR-024, BR-026, BR-027 (exceção dos backups de 12m).

## Frontend

- [pages/admin.md](Specs-Current-Frontend-Pages-Admin) (M6) — seções de sincronizações/curadoria/recuperação no painel admin (padrão FEAT-0012/ENH-0003)
- `src/react-app/services/referencias-sync.service.ts` + testes

## Backend

- [api-referencias-sync](Specs-Current-Backend-Api-Referencias-Sync) — rota `/api/referencias-sync` (estágios 1–8; cron semanal em `vercel.json`)
- `src/shared/referencias-sync/` — `canonical.ts`, `compare.ts` (matching/comparação/modo), `engine.ts` (execução dos estágios), `types.ts` (motor puro — sem banco)
- `src/shared/powerbi/` — `decode.ts`, `extract.ts`, `query-payload.ts`, `types.ts`, `validate.ts` (extração/validação — módulos portados do `powerbi-export`, B1)

## Database

- [referencia_syncs](Specs-Current-Database-Referencia_syncs), [referencia_sync_pendencias](Specs-Current-Database-Referencia_sync_pendencias), [referencia_eventos](Specs-Current-Database-Referencia_eventos), [referencia_snapshots](Specs-Current-Database-Referencia_snapshots), [referencia_backups](Specs-Current-Database-Referencia_backups) (promoção M7)
- [rpc](Specs-Current-Database-Rpc) — `aplicar_sync_referencias`, `decidir_pendencia_referencia`, `pode_operar_recuperacao`, `reverter_sync_referencias`, `restaurar_referencias_de_backup`, `fn_auditar_is_ativa_manual`, `fn_trim_referencia_backups`
- [triggers](Specs-Current-Database-Triggers) — `trg_auditar_is_ativa_manual`, `trg_trim_referencia_backups`; [referencias](Specs-Current-Database-Referencias), [usuarios](Specs-Current-Database-Usuarios) (`pode_recuperacao`)
- Migrations M1–M6: 20260905000000 (schema/enums/RLS/single-flight/trim), 20260905010000 (auditoria manual), 20260905020000 (R4-3 — ativar global só admin), 20260906000000 (aplicar/decidir), 20260906010000 (rollback/restauração + `pode_recuperacao`), 20260907000000 (seed `pre_sync_inativa` no bootstrap)
- Migração de precisão decimal (2026-09-11): 20260911000000 — `fenil_mg_por_100g` → `numeric(10,2)` + `CREATE OR REPLACE` das 4 RPCs com cast `numeric(10,1)`; **aplicada em dev em 2026-09-11; pendente em prod** (aplicação via `scripts/apply-supabase-migrations.sh`, com autorização — HIGH RISK)
- Migração de revisão do reverter (2026-09-14): 20260914000000 — `reverter_sync_referencias` com no-op revisado: sync sem alterações COM pendências `open` cancela as pendências e marca `reverted` (decisão do usuário — bootstrap por definição não aplica operações); aplicada em dev em 2026-09-14; pendente em prod

## Security

- [security-model](Specs-Current-Security-Security-Model) (§11 tabelas de sync; §12 operações de recuperação) — RLS admin-only SELECT ×5, sem policies de escrita; escritas via service_role/RPCs SECURITY DEFINER; curadoria com guarda interna de admin; recuperação exige `pode_operar_recuperacao` (admin E flag); ator Sistema real no Auth; GUC `app.audit_origin` suprime trigger onde a RPC registra evento específico

## Tests

- Unit (motor/extração): `canonical.test.ts`, `compare.test.ts`, `engine.test.ts`, `src/shared/powerbi/validate.test.ts`, `decode.test.ts`, `extract.test.ts`
- REAL (banco — M1–M6): `api/referencias-sync.test.ts` (rota/estágios), `src/shared/security/rpc-referencias-sync.test.ts` (M1 single-flight/RLS + M4 aplicação/curadoria/GUC), `rpc-referencias-sync-rollback.test.ts` (M5 — 17), `rpc-referencias-sync-seed.test.ts` (M6 — 6), `src/react-app/services/referencias-sync.service.test.ts`, `Admin.test.tsx` (UI M6)
- **Coverage status:** TESTED — suítes do motor e REAL M1–M6; lacunas conhecidas: calibração de margens de validação com a 1ª extração real e E2E do cron Vercel (ver Unknowns)

## Dependencies

- Vercel (cron semanal), Supabase (service_role; RLS), origem externa Power BI/ANVISA (payload via `query-payload.ts`)
- ENH-0004 (modelo canônico — base do matching), ator Sistema provisionado (`scripts/provisionar-ator-sistema.js`)

## Related Features

- [FEAT-0012 Painel administrativo](Specs-Current-Features-FEAT-0012-Painel-Administrativo) — UI do Admin estendida (sincronizações/curadoria/recuperação)
- [FEAT-0013 Background jobs](Specs-Current-Features-FEAT-0013-Background-Jobs) — infraestrutura Vercel cron reutilizada (B2; job usa a tabela própria de syncs — B6, fora do trim 365d da BR-027)
- [FEAT-0008 Referências alimentares](Specs-Current-Features-FEAT-0008-Referencias-Alimentares) — conjunto global, lifecycle e identidade (ENH-0004)

## Evidence

- E1 — Migrations M1–M6 (20260905000000 → 20260907000000) `[CONFIRMED: migration]`
- E2 — `vercel.json` (cron `0 12 * * 1`) + `api/referencias-sync.ts` `[CONFIRMED: configuration, code]`
- E3 — Motor puro: `src/shared/referencias-sync/*.ts`; extração: `src/shared/powerbi/*.ts` `[CONFIRMED: code]`
- E4 — Merges em development: M1 `5b1ed18` (PR #57), M2 `7ec0bf5` (PR #58), M3 `dd631d6` (PR #59), M4 `6e7d3e5` (PR #60), M5 `cb5d776` (PR #61), M6 `cb1123d` (PR #62) `[CONFIRMED: git]`
- E5 — Suítes REAL M1–M6 executadas contra dev; M1–M6 em prod desde a release v1.11.0 (2026-09-10) `[CONFIRMED: database — catálogo prod 2026-09-11]`

## Unknowns

- 1ª extração real com volume completo em produção (contagem/tamanho/variabilidade da origem) — calibração de margens do B9 (ver proposta arquivada)
- Retenção de snapshots — decisão em aberto (B3; sem trim automático hoje)
- Regra "toda global rastreia à origem" (OQ2): transição pós-bootstrap — aguarda a 1ª sync confiável validar o matching em produção
- E2E do cron Vercel (disparo real em produção — pós-release)
