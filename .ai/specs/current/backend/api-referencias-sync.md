# API Route — /api/referencias-sync

**Última verificação:** 2026-09-25 (ENH-0011 — estágio 7: `detalhes` dos eventos de remoção passam a incluir `motivo`; estágio 7.5: audit stage separa `identidade` de `motivo` no JSON de saída; `LinhaEventoRemocao.detalhes` inclui `motivo` opcional. Antes: ENH-0010 — estágio audit adicionado; ENH-0009 — deleção física integrada, sweep retroativo, sem curadoria/pendências/bootstrap)
**Código:** `api/referencias-sync.ts` — função Vercel serverless (Node)

## Propósito

Executa a **sincronização de referências** com a origem ANVISA/Power BI (FEAT-0017). A partir do M4 executa o **pipeline completo, estágios 1–8** do design §6.2 (claim, extração, validação, snapshot, backup, comparação, aplicação e conclusão) e a sync **aplica efeito real no catálogo global**: compara o estado com o motor puro (M3), aplica o plano via RPC `aplicar_sync_referencias` (transação única, service_role-only) e conclui sempre `success` (ENH-0009 removeu o status `pending_review` — substituições são auto-aplicadas; deleção física integrada ao sync) `[CONFIRMED: code — api/referencias-sync.ts]`.

## Trigger e cron

- Vercel Cron semanal: `0 12 * * 1` UTC (segunda 12:00 UTC) — declarado em `vercel.json` (FEAT-0017 M2, design §4.3; granularidade semanal permitida no Hobby) `[CONFIRMED: configuration — vercel.json]`.
- Handler Node-style (`(req, res) => void`), export default `[CONFIRMED: code — api/referencias-sync.ts]`.
- Execução manual também disponível (POST autenticado — seção Autenticação abaixo), registrada como sync normal `trigger_source = 'manual'`.

## Alvo

- **Ambiente do deployment em que a rota executa** (revisão parcial do R4-1, decisão humana 2026-09-08): `ambienteAlvo()` deriva de `VERCEL_ENV` — `production` → `environment = 'prod'`; `preview`/`development` (incl. `vercel dev` local) → `environment = 'dev'` `[CONFIRMED: code — api/referencias-sync.ts]`.
- A **execução manual** (POST) está disponível em **dev e prod**; o **cron** (GET) só dispara no deployment de produção → sempre `prod`.
- Por que derivar de `VERCEL_ENV` e não de env dedicada: o ambiente muda de escopo junto com as `REFERENCIAS_SYNC_*` (escopos Production vs Preview/Development do Vercel) — um deployment nunca grava no environment errado e não há env nova para configurar por escopo. O racional do DEBT-0006 (cron de produção precisava alcançar dev) **não se aplica**: aqui o cron é prod-only por requisito `[CONFIRMED: code; security/secrets-and-environments.md]`.
- Registro: R4-1 original (design 2026-09-04) = rota somente prod; revisão 2026-09-08 (autor) = manual dev+prod, cron prod.

## Sequência de execução (estágios 1–8 do design §6.2)

1. **Claim (estágio 1):** stale recovery primeiro — `UPDATE referencia_syncs SET status='failure', message='execução interrompida (timeout da plataforma)', finished_at=now() WHERE status='running' AND started_at < now() - interval '25 minutes'`; depois `INSERT` da sync `running` (`environment` = `ambienteAlvo()` — prod no deployment de produção, dev em preview/`vercel dev`, revisão R4-1; `trigger_source=cron|manual`, `requested_by=admin|null`); violação do índice single-flight (`23505`, B10) → `409` sem registrar linha; evento `sync_started` `[CONFIRMED: code — api/referencias-sync.ts]`.
2. **Extração (estágio 2):** `extractPowerBiReport` de `src/shared/powerbi/` (fetch + decode DSR; resource key de env; patch fail-high `Window.Count` 500→30000) — evento `extraction` com `{ contagem, patch_aplicado }` `[CONFIRMED: code — api/referencias-sync.ts, src/shared/powerbi/extract.ts]`.
3. **Validação (estágio 3):** `validarExtracao` (checks estrutura → quantidade → campos → duplicidades, B9) — evento `validation` com resultado completo. Abortam a sync (→ `origin_invalid`, **sem snapshot/backup**, `message` com o motivo, resposta `200 { sync_id, status: "origin_invalid" }`): estrutura inesperada, 0 linhas e nenhuma linha válida restante. Anomalias de campo/tipo (`nome` nulo/vazio, `NU_MAX_AMINOACIDO` nulo/não-numérico/com mais de 2 casas decimais/fora de 0–2040, `marca` não-texto) são rejeições **individuais**: a linha é descartada, o sync segue com as válidas e cada rejeição é reportada em `detalhes.rejeitadas` (`{ linha, nome, motivo }`, teto de 100 + flag `rejeitadas_truncadas`; total em `contagem.rejeitadas`). Duplicidade conflitante (mesmo nome+marca com fenil divergente — BR-044 revisada 2026-09-14) rejeita **todas as linhas do grupo** (par inteiro — nenhum valor arbitrário vence; o produto fica fora do catálogo até a origem estabilizar) e **não** invalida a sync. `marca` nula é produto sem marca declarada → normalizada para `''` e mantida. O pipeline segue com `validacao.rowsValidas` `[CONFIRMED: code]`.
4. **Snapshot (estágio 4):** INSERT em `referencia_snapshots` do payload decodificado das linhas válidas (`payload_sha256 = sha256(JSON.stringify(rowsValidas))`, `contagem`) — evento `snapshot_created` `[CONFIRMED: code]`.
5. **Backup (estágio 5):** INSERT em `referencia_backups` das linhas completas de `referencias` (`SELECT *` **paginado** — estado pré-aplicação; retenção 12 meses por trigger `trg_trim_referencia_backups`) — evento `backup_created`. **Correção 2026-09-14:** o PostgREST trunca em 1000 linhas por request; sem paginação, o backup capturava um retrato PARCIAL e a restauração por backup (anti-join) arquivaria linhas válidas ausentes do retrato `[CONFIRMED: code, database — migration 20260905000000]`.
6. **Comparação (estágio 6, M4 — simplificado pelo ENH-0009):** consulta o estado do catálogo via service role — ativas (`is_global AND is_ativa`) e arquivadas (`is_global AND NOT is_ativa` com eventos de auditoria `referencia_eventos(id, tipo, created_at)` ordenados cronologicamente — base do dedupe global D-6) — e monta o plano com `construirPlanoSync` do motor puro (M3). **ENH-0009 removeu:** pendências `open`, decisões `approved`/`rejected`, histórico de syncs do environment, `derivarModoSync`/bootstrap. **Plano ENH-0009:** `{ versao, criacoes, arquivamentos }` — `arquivamentos[].motivo: "ausencia"|"substituicao"`; substituições auto-aplicadas (sem curadoria). **Consultas paginadas** (`buscarTodasAsLinhas` — itera `.range` até a última página; correção 2026-09-14: sem paginação a comparação via um retrato truncado em 1000 linhas — falsos `new_item`/`absence` e `23505` de criações duplicadas). **Sem evento de auditoria próprio** (comparação/aplicação não têm evento no catálogo — §11.1): o resultado vive em `details.estagios[]` (contagens do estado e contagens do plano) `[CONFIRMED: code]`.
7. **Aplicação (estágio 7, M4 — reescrito pelo ENH-0009/ENH-0011):** `supabase.rpc("aplicar_sync_referencias", { p_sync_id, p_plano })` — RPC SECURITY DEFINER **exclusiva service_role** (design §7.5): transação única (criações com `criado_por` = ator Sistema, arquivamentos com guarda `is_ativa`, **deleção física** de globais sem relacionamentos — FK violation → degradação a arquivamento, **sweep retroativo** de até 100 globais `is_ativa=false` sem relacionamentos por execução, eventos `referencia_criada`/`referencia_arquivada`/`referencia_deletada`, contadores e `deletadas` da sync). **ENH-0011:** eventos de arquivamento/deleção têm `detalhes = {nome, marca, fenil_mg_por_100g, motivo}` — seção C: `motivo = v_motivo` ('ausencia'|'substituicao'); seção D/sweep: `motivo = 'sweep'`. Qualquer exceção (estado mudou, 23505, ator ausente…) desfaz **tudo** — resposta `500` + sync `failure`, nada aplicado. Retorna o resumo `{ sync_id, equivalentes, criadas, arquivadas, deletadas }` (ENH-0009 removeu `divergencias`; substituições auto-aplicadas sem curadoria), registrado no detalhe do estágio `apply`. **ENH-0009 removeu:** pendências `open` 1:1 do plano; seed `pre_sync_inativa`; modo bootstrap `[CONFIRMED: code, database — migrations 20260906000000/20260923000000/20260924000000/20260924010000/20260925000000]`.
7.5. **Audit (ENH-0010/ENH-0011):** quando `arquivadas > 0 || deletadas > 0`, a rota lê `referencia_eventos` para o sync atual (`tipo IN ('referencia_deletada', 'referencia_arquivada')`) usando `buscarTodasAsLinhas` (paginado) e adiciona `{ estagio: 'audit', status: 'ok', alteracoes: [{ tipo, referencia_id, identidade, motivo }] }` em `details.estagios`; tipo `LinhaEventoRemocao = { tipo, referencia_id, detalhes }` onde `detalhes` inclui `motivo` como campo opcional (eventos históricos: `motivo` ausente → `null`). **ENH-0011:** `motivo` extraído de `ev.detalhes` como campo separado de `identidade = {nome, marca, fenil_mg_por_100g}` (padrão consistente com `mudanca_rejeitada`); `motivo: null` para eventos históricos sem campo. Estágio omitido quando `arquivadas = 0` e `deletadas = 0`. Falha isolada em try/catch — em erro: `{ status: "erro" }` sem bloquear a conclusão do sync `[CONFIRMED: code — api/referencias-sync.ts, tipo LinhaEventoRemocao; migration 20260925000000]`.
8. **Conclusão (estágio 8, M4 — simplificado pelo ENH-0009):** o resumo da RPC fecha a sync sempre como `success`. `concluirSync` grava `total_origem` e `message` factual:
   - `success`: "Sincronização concluída: X equivalentes, Y criadas, Z arquivadas, W deletadas."
   - Com rejeições individuais (estágio 3), recebe o sufixo " K linha(s) da origem rejeitada(s) por dado inválido." (K > 0).
   - **ENH-0009 removeu:** `pending_review` (sem divergências/curadoria); `bootstrap: true` no detalhe. Resposta `200 { sync_id, status: "success" }` `[CONFIRMED: code]`.

Falha técnica em qualquer estágio → `failure` (evento do estágio com `{ erro, duration_ms }` + `details.estagios[]` com o estágio `status: 'erro'`) e resposta `500 { sync_id, status: "failure", error }`. Falha ANTES do claim (ex.: INSERT com erro de rede) não tem sync a marcar — resposta `500 { status: "failure", error }` sem `sync_id` `[CONFIRMED: code]`.

**Distinção do edge pós-aplicação (M4, decisão 5):** se a RPC de aplicação já retornou ok, as alterações **são fato** (`alteracoes`/contadores gravados na sync) — uma falha posterior (ex.: UPDATE final de conclusão) marca `failure` com mensagem honesta "Alterações aplicadas; falha ao finalizar a sync: …" (o rollback do M5 pode reverter — RPC `reverter_sync_referencias`, ver seção Recuperação excepcional; restrito a syncs `success`/`pending_review` — a `failure` pós-aplicação é caso a caso pelo humano). Antes da RPC, nada foi aplicado (transação abortou) `[CONFIRMED: code — api/referencias-sync.ts]`.

## Curadoria de divergências — REMOVIDA (ENH-0009)

**ENH-0009 eliminou** a curadoria (`decidir_pendencia_referencia`, `referencia_sync_pendencias`, `pending_review`) — substituições são auto-aplicadas pelo sync; não há mais divergências pendentes. A sync sempre conclui `success`. Histórico FEAT-0017 M4: ver archive spec ENH-0009.

## Recuperação excepcional (M5 — fora desta rota — parcialmente removida pelo ENH-0009)

A partir do M5 a recuperação existe no banco como ação **humana** de admin — nenhuma via automatizada (a rota não chama as RPCs de recuperação; service_role sem EXECUTE):

- **Rollback seletivo de sync** — RPC `reverter_sync_referencias` — **REMOVIDA pelo ENH-0009** (migration 20260923000000). A operação deixou de existir.
- **Restauração por backup** — RPC `restaurar_referencias_de_backup` (admin E flag): o conjunto global volta a refletir um backup do estágio 5 (M2) — integridade sha256 verificada antes de qualquer efeito; reativa arquivadas do backup, recria ausentes (id original, `criado_por` = Sistema) e arquiva globais ativas fora do backup; nunca DELETE, não toca pessoais; `pendencias_canceladas` retorna **sempre 0** (ENH-0009 removeu `referencia_sync_pendencias`); não cria sync (evento único `restore`).

Detalhes (definições, guardas de serialização, erros, testes): [../database/rpc.md](../database/rpc.md). UI de recuperação entregue no M6 — página Admin via `referencias-sync.service.ts:574` (`restaurar`); ação humana, nenhum chamador automático `[CONFIRMED: code — referencias-sync.service.ts; migration 20260906010000; 20260923000000; ausência de chamador na rota]`.

## Autenticação / autorização

- **GET (cron):** exige `Authorization: Bearer ${CRON_SECRET}` — comparação **timing-safe** (`crypto.timingSafeEqual`); ausência/erro do Bearer → `401`. A Vercel envia o header automaticamente quando a env `CRON_SECRET` existe (design §4.3). Só dispara no deployment de produção → alvo sempre `prod` `[CONFIRMED: code]`.
- **POST (manual):** exige Bearer com JWT de sessão; validação via `supabase.auth.getUser(token)` + checagem `role = 'admin'` em `usuarios` (mesmo critério do painel) — sem JWT válido ou não-admin → `403`. O `id` do admin vai em `requested_by`. Disponível em **dev e prod** (revisão R4-1, decisão 2026-09-08) `[CONFIRMED: code]`.
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

- `console.info` no sucesso com `[referencias-sync]`, trigger, sync id, duração, contagem, rejeitadas, status final e contagens (criadas/arquivadas/deletadas) — ENH-0009 removeu `modo (bootstrap/pos_bootstrap)` e `divergencias` do log `[CONFIRMED: code]`.
- `console.error` em falha de estágio, falha ao marcar failure e falha inesperada, com prefixo `[referencias-sync]` `[CONFIRMED: code]`.
- Auditoria estruturada em `referencia_eventos` (sync_started/extraction/validation/snapshot_created/backup_created; comparação/aplicação sem evento — §11.1) e `details.estagios[]` em `referencia_syncs` (tempos por estágio — base da calibração R5) `[CONFIRMED: code]`.

## Relação com o banco (M1 — 20260905000000; M4 — 20260906000000; recuperação M5 — 20260906010000; ENH-0009 — 20260923000000)

Execução grava em `referencia_syncs` (unidade, `sync_status`, single-flight B10, `alteracoes`/contadores/`deletadas`), `referencia_eventos` (auditoria B7), `referencia_snapshots`/`referencia_backups` (B3). Efeito no catálogo: `referencias` globais criadas/arquivadas/**deletadas fisicamente** (FK violation → degradação a arquivamento) **somente via RPC `aplicar_sync_referencias`** (transação única). **ENH-0009 removeu:** `referencia_sync_pendencias`, `alteracoes` como base de rollback (reverter_sync_referencias dropped), seed M6 `[CONFIRMED: code, database]`.

## Testes

- `src/shared/powerbi/{decode,extract,validate}.test.ts` — port + guardas do design §4.2 (máscaras, 32 colunas, desalinhamento, nomes, fail-high do patch) e matriz de validação §6.3 (22 casos, incluindo rejeição individual, numeração da linha original e normalização `marca` nula → `''`) `[CONFIRMED: test]`.
- `api/referencias-sync.test.ts` — mock `createClient` + mock do módulo de extração; motor M3 e validação reais: fluxo completo → `success` com contagens (ENH-0009 removeu `pending_review`/bootstrap/divergências); artefato da API (linha 1 nome nulo) rejeitado individualmente com a rejeição no evento `validation`; marca nula normalizada para `''` no snapshot; RPC falha → `failure` + `500` sem conclusão; RPC ok + UPDATE final falho → `failure` com mensagem "Alterações aplicadas…"; mais 401/403, 409 single-flight, `origin_invalid` sem artifacts, falha técnica → failure, manual admin, 405; **ENH-0010**: "audit stage: referências removidas geram entrada audit em details.estagios" (mock evento `referencia_arquivada`; assert `{ estagio: 'audit', status: 'ok', alteracoes }`) e "audit stage: sync sem arquivadas/deletadas não gera entrada audit" `[CONFIRMED: test]`.
- `src/shared/security/rpc-referencias-sync.test.ts` (REAL, ENH-0009 — 9 testes, guard `isFeat0017M4Applied`): plano manual com criação + arquivamento (motivo `substituicao`); motor real `construirPlanoSync`; plano vazio sem Sistema; negativos: versão inválida/ausente, sync inexistente/não-running, op desconhecida, arquivamento de inativa → ROLLBACK, `23505` estado mudou → ROLLBACK; authenticated (admin) → permissão negada `[CONFIRMED: test]`.
- `src/shared/security/rpc-referencias-sync-rollback.test.ts` (REAL, ENH-0009 — restauração por backup: 6 testes): `pendencias_canceladas` = 0; integridade sha256; guarda running; happy path; conflito → aborta; permissão negada — guard `isFeat0017M5Applied` `[CONFIRMED: test]`.
- `src/shared/security/rpc-referencias-sync-seed.test.ts` (REAL, ENH-0009 — 1 teste): global inativa legada + plano vazio → zero `pre_sync_inativa` (seed removido) `[CONFIRMED: test]`.

## Evidências

- E1 — Código: `api/referencias-sync.ts`, `src/shared/powerbi/*.ts`, `src/shared/referencias-sync/*.ts` (motor M3) `[CONFIRMED: code]`
- E2 — Testes: `api/referencias-sync.test.ts`, `src/shared/powerbi/*.test.ts`, `src/shared/security/rpc-referencias-sync.test.ts`, `rpc-referencias-sync-rollback.test.ts` (M5), `rpc-referencias-sync-seed.test.ts` (M6) `[CONFIRMED: test]`
- E3 — Cron: `vercel.json` `[CONFIRMED: configuration]`
- E4 — Schema das tabelas de sync: `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` `[CONFIRMED: database]`
- E5 — RPCs de aplicação + ator Sistema: `supabase/migrations/20260906000000_referencias_sync_aplicacao_curadoria.sql`, `scripts/provisionar-ator-sistema.js`; RPCs de recuperação (M5): `supabase/migrations/20260906010000_referencias_sync_rollback_restauracao.sql`; seed (M6): `supabase/migrations/20260907000000_referencias_sync_seed_pre_sync_inativa.sql`; ENH-0009: `supabase/migrations/20260923000000_enh_0009_delecao_fisica_sync_simplificacao.sql` `[CONFIRMED: database]`
- E6 — Design: `.ai/.temp/feat0017-fase1-design-2026-09-04.md` §4.3/§6.2/§7.5/§8/§16 `[CONFIRMED: .temp — design FEAT-0017]`

## Veja também

- [api-keepalive.md](api-keepalive.md), [overview.md](overview.md), [background-jobs.md](background-jobs.md)
- [../database/rpc.md](../database/rpc.md) — `aplicar_sync_referencias`, `decidir_pendencia_referencia`, `reverter_sync_referencias`, `restaurar_referencias_de_backup`
- [../security/secrets-and-environments.md](../security/secrets-and-environments.md)
- Migrations M1/M4/M5/ENH-0009: `supabase/migrations/20260905000000_referencias_sync_tabelas.sql`, `20260906000000_referencias_sync_aplicacao_curadoria.sql`, `20260906010000_referencias_sync_rollback_restauracao.sql`, `20260923000000_enh_0009_delecao_fisica_sync_simplificacao.sql` (ENH-0009 — deleção física + simplificação)
