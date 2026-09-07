# API Route — /api/referencias-sync

**Última verificação:** 2026-09-07 (FEAT-0017 M6 — seed `pre_sync_inativa` no estágio 7 (migration 20260907000000); UI de curadoria/recuperação entregue no M6, fora desta rota)
**Código:** `api/referencias-sync.ts` — função Vercel serverless (Node)

## Propósito

Executa a **sincronização de referências** com a origem ANVISA/Power BI (FEAT-0017). A partir do M4 executa o **pipeline completo, estágios 1–8** do design §6.2 (claim, extração, validação, snapshot, backup, comparação, aplicação e conclusão) e a sync **aplica efeito real no catálogo global**: compara o estado com o motor puro (M3), aplica o plano via RPC `aplicar_sync_referencias` (transação única, service_role-only) e conclui `success` (sem divergências) ou `pending_review` (pendências de curadoria — decididas por admin via RPC `decidir_pendencia_referencia`, fora desta rota) `[CONFIRMED: code — api/referencias-sync.ts]`.

## Trigger e cron

- Vercel Cron semanal: `0 12 * * 1` UTC (segunda 12:00 UTC) — declarado em `vercel.json` (FEAT-0017 M2, design §4.3; granularidade semanal permitida no Hobby) `[CONFIRMED: configuration — vercel.json]`.
- Handler Node-style (`(req, res) => void`), export default `[CONFIRMED: code — api/referencias-sync.ts]`.
- Execução manual também disponível (POST autenticado — seção Autenticação abaixo), registrada como sync normal `trigger_source = 'manual'`.

## Alvo

- **Somente `prod`** — `environment = 'prod'` fixo (decisão R4-1 do design §4.3; catálogo global é dado real único; sem lógica de ambiente dev na rota) `[CONFIRMED: code — api/referencias-sync.ts]`.

## Sequência de execução (estágios 1–8 do design §6.2)

1. **Claim (estágio 1):** stale recovery primeiro — `UPDATE referencia_syncs SET status='failure', message='execução interrompida (timeout da plataforma)', finished_at=now() WHERE status='running' AND started_at < now() - interval '25 minutes'`; depois `INSERT` da sync `running` (`environment='prod'`, `trigger_source=cron|manual`, `requested_by=admin|null`); violação do índice single-flight (`23505`, B10) → `409` sem registrar linha; evento `sync_started` `[CONFIRMED: code — api/referencias-sync.ts]`.
2. **Extração (estágio 2):** `extractPowerBiReport` de `src/shared/powerbi/` (fetch + decode DSR; resource key de env; patch fail-high `Window.Count` 500→30000) — evento `extraction` com `{ contagem, patch_aplicado }` `[CONFIRMED: code — api/referencias-sync.ts, src/shared/powerbi/extract.ts]`.
3. **Validação (estágio 3):** `validarExtracao` (checks estrutura → quantidade → campos → duplicidades; abort na 1ª anomalia, B9) — evento `validation` com resultado completo. Origem inválida → sync `origin_invalid` + `message` com o motivo, **sem snapshot/backup**; resposta `200 { sync_id, status: "origin_invalid" }` `[CONFIRMED: code]`.
4. **Snapshot (estágio 4):** INSERT em `referencia_snapshots` do payload decodificado exato (`payload_sha256 = sha256(JSON.stringify(rows))`, `contagem`) — evento `snapshot_created` `[CONFIRMED: code]`.
5. **Backup (estágio 5):** INSERT em `referencia_backups` das linhas completas de `referencias` (`SELECT *` — estado pré-aplicação; retenção 12 meses por trigger `trg_trim_referencia_backups`) — evento `backup_created` `[CONFIRMED: code, database — migration 20260905000000]`.
6. **Comparação (estágio 6, M4):** consulta o estado do catálogo via service role — ativas (`is_global AND is_ativa`), arquivadas (`is_global AND NOT is_ativa` com eventos de auditoria `referencia_eventos(id, tipo, created_at)` ordenados cronologicamente — base do dedupe global D-6), pendências `open`, decisões `approved`/`rejected` de `absence`/`new_item` em ordem cronológica (`decided_at` — a última vence) e o histórico de syncs do environment (para `derivarModoSync`: `pos_bootstrap` sse existe sync anterior `success`/`pending_review`, senão `bootstrap`, §14) — e monta o plano com `construirPlanoSync` do motor puro (M3). **Sem evento de auditoria próprio** (comparação/aplicação não têm evento no catálogo — §11.1): o resultado vive em `details.estagios[]` (com `modo`, contagens do estado e contagens do plano) `[CONFIRMED: code]`.
7. **Aplicação (estágio 7, M4):** `supabase.rpc("aplicar_sync_referencias", { p_sync_id, p_plano })` — RPC SECURITY DEFINER **exclusiva service_role** (design §7.5): transação única (criações com `criado_por` = ator Sistema, arquivamentos por ausência com guarda `is_ativa`, pendências `open` 1:1 do plano, eventos `referencia_criada`/`referencia_arquivada`, contadores e `alteracoes` da sync). Qualquer exceção (estado mudou, 23505, ator ausente…) desfaz **tudo** — resposta `500` + sync `failure`, nada aplicado. Retorna o resumo `{ sync_id, equivalentes, criadas, arquivadas, divergencias }`, registrado no detalhe do estágio `apply`; no modo `bootstrap` (1ª sync confiável do ambiente), a RPC grava ainda 1 evento `pre_sync_inativa` por global inativa legada SEM evento de auditoria (actor NULL, idempotente, sem tocar contadores — migration M6) `[CONFIRMED: code, database — migrations 20260906000000/20260907000000]`.
8. **Conclusão (estágio 8, M4):** o resumo da RPC decide o status final — `divergencias > 0` → `pending_review` (pendências de curadoria) | senão `success`. `concluirSync` grava `total_origem` e `message` factual:
   - `success`: "Sincronização concluída: X equivalentes, Y criadas, Z arquivadas, sem divergências pendentes."
   - `pending_review`: "Sincronização concluída com N divergência(s) pendente(s) de curadoria: X equivalentes, Y criadas, Z arquivadas."
   - Marca `bootstrap: true` no detalhe quando o modo derivado é `bootstrap` (base do M6 — transição de política). Resposta `200 { sync_id, status: "success" | "pending_review" }` `[CONFIRMED: code]`.

Falha técnica em qualquer estágio → `failure` (evento do estágio com `{ erro, duration_ms }` + `details.estagios[]` com o estágio `status: 'erro'`) e resposta `500 { sync_id, status: "failure", error }`. Falha ANTES do claim (ex.: INSERT com erro de rede) não tem sync a marcar — resposta `500 { status: "failure", error }` sem `sync_id` `[CONFIRMED: code]`.

**Distinção do edge pós-aplicação (M4, decisão 5):** se a RPC de aplicação já retornou ok, as alterações **são fato** (`alteracoes`/contadores gravados na sync) — uma falha posterior (ex.: UPDATE final de conclusão) marca `failure` com mensagem honesta "Alterações aplicadas; falha ao finalizar a sync: …" (o rollback do M5 pode reverter — RPC `reverter_sync_referencias`, ver seção Recuperação excepcional; restrito a syncs `success`/`pending_review` — a `failure` pós-aplicação é caso a caso pelo humano). Antes da RPC, nada foi aplicado (transação abortou) `[CONFIRMED: code — api/referencias-sync.ts]`.

## Curadoria de divergências (fora desta rota)

Pendências `open` criadas na aplicação são decididas por **admin autenticado** via RPC `decidir_pendencia_referencia` (nunca service_role): aprovar (`absence` arquiva a atual; `new_item` cria a proposta; `substitution` arquiva a atual e cria a proposta — sempre `criado_por` = ator Sistema, GUC `app.audit_origin='curadoria'` suprime `is_ativa_manual` duplicado) ou rejeitar com motivo obrigatório (nenhuma alteração de dados). A última pendência `open` decidida → sync `success` com message "Curadoria concluída — todas as pendências foram decididas". Detalhes em [../database/rpc.md](../database/rpc.md). UI de curadoria entregue no M6 — página Admin via `referencias-sync.service.ts:534` `[CONFIRMED: code — referencias-sync.service.ts; database — migration 20260906000000]`.

## Recuperação excepcional (M5 — fora desta rota)

A partir do M5 a recuperação existe no banco como ação **humana** de admin — nenhuma via automatizada (a rota não chama as RPCs de recuperação; service_role sem EXECUTE):

- **Rollback seletivo de sync** — RPC `reverter_sync_referencias` (admin E `usuarios.pode_recuperacao`): desfaz as alterações da sync escolhida — inversas das `alteracoes` em ordem reversa com guarda "preservar alterações posteriores" por operação (reativações com evento `rollback`, nunca `ativar`); pendências `open` do alvo → `cancelled`; status → `reverted`. Restrito a syncs `success`/`pending_review`.
- **Restauração por backup** — RPC `restaurar_referencias_de_backup` (admin E flag): o conjunto global volta a refletir um backup do estágio 5 (M2) — integridade sha256 verificada antes de qualquer efeito; reativa arquivadas do backup, recria ausentes (id original, `criado_por` = Sistema) e arquiva globais ativas fora do backup; nunca DELETE, não toca pessoais; cancela TODAS as pendências `open`; não cria sync (evento único `restore`).

Detalhes (definições, guardas de serialização, erros, testes): [../database/rpc.md](../database/rpc.md). UI de recuperação entregue no M6 — página Admin via `referencias-sync.service.ts:555` (`reverter`) e `:574` (`restaurar`); ações humanas, nenhuma via automatizada `[CONFIRMED: code — referencias-sync.service.ts; migration 20260906010000; ausência de chamador na rota]`.

## Autenticação / autorização

- **GET (cron):** exige `Authorization: Bearer ${CRON_SECRET}` — comparação **timing-safe** (`crypto.timingSafeEqual`); ausência/erro do Bearer → `401`. A Vercel envia o header automaticamente quando a env `CRON_SECRET` existe (design §4.3) `[CONFIRMED: code]`.
- **POST (manual):** exige Bearer com JWT de sessão; validação via `supabase.auth.getUser(token)` + checagem `role = 'admin'` em `usuarios` (mesmo critério do painel) — sem JWT válido ou não-admin → `403`. O `id` do admin vai em `requested_by` `[CONFIRMED: code]`.
- **Método não permitido → `405` + `Allow: GET, POST`.**
- Todas as escritas via **service role** (`REFERENCIAS_SYNC_*` dedicadas — sem fallback, DEBT-0006) `[CONFIRMED: code, database]`:
  - Diretas em `referencia_syncs`, `referencia_eventos`, `referencia_snapshots`, `referencia_backups` (nenhuma policy de escrita; RLS admin-only SELECT — migration M1).
  - No catálogo (`referencias`) **apenas indiretamente** via RPC `aplicar_sync_referencias` (EXECUTE exclusivo `service_role`; admin/session não têm permissão de aplicar plano — migration M4) `[CONFIRMED: code, database]`.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `REFERENCIAS_SYNC_SUPABASE_URL` / `REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY` | credenciais service role do banco (dedicadas, **obrigatórias, sem fallback**) |
| `CRON_SECRET` | Bearer do cron (GET) |
| `POWERBI_RESOURCE_KEY` | resource key pública do relatório Power BI (nunca hardcoded — D-1) |

Env ausente → `500 { error: "Missing environment variable: ..." }` antes do claim (configuração não polui a trilha) `[CONFIRMED: code]`. Inventário completo: [../security/secrets-and-environments.md](../security/secrets-and-environments.md).

## Tratamento de erros

- Erros técnicos (fetch, decode, INSERT/UPDATE, RPC) → sync `failure`, evento do estágio com `erro`, `500` com `{ sync_id, status: "failure", error }` — **sem retry** (B9) `[CONFIRMED: code]`.
- Origem inválida é estado TERMINAL da sync (`origin_invalid`) — resposta `200` (a sync processou; a ORIGEM é que reprovou) `[CONFIRMED: code]`.
- Erro da RPC de aplicação (estado mudou entre comparação e aplicação, identidade duplicada `23505`, ator Sistema ausente…) → `failure` + `500` — a transação abortou, **nada foi aplicado** `[CONFIRMED: code]`.
- RPC ok mas falha na conclusão (UPDATE final) → `failure` + `500` com a mensagem "Alterações aplicadas; falha ao finalizar a sync: …" (ver edge pós-aplicação acima) `[CONFIRMED: code]`.
- Erro ao marcar `failure` (UPDATE final falha) é logado; resposta `500` segue `[CONFIRMED: code]`.

## Logging

- `console.info` no sucesso com `[referencias-sync]`, trigger, sync id, duração, contagem, modo (`bootstrap`/`pos_bootstrap`), status final e divergências `[CONFIRMED: code]`.
- `console.error` em falha de estágio, falha ao marcar failure e falha inesperada, com prefixo `[referencias-sync]` `[CONFIRMED: code]`.
- Auditoria estruturada em `referencia_eventos` (sync_started/extraction/validation/snapshot_created/backup_created; comparação/aplicação sem evento — §11.1) e `details.estagios[]` em `referencia_syncs` (tempos por estágio — base da calibração R5) `[CONFIRMED: code]`.

## Relação com o banco (M1 — 20260905000000; M4 — 20260906000000; recuperação M5 — 20260906010000; seed M6 — 20260907000000)

Execução grava em `referencia_syncs` (unidade, `sync_status`, single-flight B10, `alteracoes`/contadores), `referencia_eventos` (auditoria B7), `referencia_snapshots`/`referencia_backups` (B3). Efeito no catálogo: `referencias` globais criadas/arquivadas **somente via RPC `aplicar_sync_referencias`** (transação única, `alteracoes` registradas para o rollback do M5); `referencia_sync_pendencias` recebe as pendências de curadoria (decididas por admin — RPC `decidir_pendencia_referencia`) `[CONFIRMED: code, database]`.

## Testes

- `src/shared/powerbi/{decode,extract,validate}.test.ts` — port + guardas do design §4.2 (máscaras, 32 colunas, desalinhamento, nomes, fail-high do patch) e matriz de validação §6.3 (46 casos) `[CONFIRMED: test]`.
- `api/referencias-sync.test.ts` — no espelho de `api/keepalive.test.ts` (mock `createClient` + mock do módulo de extração; motor M3 e validação reais): fluxos M4 — bootstrap → `pending_review` com pendências `new_item`; `pos_bootstrap` (histórico `success`) → aplicação → `success`; sem divergências → `success`; RPC falha → `failure` + `500` sem conclusão; RPC ok + UPDATE final falho → `failure` com mensagem "Alterações aplicadas…"; mais 401/403, 409 single-flight, `origin_invalid` sem artifacts, falha técnica → failure, manual admin, 405 (13 casos) `[CONFIRMED: test]`.
- `src/shared/security/rpc-referencias-sync.test.ts` (REAL, Abordagem B) — suítes das RPCs do M4: aplicar (plano manual e via `construirPlanoSync` real; `criado_por` = Sistema; rollback total em 23505/estado mudado/versão/op desconhecida; exclusividade service_role) e decidir (aprovar os 3 tipos com GUC D-7; rejeitar com/sem motivo; terminais; sync running; última aberta → `success`) `[CONFIRMED: test]`.
- `src/shared/security/rpc-referencias-sync-rollback.test.ts` (REAL, M5 — 17 testes) e `rpc-referencias-sync-seed.test.ts` (REAL, M6 — 6 testes): rollback seletivo/restauração por backup e seed `pre_sync_inativa` — executados contra o banco dev com os guards de migration (M5/M6 + ator Sistema) `[CONFIRMED: test]`.

## Evidências

- E1 — Código: `api/referencias-sync.ts`, `src/shared/powerbi/*.ts`, `src/shared/referencias-sync/*.ts` (motor M3) `[CONFIRMED: code]`
- E2 — Testes: `api/referencias-sync.test.ts`, `src/shared/powerbi/*.test.ts`, `src/shared/security/rpc-referencias-sync.test.ts`, `rpc-referencias-sync-rollback.test.ts` (M5), `rpc-referencias-sync-seed.test.ts` (M6) `[CONFIRMED: test]`
- E3 — Cron: `vercel.json` `[CONFIRMED: configuration]`
- E4 — Schema das tabelas de sync: `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` `[CONFIRMED: database]`
- E5 — RPCs de aplicação/curadoria + ator Sistema: `supabase/migrations/20260906000000_referencias_sync_aplicacao_curadoria.sql`, `scripts/provisionar-ator-sistema.js`; RPCs de recuperação (M5): `supabase/migrations/20260906010000_referencias_sync_rollback_restauracao.sql`; seed (M6): `supabase/migrations/20260907000000_referencias_sync_seed_pre_sync_inativa.sql` `[CONFIRMED: database]`
- E6 — Design: `.ai/.temp/feat0017-fase1-design-2026-09-04.md` §4.3/§6.2/§7.5/§8/§16 `[CONFIRMED: .temp — design FEAT-0017]`

## Veja também

- [api-keepalive.md](api-keepalive.md), [overview.md](overview.md), [background-jobs.md](background-jobs.md)
- [../database/rpc.md](../database/rpc.md) — `aplicar_sync_referencias`, `decidir_pendencia_referencia`, `reverter_sync_referencias`, `restaurar_referencias_de_backup`
- [../security/secrets-and-environments.md](../security/secrets-and-environments.md)
- Migrations M1/M4/M5/M6: `supabase/migrations/20260905000000_referencias_sync_tabelas.sql`, `20260906000000_referencias_sync_aplicacao_curadoria.sql`, `20260906010000_referencias_sync_rollback_restauracao.sql`, `20260907000000_referencias_sync_seed_pre_sync_inativa.sql` (seed `pre_sync_inativa` — M6)
