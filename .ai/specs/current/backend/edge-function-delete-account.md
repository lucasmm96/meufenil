# Edge Function — delete-account

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `supabase/functions/delete-account/index.ts` (Deno, serve HTTP)

## Propósito

Exclusão completa de conta do usuário: remove os dados da aplicação e o usuário do Supabase Auth, respeitando a ordem exigida pelas FKs.

## Configuração

- Declarada em `supabase/config.toml`: `[functions.delete-account]` com `enabled = true`, `verify_jwt = true`, `import_map = "./functions/delete-account/deno.json"`, entrypoint `./functions/delete-account/index.ts` — ÚNICA função declarada no config `[CONFIRMED: configuration]`.
- CORS próprio inline (`Access-Control-Allow-Origin: *`, POST/OPTIONS); `_shared/cors.ts` não é importado `[CONFIRMED: code]`.

## Autenticação e autorização

- Header `Authorization: Bearer <token>` obrigatório → `401 { error: "Missing authorization header" }` `[CONFIRMED: code]`.
- Validação do token em DOIS estágios `[CONFIRMED: code — index.ts:27-52]`:
  1. cliente **anon** com o Bearer repassado como header global (`autoRefreshToken: false`, `persistSession: false`) → `auth.getUser()` → `401 { error: "Usuário não autenticado", details }` se inválido;
  2. a partir daí, `userId = data.user.id` (a operação atua SOMENTE sobre o próprio usuário autenticado — não há parâmetro de alvo).
- Efeitos executados com cliente **service role** (bypassa RLS) `[CONFIRMED: code — index.ts:54-58]`.

## Sequência de execução

1. `DELETE FROM registros WHERE usuario_id = userId` (service role)
2. `DELETE FROM usuarios WHERE id = userId` (service role)
3. `supabaseAdmin.auth.admin.deleteUser(userId)` (remove o usuário no Supabase Auth)

`[CONFIRMED: code — index.ts:60-83]`

## Dados afetados e dependências (cascades)

| Passo | Por quê | Efeito em cascata |
|---|---|---|
| registros primeiro | FK `registros.usuario_id → usuarios(id)` **sem** ON DELETE — a remoção do perfil falharia com registros presentes | — |
| usuarios em seguida | FK `usuarios.id → auth.users(id)` ON DELETE CASCADE — remover o perfil não remove o usuário do Auth; a remoção do Auth removeria o perfil | exclusões em cascata pelas FKs: `exames_pku`, `referencias` (criadas pelo usuário), `referencias_favoritas`, `delegacoes_acesso` (concedente e delegado) |
| auth.admin.deleteUser | remove a identidade no Supabase Auth | trigger/fk de `auth.users` |

`[CONFIRMED: code; database — FKs em ../database/*.md]`

## Erros e resposta

- Falha em qualquer passo → exceção → `500 { error: "Erro ao excluir conta", details: <message|JSON> }` com `console.error("DELETE ACCOUNT ERROR:", err)` — operação NÃO é transacional (se falhar no passo 2/3, os passos anteriores já ocorreram) `[CONFIRMED: code]`.
- Sucesso → `200 { success: true }` `[CONFIRMED: code]`.
- OPTIONS → preflight `204` `[CONFIRMED: code]`.

## Chamadores frontend

Invocada pela página Perfil (`Perfil.tsx:141`) via **`fetch` direto** para `${VITE_SUPABASE_URL}/functions/v1/delete-account` com `Authorization: Bearer <access_token>` da sessão — fluxo: `confirm("Deseja realmente excluir sua conta?")` → `prompt('Digite "EXCLUIR" para confirmar:')` → POST → em sucesso `signOut()` e navegação para `/`; em falha `alert("Erro ao excluir conta")` `[CONFIRMED: code — src/react-app/pages/Perfil.tsx:127-160]`. Detalhe da UI na Fase 5.

## Testes

Nenhum teste identificado para esta edge function `[CONFIRMED: ausência — filesystem]`.

## Evidências

- E1 — Código completo: `supabase/functions/delete-account/index.ts` `[CONFIRMED: code]`
- E2 — Configuração: `supabase/config.toml` (verify_jwt = true) `[CONFIRMED: configuration]`
- E3 — FKs e cascades: catálogo (Fase 2) + [../database/usuarios.md](../database/usuarios.md), [../database/registros.md](../database/registros.md) `[CONFIRMED: database]`
- E4 — `.npmrc` e `deno.json` presentes no diretório da função `[CONFIRMED: filesystem]`

## Veja também

- [edge-function-delegar-acesso.md](edge-function-delegar-acesso.md), [overview.md](overview.md)
- [../database/usuarios.md](../database/usuarios.md), [../security/security-model.md](../security/security-model.md)
