# Modelo de Segurança — MeuFenil

**Última verificação:** 2026-08-13 (commit 6323664)

Este documento consolida o modelo de segurança ATUAL do MeuFenil (autenticação, autorização, RLS, delegação e RPCs). A definição canônica de cada política RLS permanece nas specs das tabelas em `../database/` — aqui o modelo é explicado, relacionado e sintetizado em matrizes (regra "link, não copie").

## 1. Authentication

- **Provedor:** Supabase Auth com **Google OAuth** — login via `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: /dashboard } })` `[CONFIRMED: code — src/react-app/hooks/useUser.ts:50-57]`.
- **Cliente:** `supabase-js` criado no frontend com a **anon key** (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) `[CONFIRMED: code — src/react-app/lib/supabase.ts]`.
- **Sessão:** bootstrap via `supabase.auth.getSession()` + listener `onAuthStateChange` `[CONFIRMED: code — src/react-app/context/AuthContext.tsx:67-82]`. A sessão é gerenciada pelo SDK (armazenamento local do navegador).
- **Identificação do usuário:** o id da sessão Auth (`auth.uid()`) é a identidade usada em TODAS as policies e RPCs. `auth.users × public.usuarios`: FK `usuarios.id → auth.users(id)` ON DELETE CASCADE + criação do perfil pelo trigger `on_auth_user_created` (`handle_new_user`) `[CONFIRMED: migration, database — ver ../database/usuarios.md e ../database/triggers.md]`.
- **Logout:** `supabase.auth.signOut()` via `auth.service.logout`; `AuthContext.signOut` também remove a sessão login-as do `sessionStorage` `[CONFIRMED: code — src/react-app/services/auth.service.ts, AuthContext.tsx:157-162]`.
- **Contexto de usuário ativo:** `AuthContext` expõe `authUser` (sessão real) e `usuarioAtivoId` (usuário em operação — o próprio ou o assumido via login-as); `useUsuarioAtivo` consolida para as páginas `[CONFIRMED: code — AuthContext.tsx:104-105, useUsuarioAtivo.ts]`.
- **Login-as NÃO altera o token:** "assumir perfil" é estado de UI guardado em `sessionStorage` (chave `meufenil:login-as`); a identidade de autenticação real continua sendo a do **delegado**. Toda a autorização do usuário assumido é exercida pelas policies/RPCs via `delegacoes_acesso` — não há impersonação de JWT `[CONFIRMED: code — AuthContext.tsx:13,134-149; delegacoesAcesso.service.ts]`.

## 2. Authorization

- **Papéis:** `usuarios.role` (text, default `'user'`; `'admin'` confere privilégios). Não há roles customizadas do Supabase Auth versionadas no repositório `[CONFIRMED: migration, database — ../database/usuarios.md]`.
- **Duas formas de checagem de admin coexistem** `[CONFIRMED: database, migration]`:
  1. `public.is_admin_user(auth.uid())` — verifica `usuarios.role = 'admin'` (usada em policies de `usuarios`/`background_job_executions` e nos 2 RPCs);
  2. `auth.jwt() ->> 'role' = 'admin'` — claim do JWT Supabase (usada nas policies UPDATE/DELETE de `referencias`).
  - Se existem usuários com role JWT `admin` no Supabase Auth: `UNKNOWN` — requer acesso ao dashboard Supabase (não verificável pelo repositório/catálogo).
- **Ownership:** colunas de dono comparadas com `auth.uid()` (`usuarios.id`, `referencias.criado_por`, `registros.usuario_id`, `exames_pku.usuario_id`, `referencias_favoritas.usuario_id`).
- **Delegação:** `delegacoes_acesso` com `revoked_at IS NULL` = delegação ativa; usada por 15 policies ("dono ou delegado") e pelos 2 RPCs de referências (seção 9).
- **Aplicação:** a autorização é exercida integralmente no banco (RLS + RPCs). O frontend não implementa checagens de autorização próprias além de esconder/mostrar UI (ex.: página admin protegida por papel) `[CONFIRMED: code — src/react-app/hooks/useAdmin.ts]`.

## 3. Matriz de autorização (consolidada)

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13; cada célula referencia a policy canônica na spec da tabela]`

Legenda: **Sim** = permitido pelo RLS · **Não** = sem política vigente · anon = não autenticado · "dono" = titular do recurso.

| Recurso | Operação | Dono | Delegado | Admin | Anon | Evidência (policy) |
|---|---|---|---|---|---|---|
| usuarios | SELECT (próprio) | Sim | — | Sim | Não | `Usuário vê próprio perfil`, `admin_only` |
| usuarios | SELECT (todos) | Não | Não | Sim | Não | `admin_can_select_all_usuarios` |
| usuarios | INSERT | Sim (id próprio) | Não | Não | Não | `Usuário cria próprio perfil` |
| usuarios | UPDATE | Sim (qualquer coluna da própria linha, incl. `role`) | Não | Não | Não | `Usuário atualiza próprio perfil` |
| usuarios | DELETE | Não | Não | Não | Não | sem política (remoção via auth.users cascade / edge function) |
| referencias | SELECT | Sim | Sim | Sim | Sim (apenas `is_global = true`) | `Usuário lista referências` + demais |
| referencias | INSERT | Sim | Sim | Sim | Não | `Usuário cria própria referencia`, `Adicionar...dono ou delegado`, `Admin adiciona referencias` |
| referencias | UPDATE | Sim | Sim | Sim | Não | `Atualizar...dono ou delegado`, `Admin atualiza referencias` |
| referencias | DELETE | Sim (não-global, sem vínculo) | Sim (idem) | Sim (inclusive global; exige sem vínculo) | Não | `Remover referencia como dono ou delegado` |
| registros | SELECT | Sim | Sim | **Não** | Não | `Listar registro como dono ou delegado` |
| registros | INSERT | Sim (ref. ativa) | Sim (ref. ativa) | Não | Não | `Adicionar...`, `Inserir registro apenas com referencia ativa` |
| registros | UPDATE | Não | Não | Não | Não | sem política |
| registros | DELETE | Sim | Sim | Não | Não | `Remover...`, `Usuário pode deletar seus próprios registros` |
| exames_pku | SELECT / INSERT / UPDATE / DELETE | Sim | Sim | Não | Não | políticas "dono ou delegado" |
| referencias_favoritas | SELECT / INSERT / DELETE | Sim (referência visível) | Sim (favoritos próprios; referências do concedente) | Não | Não | políticas de favoritos |
| referencias_favoritas | UPDATE | Não | Não | Não | Não | sem política |
| delegacoes_acesso | SELECT | Sim (concedente e delegado) | Sim (concedente e delegado) | Não | Não | `Listar Delegações` |
| delegacoes_acesso | INSERT | Sim (concedente; `delegado_id <> auth.uid()`) | Não | Não | Não | `Usuário concede acesso ao proprio perfil` |
| delegacoes_acesso | UPDATE | Sim (revogação pelo concedente) | Não | Não | Não | `Usuário revoga acessos concedidos ao proprio perfil` |
| delegacoes_acesso | DELETE | Não | Não | Não | Não | sem política (revogação = UPDATE) |
| background_job_executions | SELECT | Não | Não | Sim | Não | `admin_can_select_background_job_executions` |
| background_job_executions | INSERT / UPDATE / DELETE | Não | Não | Não | Não | sem políticas (escrita via service_role) |

Observações factuais sobre a matriz:
- Admin NÃO possui acesso RLS a `registros`, `exames_pku`, `referencias_favoritas` e `delegacoes_acesso` — o painel admin usa `get_estatisticas_admin` (SECURITY DEFINER) para números agregados `[CONFIRMED: database, code — admin.service.ts:75]`.
- Anon consegue listar referências globais (`is_global = true`) — consequência direta das policies SELECT de `referencias` com alvo `public` `[CONFIRMED: database]`.

## 4. Ownership Matrix

| Recurso | Coluna de ownership | Dono = | Evidência |
|---|---|---|---|
| usuarios | `id` | `auth.uid() = id` | ../database/usuarios.md |
| referencias | `criado_por` | `auth.uid() = criado_por` | ../database/referencias.md |
| registros | `usuario_id` | `auth.uid() = usuario_id` | ../database/registros.md |
| exames_pku | `usuario_id` | `auth.uid() = usuario_id` | ../database/exames_pku.md |
| referencias_favoritas | `usuario_id` | `auth.uid() = usuario_id` | ../database/referencias_favoritas.md |
| delegacoes_acesso | `concedente_id` (concessão/revogação) e `delegado_id` (visualização/assunção) | dono da linha = concedente; delegado só lê/assume | ../database/delegacoes_acesso.md |
| background_job_executions | (nenhum) | — | ../database/background_job_executions.md |

## 5. Delegation Matrix

O delegado (par com delegação ativa) pode, em nome do concedente:

| Recurso | Operações permitidas ao delegado | Restrições | Evidência |
|---|---|---|---|
| registros | SELECT, INSERT, DELETE | referência ativa no INSERT | ../database/registros.md |
| exames_pku | SELECT, INSERT, UPDATE, DELETE | — | ../database/exames_pku.md |
| referencias | SELECT, INSERT, UPDATE, DELETE | DELETE: não-global + sem registros vinculados | ../database/referencias.md |
| referencias_favoritas | favoritar/desfavoritar/ver referências DO CONCEDENTE | o favorito criado pertence ao DELEGADO (`usuario_id = auth.uid()`), não ao concedente | ../database/referencias_favoritas.md |
| usuarios | **nenhuma** | — | ../database/usuarios.md |
| delegacoes_acesso | visualizar delegações recebidas | não concede/revoga | ../database/delegacoes_acesso.md |

Revogação (`revoked_at` preenchido) remove imediatamente o acesso, pois todas as checagens exigem `revoked_at IS NULL` `[CONFIRMED: database, migration]`.

## 6. Admin Matrix

Admin = `usuarios.role = 'admin'` (verificado por `is_admin_user` nas policies/RPCs) OU claim JWT `role = 'admin'` (nas 2 policies de `referencias`):

| Via | O que o admin pode | Evidência |
|---|---|---|
| RLS `usuarios` | SELECT de todos os perfis | `admin_can_select_all_usuarios` |
| RLS `referencias` | INSERT/UPDATE/SELECT/DELETE, incluindo referências GLOBAIS (exclusivo do admin) | policies "Admin ..." + `Remover...` |
| RLS `background_job_executions` | SELECT do histórico de jobs | `admin_can_select_background_job_executions` |
| RPC `ativar_referencia` | ativar qualquer referência | ../database/rpc.md |
| RPC `remover_ou_desativar_referencia` | remover qualquer referência, inclusive global | ../database/rpc.md |
| RPC `get_estatisticas_admin` | chamado pelo painel admin (`admin.service.ts:75`) — a função em si NÃO verifica papel internamente | ../database/rpc.md |
| RLS `registros` / `exames_pku` / `referencias_favoritas` / `delegacoes_acesso` | **nenhum acesso direto** (sem políticas de admin) | matriz acima |

## 7. RPC Authorization Matrix

| RPC | Quem pode chamar (grants) | Verificação de autorização INTERNA | Efeito autorizado | Evidência |
|---|---|---|---|---|
| `ativar_referencia` | todas as roles (EXECUTE) | Sim — dono OU delegado ativo OU admin | ativa referência | ../database/rpc.md |
| `remover_ou_desativar_referencia` | todas as roles (EXECUTE) | Sim — dono/delegado/admin + global→admin + vínculo→soft-delete | remove/desativa | ../database/rpc.md |
| `is_admin_user` | `authenticated` + `service_role` (+ `anon` via default privileges) | Não (função de verificação) | retorna boolean | ../database/rpc.md |
| `get_estatisticas_admin` | `anon`, `authenticated`, `service_role` (REVOKE FROM PUBLIC) | **Não** — qualquer chamador recebe as estatísticas | agregações globais | ../database/rpc.md |
| `dashboard_hoje` | todas as roles (EXECUTE) | **Não** — aceita qualquer `uid` | soma do dia + limite | ../database/rpc.md |
| `dashboard_ultimos_dias` | todas as roles (EXECUTE) | **Não** — aceita qualquer `uid` | soma por dia | ../database/rpc.md |
| funções de trigger (`handle_new_user`, `fn_normalizar_nome_referencia`, `fn_trim_background_job_executions`, `fn_remover_favoritos_referencia_inativa`) | EXECUTE concedido a todas as roles | Não aplicável | efeitos de trigger; chamável diretamente como RPC é `UNKNOWN` (não verificado) | ../database/rpc.md |

## 8. RLS — modelo consolidado

- **RLS habilitado nas 7 tabelas** `[CONFIRMED: database]`. Grants de tabela são amplos (todas as roles com privilégios completos) — o RLS é a fronteira efetiva `[CONFIRMED: database — ../database/overview.md]`.
- **Padrões transversais**:
  1. **Ownership:** `auth.uid() = <coluna dono>`.
  2. **Delegação:** `EXISTS (delegacoes_acesso WHERE concedente_id = <dono> AND delegado_id = auth.uid() AND revoked_at IS NULL)`.
  3. **Admin:** `is_admin_user(auth.uid())` ou `auth.jwt()->>'role' = 'admin'` (apenas em `referencias`).
  4. **Visibilidade de referências:** `is_global = true OR criado_por = auth.uid()` (+ variante delegado).
  5. **Invariantes de negócio no RLS:** INSERT de registro exige referência ativa; DELETE de referência bloqueado com registros vinculados; global só por admin `[CONFIRMED: database]`.
- **Detalhe por tabela:** policies canônicas em ../database/<tabela>.md (seções "Políticas RLS desta tabela") — não duplicadas aqui.
- **Políticas redundantes vigentes:** 2 policies SELECT idênticas em `referencias` e 2 policies SELECT equivalentes em `usuarios` (`admin_only` ≡ `Usuário vê próprio perfil`); DELETE de `registros` com 2 policies sobrepostas (dono ⊂ dono/delegado) `[CONFIRMED: database]`.
- **Políticas do baseline removidas:** ~15 políticas antigas (ex.: `debug_allow_all`, `usuario ve registros`) não existem no banco real; consolidação feita por canal não-versionado (ver ../database/overview.md e seção 13) `[CONFIRMED: database × migration]`.

## 9. Delegação de acesso (deep-dive)

**Modelo:** delegação por PAR (concedente → delegado), com estado ativo/revogado; registro persistente em `public.delegacoes_acesso` (DDL não-versionado — ver [../database/delegacoes_acesso.md](../database/delegacoes_acesso.md)).

- **Conceder:** edge function `delegar-acesso` (ação `conceder`) — valida Bearer token (`auth.getUser` com service role), localiza o alvo por `email` em `usuarios`, bloqueia auto-concessão (`Acesso a si mesmo não é permitido`), INSERT `{concedente_id, delegado_id}`. Concessão duplicada ativa viola o índice único parcial `delegacoes_acesso_unique_ativo` (erro no DB; a function não trata o caso — resposta 500 genérica) `[CONFIRMED: code — supabase/functions/delegar-acesso/index.ts:118-157; database]`.
- **Consultar:** o FRONTEND lista direto via RLS (`listarDelegacoes` com anon client, policy `Listar Delegações`) usando os nomes de FK CORRETOS (`delegacoes_acesso_delegado_fk`/`_concedente_fk`). A ação `listar` da edge function existe, mas referencia nomes de FK INEXISTENTES no catálogo (`delegacoes_acesso_delegado_id_fkey`/`_concedente_id_fkey`) — não é usada pelo frontend `[CONFIRMED: code × database]`.
- **Revogar:** edge function (ação `revogar`) — UPDATE `revoked_at = now()` onde `id = delegacao_id AND concedente_id = userId`; retorna sucesso mesmo se nada foi atualizado. Sem DELETE físico `[CONFIRMED: code; database]`.
- **Assumir:** edge function (ação `assumir`) — verifica delegação ativa onde `delegado_id = userId`; retorna `usuario_assumido_id` + dados do owner. O frontend guarda em `sessionStorage` (`meufenil:login-as`); a sessão Auth NÃO muda `[CONFIRMED: code]`.
- **Sair:** edge function (ação `sair`) — retorna sucesso; o estado é limpo apenas no cliente (`sessionStorage`) `[CONFIRMED: code]`.
- **Estado ativo:** `revoked_at IS NULL`; consumido por 15 policies e 2 RPCs `[CONFIRMED: database, migration]`.
- **Impacto nas policies:** seção 5 (Delegation Matrix).
- **Impacto nos RPCs:** `ativar_referencia` e `remover_ou_desativar_referencia` tratam delegado como dono `[CONFIRMED: migration]`.
- **Reativação após revogação:** a aplicação atual não possui fluxo de reativação — o código apenas insere novas delegações; se revogar+e-conceder cria nova linha ou reutiliza: `UNKNOWN` (U-2.4, pendente de observação) `[CONFIRMED: ausência de fluxo no código; UNKNOWN comportamento]`.

## 10. RPC security (aspectos de segurança)

Resumo dos aspectos de segurança; especificação completa em [../database/rpc.md](../database/rpc.md):

- `ativar_referencia` / `remover_ou_desativar_referencia`: SECURITY DEFINER com verificação interna (dono/delegado/admin) — endurecidas na migration 20260811; idênticas no banco `[CONFIRMED: migration, database]`.
- `is_admin_user`: função de apoio de autorização; `STABLE`; grants revogados de PUBLIC (mas `anon` mantém EXECUTE via default privileges — fato do catálogo) `[CONFIRMED: database]`.
- `get_estatisticas_admin`: SECURITY DEFINER, SEM verificação de papel interna; chamada pelo painel admin; qualquer role com EXECUTE recebe os agregados `[CONFIRMED: migration, database, code]`.
- `dashboard_hoje` / `dashboard_ultimos_dias`: SECURITY DEFINER, SEM verificação interna, SEM `search_path` configurado; sem chamadores no código atual `[CONFIRMED: migration, database, code]`.
- Funções de trigger: `handle_new_user` (SECURITY DEFINER, sem search_path) grava perfil no sign-up; `fn_trim_background_job_executions` (SECURITY DEFINER, search_path public) apaga registros antigos `[CONFIRMED: migration, database]`.

## 11. SECURITY DEFINER

| Função | SECURITY DEFINER | search_path | Owner | Identidade efetiva | RLS | Chamadores conhecidos | Evidência |
|---|---|---|---|---|---|---|---|
| `ativar_referencia` | Sim | `public` | postgres | postgres (superuser) | bypassado pelo definer | `referencias.service.ts:246` | ../database/rpc.md |
| `remover_ou_desativar_referencia` | Sim | `public` | postgres | postgres | bypassado | `referencias.service.ts:263` | ../database/rpc.md |
| `is_admin_user` | Sim | `public` | postgres | postgres | bypassado (leitura) | policies + 2 RPCs | ../database/rpc.md |
| `get_estatisticas_admin` | Sim | `public` | postgres | postgres | bypassado (agregados) | `admin.service.ts:75` | ../database/rpc.md |
| `dashboard_hoje` | Sim | **não configurado** | postgres | postgres | bypassado | nenhum no código | ../database/rpc.md |
| `dashboard_ultimos_dias` | Sim | **não configurado** | postgres | postgres | bypassado | nenhum no código | ../database/rpc.md |
| `handle_new_user` | Sim | **não configurado** | postgres | postgres | bypassado | trigger `on_auth_user_created` | ../database/rpc.md |
| `fn_trim_background_job_executions` | Sim | `public` | postgres | postgres | bypassado | trigger de retenção | ../database/rpc.md |
| `fn_normalizar_nome_referencia` | Não (INVOKER) | — | postgres | chamador | respeita RLS | trigger BEFORE em referencias | ../database/rpc.md |
| `fn_remover_favoritos_referencia_inativa` | Não (INVOKER) | — | postgres | chamador | respeita RLS | trigger AFTER em referencias | ../database/rpc.md |

`[CONFIRMED: migration — ALTER FUNCTION ... OWNER TO postgres no baseline; database — pg_proc.prosecdef/proconfig]`

## 12. Testes de segurança

- **Localização:** `src/shared/security/` — `auth-real-validation.test.ts`, `rls-usuarios.test.ts`, `rpc-ativar-referencia.test.ts`, `rpc-remover-referencia.test.ts` + `test-helpers.ts` `[CONFIRMED: filesystem]`.
- **Abordagem:** "Abordagem B" — clientes Supabase JS com **JWTs reais** (auth real contra o ambiente de development), usando `.env.development`; service role para criar usuários de teste `[CONFIRMED: code — test-helpers.ts:1-14]`.
- **Cenários cobertos:**
  - Autenticação real (AV.1–AV.7): criação de usuário de teste, cliente anon bloqueado por RLS, visibilidade de role própria, admin vê todos, usuário comum não vê terceiros `[CONFIRMED: test]`
  - RLS de `usuarios` (T1.0–T1.4): próprio/admin × terceiros, incluindo T1.0 (detecção legada de `debug_allow_all`, "sempre passa" — ver abaixo) `[CONFIRMED: test]`
  - RPC `ativar_referencia` (T2.0–T2.5): não-autorizado, dono, delegado, admin, inexistente `[CONFIRMED: test]`
  - RPC `remover_ou_desativar_referencia` (T3.0–T3.8): não-autorizado, dono (delete hard × soft), delegado, admin, global, inexistente `[CONFIRMED: test]`
- **Testes legados de vulnerabilidade:** T1.0, T2.0 e T3.0 documentam o comportamento PRÉ-correção e são construídos para "sempre passar" (apenas registram o estado via `console.warn`) `[CONFIRMED: test — rls-usuarios.test.ts:53-67]`.
- **Helper de estado de migration:** `isSecurityMigrationApplied()` (test-helpers.ts:352) verifica via `pg_policies` se `admin_can_select_all_usuarios` existe antes de executar os testes de RLS `[CONFIRMED: test]`.
- Sem cobertura dedicada identificada para policies de `referencias_favoritas` e `delegacoes_acesso` `[CONFIRMED: ausência — filesystem]`. (Avaliação de suficiência pertence à Fase 6.)

## 13. Vulnerabilidades históricas × estado atual

| Item histórico (análises 02/04) | Estado ATUAL |
|---|---|
| `debug_allow_all` em `usuarios` (SELECT irrestrito, severidade ALTA) | **Removida** pela migration 20260811 e ausente do banco real `[CONFIRMED: migration, database]` |
| `ativar_referencia` sem verificação de autorização | **Corrigido** na migration 20260811 (dono/delegado/admin); definição no banco = migration `[CONFIRMED: migration, database]` |
| `remover_ou_desativar_referencia` sem verificação | **Corrigido** na migration 20260811 (+ proteção de globais e vínculo) `[CONFIRMED: migration, database]` |
| Políticas redundantes de `usuarios`/`referencias` (severidade BAIXA) | Parcialmente consolidadas no banco (por canal não-versionado); 2 redundâncias SELECT permanecem vigentes em `referencias` (fato — seção 8) `[CONFIRMED: database]` |

Histórico completo: `.ai/.temp/analyses/02-auditoria-seguranca.md` a `12-aplicacao-migration-seguranca-producao.md` (material de trabalho; validado contra o estado atual).

## Evidências

- E1 — Políticas, funções, grants e RLS: catálogo dev/prod (2026-08-13) `[CONFIRMED: database]`
- E2 — Migrations: baseline, 20260807, 20260810, 20260811 `[CONFIRMED: migration]`
- E3 — Código de auth/delegação: `AuthContext.tsx`, `useUser.ts`, `auth.service.ts`, `lib/supabase.ts`, `delegacoesAcesso.service.ts`, `useUsuarioAtivo.ts` `[CONFIRMED: code]`
- E4 — Edge functions: `delegar-acesso/index.ts`, `delete-account/index.ts` `[CONFIRMED: code]`
- E5 — Testes: `src/shared/security/*` `[CONFIRMED: test]`
- E6 — `supabase/config.toml` (`verify_jwt = true` para delete-account) `[CONFIRMED: configuration]`

## Veja também

- ../database/ (policies canônicas por tabela), ../database/rpc.md, ../database/triggers.md
- [secrets-and-environments.md](secrets-and-environments.md)
- ../system-map.md
