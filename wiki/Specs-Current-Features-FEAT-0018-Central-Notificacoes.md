# Feature Spec: Central de Notificações ao Usuário

**ID:** FEAT-0018
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-10-09 (v1.20.0 — PR #118)

## Purpose

Canal estruturado de comunicação assíncrona app → usuário: badge no header com contagem de não lidas, atualizado em tempo real via Supabase Realtime, e painel overlay de notificações sem mudança de rota. Admin pode enviar mensagens broadcast ou para usuário específico. Alerta de saúde gerado automaticamente por trigger ao atingir o limite diário de fenilalanina.

## Actors

- Usuário autenticado (leitura, marcação como lida)
- Admin (envio de mensagens via painel admin)
- Trigger de banco (`trg_health_alert_notificacao` — geração de `health_alert`)
- Vercel Cron diário (`api/notificacoes-cleanup.ts`, `0 4 * * *` UTC — limpeza de expiradas)
- service_role (cleanup, INSERT service-side)

## Main Flow

1. Badge no `Layout.tsx` exibe contagem de notificações não lidas (`read_at IS NULL AND expires_at > now()`); subscription Supabase Realtime em `notificacoes` por `user_id` atualiza o contador em tempo real.
2. Clicar no ícone abre o painel overlay (sem mudança de rota); feed exibe notificações com tipo, título, corpo, timestamp e estado (lida/não lida).
3. Usuário marca notificação lida via RPC `marcar_notificacao_lida(notificacao_id)` ou todas via `marcar_todas_notificacoes_lidas()`.
4. Notificações persistem por até 30 dias (`expires_at = created_at + 30 days`); Vercel Cron deleta as com `expires_at ≤ now()` diariamente.
5. Admin envia notificação via painel administrativo: broadcast (`target = 'broadcast'`) ou para usuário específico (`target = 'user'`); INSERT protegido por RLS `notificacoes_insert_admin_only` (exige `is_admin_user(auth.uid())`).
6. `health_alert`: trigger `trg_health_alert_notificacao` (SECURITY DEFINER) dispara após INSERT/UPDATE em `registros`; compara total diário com `limite_diario_mg`; insere notificação se limite atingido, evitando duplicatas nas últimas 24h.
7. Login-as: badge e feed exibem notificações do `usuarioAtivoId` (usuário assumido).

## Database

- **Tabela:** `notificacoes` (campos: `id`, `user_id`, `type`, `title`, `body`, `read_at`, `created_at`, `expires_at`, `target`). Campo `type` é string livre — extensível sem alteração de schema. `target = 'user'` (padrão) ou `'broadcast'`.
- **RLS (3 políticas):**
  - `notificacoes_select_proprias_e_broadcasts`: `user_id = auth.uid() OR target = 'broadcast'`
  - `notificacoes_insert_admin_only`: INSERT para `authenticated` com `is_admin_user(auth.uid())`
  - `notificacoes_update_propria`: UPDATE para `authenticated` em linhas do próprio `user_id`
- **Realtime:** tabela adicionada a `supabase_realtime` via `ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes` (migration).
- **RPCs (SECURITY INVOKER):** `marcar_notificacao_lida(notificacao_id)`, `marcar_todas_notificacoes_lidas()`
- **Trigger:** `trg_health_alert_notificacao` — AFTER INSERT OR UPDATE em `registros`; função `fn_health_alert_notificacao` (SECURITY DEFINER)

## Frontend

- **Layout.tsx:** badge no header com ícone de sino; subscription Realtime no hook `useNotificacoes`
- **Hook:** `useNotificacoes(usuarioId)` — consulta, Realtime e ações (marcar lida/todas)
- **Service:** `notificacoes.service.ts` — operações client-side
- **Painel overlay:** componente de feed abre/fecha via estado local; sem rota própria
- **Admin:** nova seção no painel administrativo para envio de notificações (broadcast ou por usuário)

## Security

- RLS garante que usuário acessa apenas notificações próprias ou broadcasts — sem acesso cruzado.
- INSERT direto bloqueado para `authenticated` sem papel admin; service_role bypassa RLS (cleanup, INSERT service-side).
- `fn_health_alert_notificacao` é SECURITY DEFINER para inserir em `notificacoes` contornando RLS e ler `usuarios.limite_diario_mg`.
- Chave service_role nunca no bundle do browser (apenas Vercel cron / Edge Functions).

## Tests

- 12 testes em `notificacoes.service.test.ts`
- 7 testes em `useNotificacoes.test.ts`

## Post-Deploy

Migration `20261005000000_feat0018_central_notificacoes.sql` deve ser aplicada em produção:
```bash
bash scripts/db/apply-supabase-migrations.sh --env production
```
Verificar tabela `notificacoes` na lista Realtime do dashboard Supabase (prod). Rastreamento: Issue #119 — milestone v1.20.0.

## References

- Spec: `.ai/specs/proposed/features/FEAT-0018-central-notificacoes.md`
- Issue: #116 | PR: #118
- Migration: `supabase/migrations/20261005000000_feat0018_central_notificacoes.sql`
- Post-Deploy: Issue #119
