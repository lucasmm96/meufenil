# API Route — /api/referencias-sync

**Última verificação:** 2026-09-06 (FEAT-0017 M2)
**Código:** `api/referencias-sync.ts` — função Vercel serverless (Node)

## Propósito

Executa a **sincronização de referências** com a origem ANVISA/Power BI (FEAT-0017). No estágio M2 executa os **estágios 1–5** do pipeline (claim, extração, validação, snapshot e backup) e **para**: a sync registra a extração validada com snapshot/backup e encerra `success` — **sem comparação nem aplicação** (estágios 6–8 chegam no M4) e **sem qualquer efeito em dados do catálogo** (`referencias`/`registros`) `[CONFIRMED: code — api/referencias-sync.ts]`.

## Trigger e cron

- Vercel Cron semanal: `0 12 * * 1` UTC (segunda 12:00 UTC) — declarado em `vercel.json` (FEAT-0017 M2, design §4.3; granularidade semanal permitida no Hobby) `[CONFIRMED: configuration — vercel.json]`.
- Handler Node-style (`(req, res) => void`), export default `[CONFIRMED: code — api/referencias-sync.ts]`.
- Execução manual também disponível (POST autenticado — seção Autenticação abaixo), registrada como sync normal `trigger_source = 'manual'`.

## Alvo

- **Somente `prod`** — `environment = 'prod'` fixo (decisão R4-1 do design §4.3; catálogo global é dado real único; sem lógica de ambiente dev na rota) `[CONFIRMED: code — api/referencias-sync.ts]`.

## Sequência de execução (estágios 1–5 do design §6.2)

1. **Claim (estágio 1):** stale recovery primeiro — `UPDATE referencia_syncs SET status='failure', message='execução interrompida (timeout da plataforma)', finished_at=now() WHERE status='running' AND started_at < now() - interval '25 minutes'`; depois `INSERT` da sync `running` (`environment='prod'`, `trigger_source=cron|manual`, `requested_by=admin|null`); violação do índice single-flight (`23505`, B10) → `409` sem registrar linha; evento `sync_started` `[CONFIRMED: code — api/referencias-sync.ts]`.
2. **Extração (estágio 2):** `extractPowerBiReport` de `src/shared/powerbi/` (fetch + decode DSR; resource key de env; patch fail-high `Window.Count` 500→30000) — evento `extraction` com `{ contagem, patch_aplicado }` `[CONFIRMED: code — api/referencias-sync.ts, src/shared/powerbi/extract.ts]`.
3. **Validação (estágio 3):** `validarExtracao` (checks estrutura → quantidade → campos → duplicidades; abort na 1ª anomalia, B9) — evento `validation` com resultado completo. Origem inválida → sync `origin_invalid` + `message` com o motivo, **sem snapshot/backup**; resposta `200 { sync_id, status: "origin_invalid" }` `[CONFIRMED: code]`.
4. **Snapshot (estágio 4):** INSERT em `referencia_snapshots` do payload decodificado exato (`payload_sha256 = sha256(JSON.stringify(rows))`, `contagem`) — evento `snapshot_created` `[CONFIRMED: code]`.
5. **Backup (estágio 5):** INSERT em `referencia_backups` das linhas completas de `referencias` (`SELECT *` — estado pré-aplicação; retenção 12 meses por trigger `trg_trim_referencia_backups`) — evento `backup_created` `[CONFIRMED: code, database — migration 20260905000000]`.
6. **Conclusão:** UPDATE `status='success'`, `total_origem=contagem`, `message` (nota explícita de que comparação/aplicação ficam para estágios 6–8), `details.estagios[]` com tempos por estágio (base da calibração R5). Resposta `200 { sync_id, status: "success" }` `[CONFIRMED: code]`.

Falha técnica em qualquer estágio → `failure` (evento do estágio com `{ erro, duration_ms }` + `details.estagios[]` com o estágio `status: 'erro'`) e resposta `500 { sync_id, status: "failure", error }`. Falha ANTES do claim (ex.: INSERT com erro de rede) não tem sync a marcar — resposta `500 { status: "failure", error }` sem `sync_id` `[CONFIRMED: code]`.

## Autenticação / autorização

- **GET (cron):** exige `Authorization: Bearer ${CRON_SECRET}` — comparação **timing-safe** (`crypto.timingSafeEqual`); ausência/erro do Bearer → `401`. A Vercel envia o header automaticamente quando a env `CRON_SECRET` existe (design §4.3) `[CONFIRMED: code]`.
- **POST (manual):** exige Bearer com JWT de sessão; validação via `supabase.auth.getUser(token)` + checagem `role = 'admin'` em `usuarios` (mesmo critério do painel) — sem JWT válido ou não-admin → `403`. O `id` do admin vai em `requested_by` `[CONFIRMED: code]`.
- **Método não permitido → `405` + `Allow: GET, POST`.**
- Todas as escritas via **service role** (`REFERENCIAS_SYNC_*` dedicadas — sem fallback, DEBT-0006): `referencia_syncs`, `referencia_eventos`, `referencia_snapshots`, `referencia_backups` (nenhuma policy de escrita; RLS admin-only SELECT — migration M1) `[CONFIRMED: code, database]`.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `REFERENCIAS_SYNC_SUPABASE_URL` / `REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY` | credenciais service role do banco (dedicadas, **obrigatórias, sem fallback**) |
| `CRON_SECRET` | Bearer do cron (GET) |
| `POWERBI_RESOURCE_KEY` | resource key pública do relatório Power BI (nunca hardcoded — D-1) |

Env ausente → `500 { error: "Missing environment variable: ..." }` antes do claim (configuração não polui a trilha) `[CONFIRMED: code]`. Inventário completo: [../security/secrets-and-environments.md](../security/secrets-and-environments.md).

## Tratamento de erros

- Erros técnicos (fetch, decode, INSERT/UPDATE) → sync `failure`, evento do estágio com `erro`, `500` com `{ sync_id, status: "failure", error }` — **sem retry** (B9) `[CONFIRMED: code]`.
- Origem inválida é estado TERMINAL da sync (`origin_invalid`) — resposta `200` (a sync processou; a ORIGEM é que reprovou) `[CONFIRMED: code]`.
- Erro ao marcar `failure` (UPDATE final falha) é logado; resposta `500` segue `[CONFIRMED: code]`.

## Logging

- `console.info` no sucesso com `[referencias-sync]`, trigger, sync id, duração e contagem `[CONFIRMED: code]`.
- `console.error` em falha de estágio, falha ao marcar failure e falha inesperada, com prefixo `[referencias-sync]` `[CONFIRMED: code]`.
- Auditoria estruturada em `referencia_eventos` (sync_started/extraction/validation/snapshot_created/backup_created) e `details.estagios[]` em `referencia_syncs` `[CONFIRMED: code]`.

## Relação com o banco (M1 — migration 20260905000000)

Execução grava em `referencia_syncs` (unidade, `sync_status`, single-flight B10), `referencia_eventos` (auditoria B7), `referencia_snapshots`/`referencia_backups` (B3). Nenhuma escrita em `referencias` nem `registros` no M2 `[CONFIRMED: code, database]`.

## Testes

- `src/shared/powerbi/{decode,extract,validate}.test.ts` — port + guardas do design §4.2 (máscaras, 32 colunas, desalinhamento, nomes, fail-high do patch) e matriz de validação §6.3 (46 casos) `[CONFIRMED: test]`.
- `api/referencias-sync.test.ts` — no espelho de `api/keepalive.test.ts` (mock `createClient` + mock do módulo de extração; validação real): cron feliz com ordem de eventos, 401/403, 409 single-flight, `origin_invalid` sem artifacts, falha técnica → failure, manual admin, 405 (9 casos) `[CONFIRMED: test]`.

## Evidências

- E1 — Código: `api/referencias-sync.ts`, `src/shared/powerbi/*.ts` `[CONFIRMED: code]`
- E2 — Testes: `api/referencias-sync.test.ts`, `src/shared/powerbi/*.test.ts` `[CONFIRMED: test]`
- E3 — Cron: `vercel.json` `[CONFIRMED: configuration]`
- E4 — Schema das tabelas de sync: `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` `[CONFIRMED: database]`
- E5 — Design: `.ai/.temp/feat0017-fase1-design-2026-09-04.md` §4.3/§6.2/§16 `[CONFIRMED: .temp — design FEAT-0017]`

## Veja também

- [api-keepalive.md](api-keepalive.md), [overview.md](overview.md), [background-jobs.md](background-jobs.md)
- [../security/secrets-and-environments.md](../security/secrets-and-environments.md)
- Migration M1: `supabase/migrations/20260905000000_referencias_sync_tabelas.sql`
