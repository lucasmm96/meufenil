# Tabela public.usuarios

**Última verificação:** 2026-08-14 (migration 20260814000000 aplicada em dev e prod)
**DDL versionado em:** `supabase/migrations/20260103015052_remote_schema.sql` (linhas 201–275); políticas consolidadas ("Usuário vê/atualiza/cria próprio perfil"): `supabase/migrations/20260814000000_baseline_objetos_nao_versionados.sql` (DEBT-0001). Também presente no legado `migrations/usuarios.sql`

## Propósito

Perfil do usuário da aplicação: papel (`user`/`admin`), limite diário de fenilalanina, fuso horário e consentimento LGPD. Espelha `auth.users` — `id` é o próprio id do usuário Supabase Auth.

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | — | NO | PK; FK → `auth.users(id)` ON DELETE CASCADE | identidade = id do Auth |
| `nome` | text | — | YES | — | preenchido pelo trigger no sign-up |
| `email` | text | — | YES | UNIQUE (`usuarios_email_key`) | |
| `role` | text | `'user'::text` | NO | — | `'user'` ou `'admin'` (ver regras) |
| `limite_diario_mg` | real | `500` | NO | — | limite diário em mg |
| `timezone` | text | `'America/Sao_Paulo'::text` | NO | — | |
| `consentimento_lgpd_em` | timestamp with time zone | — | YES | — | data/hora do consentimento LGPD |
| `created_at` | timestamp with time zone | `now()` | YES | — | |
| `updated_at` | timestamp with time zone | `now()` | YES | — | |

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13]`

- `usuarios_pkey` — PRIMARY KEY (`id`)
- `usuarios_email_key` — UNIQUE (`email`)
- `usuarios_id_fkey` — FOREIGN KEY (`id`) REFERENCES `auth.users(id)` ON DELETE CASCADE
- Índices: apenas os implícitos de PK e UNIQUE. Nenhum índice adicional.

## Relacionamentos (FKs)

- **Referencia:** `auth.users(id)` — 1:1, ON DELETE CASCADE (excluir o usuário no Auth exclui o perfil)
- **É referenciada por** (5 tabelas):
  - `referencias.criado_por` → `usuarios(id)` ON DELETE CASCADE
  - `registros.usuario_id` → `usuarios(id)` (sem CASCADE — ver `registros.md`)
  - `exames_pku.usuario_id` → `usuarios(id)` ON DELETE CASCADE
  - `referencias_favoritas.usuario_id` → `usuarios(id)` ON DELETE CASCADE
  - `delegacoes_acesso.concedente_id` e `delegacoes_acesso.delegado_id` → `usuarios(id)` ON DELETE CASCADE

## Políticas RLS desta tabela

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `Usuário vê próprio perfil` | SELECT | public | USING: `id = auth.uid()` | catálogo; migration 20260814000000 (baseline tinha nomes diferentes, ver nota) |
| `Usuário atualiza próprio perfil` | UPDATE | public | USING: `id = auth.uid()`; WITH CHECK: (vazio) | catálogo; migration 20260814000000 |
| `Usuário cria próprio perfil` | INSERT | public | WITH CHECK: `id = auth.uid()` | catálogo; migration 20260814000000 |
| `admin_only` | SELECT | public | USING: `auth.uid() = id` | baseline (linha 313) e catálogo |
| `admin_can_select_all_usuarios` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260811210456 e catálogo |

Notas factuais:
- A política de UPDATE não restringe colunas: o RLS permite que o usuário altere qualquer coluna da própria linha, incluindo `role` `[CONFIRMED: database — pg_policies.with_check vazio]`.
- As políticas do baseline com nomes antigos ("usuario ve seu perfil", "usuarios_select_own", "usuarios_insert_self", "usuarios_update_own", "usuario cria seu perfil", "usuario atualiza seu perfil", "Usuarios podem ler seu próprio perfil", "debug_allow_all") NÃO existem no banco real; o conjunto atual foi consolidado/renomeado e versionado pela migration 20260814000000 (DEBT-0001) `[CONFIRMED: database × migration]`.
- `debug_allow_all` foi removida pela migration de segurança (2026-08-11) `[CONFIRMED: migration]`.

## Regras de negócio associadas

- Papel de administrador = `usuarios.role = 'admin'` (implementado em `is_admin_user` — ver [rpc.md](rpc.md)).
- Limite diário: o default da COLUNA é `500`, mas o trigger `handle_new_user` insere `150` em novos usuários (ver [triggers.md](triggers.md)) — ambos são fatos do schema atual.
- Delegação de acesso referencia esta tabela em `delegacoes_acesso` (ver spec própria e `../security/security-model.md` — Fase 3).

## Lifecycle

- **Criação:** pelo trigger `on_auth_user_created` (`handle_new_user`) no sign-up — `nome` = `raw_user_meta_data->>'full_name'` ou `email`, `role = 'user'`, `timezone = 'America/Sao_Paulo'`, `limite_diario_mg = 150`; `on conflict (id) do nothing` `[CONFIRMED: migration, baseline linhas 120–148]`.
- **Atualização:** pelo próprio usuário (página Perfil: limite diário, timezone) sob a política "Usuário atualiza próprio perfil"; `consentimento_lgpd_em` definido pela aplicação (componente `ConsentimentoLGPD`) `[CONFIRMED: code — usuarios.service.ts, ConsentimentoLGPD.tsx]`.
- **Exclusão:** cascata a partir de `auth.users` (FK CASCADE). A edge function `delete-account` exclui `registros` do usuário antes de `usuarios` `[CONFIRMED: code — supabase/functions/delete-account/index.ts:61,70]`.
- **Leitura por admin:** via `admin_can_select_all_usuarios` (painel administrativo) `[CONFIRMED: code — admin.service.ts]`.

## RPCs e triggers que tocam esta tabela

- `handle_new_user` (INSERT) — [rpc.md](rpc.md)
- `is_admin_user` (SELECT sobre `role`) — [rpc.md](rpc.md)
- `dashboard_hoje` (SELECT sobre `limite_diario_mg`) — [rpc.md](rpc.md)
- Edge functions `delegar-acesso` e `delete-account` leem/escrevem nesta tabela (detalhe na Fase 4) `[CONFIRMED: code — supabase/functions/*]`

## Testes que cobrem esta tabela

- `src/shared/security/rls-usuarios.test.ts` — políticas RLS de visibilidade (próprio perfil × admin) `[CONFIRMED: test]`
- `src/shared/security/auth-real-validation.test.ts` — validação real de autenticação `[CONFIRMED: test]`
- `src/react-app/services/usuarios.service.test.ts` — serviço `usuarios.service` `[CONFIRMED: test]`

## Evidências

- E1 — Colunas, constraints, índices e flags RLS: catálogo dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — DDL: baseline `20260103015052_remote_schema.sql` linhas 201–275 e legado `migrations/usuarios.sql` `[CONFIRMED: migration]`
- E3 — Políticas: `pg_policies` dev e prod (2026-08-13) `[CONFIRMED: database]`
- E4 — Chamadores no código: 27 referências `.from("usuarios")` em `src/` e 3 em `supabase/functions/` `[CONFIRMED: code — grep, 2026-08-13]`
- E5 — Contagens de linhas: dev = 2, prod = 7 (2026-08-13) `[CONFIRMED: database]`

## Veja também

- [rpc.md](rpc.md), [triggers.md](triggers.md), [delegacoes_acesso.md](delegacoes_acesso.md)
- `../security/security-model.md` (Fase 3) — papéis e autorização
- `../frontend/pages/perfil.md` (Fase 5) — uso pela página Perfil
