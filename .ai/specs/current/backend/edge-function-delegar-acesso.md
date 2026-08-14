# Edge Function — delegar-acesso

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `supabase/functions/delegar-acesso/index.ts` (Deno, serve HTTP)

## Propósito

Gerenciar a delegação de acesso entre usuários: conceder, revogar, listar, assumir e sair de perfis — o mecanismo que permite a um usuário (delegado) operar em nome de outro (concedente). O modelo de autorização subjacente está em [../security/security-model.md](../security/security-model.md) (seção 9) e a tabela em [../database/delegacoes_acesso.md](../database/delegacoes_acesso.md).

## Configuração

- **NÃO está declarada** em `supabase/config.toml` (apenas `delete-account` está). Como é deployada/configurada (JWT verification, env vars) no Supabase: `UNKNOWN` — requer acesso ao dashboard `[CONFIRMED: configuration — supabase/config.toml; ausência]`.
- CORS próprio inline (`Access-Control-Allow-Origin: *`, métodos POST/OPTIONS); o módulo compartilhado `supabase/functions/_shared/cors.ts` NÃO é importado por esta função `[CONFIRMED: code]`.

## Autenticação

- Exige header `Authorization: Bearer <token>` → `401 { error: "Token ausente" }` se ausente/malformado `[CONFIRMED: code]`.
- Valida o token com cliente **service role**: `supabaseAdmin.auth.getUser(accessToken)` → `401 { error: "Usuário não autenticado" }` se inválido `[CONFIRMED: code — index.ts:43-59]`.
- `userId` = id do usuário autenticado; usado como concedente/delegado nas operações `[CONFIRMED: code]`.

## Operações

Todas via POST com corpo JSON `{ acao, ... }` `[CONFIRMED: code]`.

### listar

- Payload: `{ acao: "listar" }`.
- Consulta `delegacoes_acesso` com service role: concedidos (`concedente_id = userId`, `revoked_at IS NULL`) e recebidos (`delegado_id = userId`, `revoked_at IS NULL`), com joins aninhados em `usuarios`.
- **Divergência factual:** os joins usam nomes de FK que NÃO existem no catálogo (`usuarios!delegacoes_acesso_delegado_id_fkey` / `..._concedente_id_fkey`; os reais são `delegacoes_acesso_delegado_fk` / `delegacoes_acesso_concedente_fk`) — a consulta falharia no nível do banco (erro PostgREST de relacionamento inexistente; sem tratamento específico → catch genérico → `500`) `[CONFIRMED: code × database]`.
- **Não é usada pelo frontend:** a listagem real é feita client-side via RLS (`delegacoesAcesso.service.ts:54-97`, nomes de FK corretos, política `Listar Delegações`) `[CONFIRMED: code]`.
- Resposta (quando funcional): `{ concedidos, recebidos }` com `usuario_destino`/`usuario_origem` `[CONFIRMED: code]`.

### conceder

- Payload: `{ acao: "conceder", email }`.
- Validações: email obrigatório (`400` "email inválido"); alvo localizado por `email` em `usuarios` (`404` "Usuário não encontrado"); auto-concessão bloqueada (`400` "Acesso a si mesmo não é permitido") `[CONFIRMED: code]`.
- INSERT `{ concedente_id: userId, delegado_id: usuarioAlvo.id }` via service role `[CONFIRMED: code]`.
- Concessão duplicada ativa viola o índice único parcial `delegacoes_acesso_unique_ativo` → erro no banco SEM tratamento específico → `500` "Erro interno" `[CONFIRMED: code × database — ../database/delegacoes_acesso.md]`.
- Resposta: `{ success: true }`.

### revogar

- Payload: `{ acao: "revogar", delegacao_id }`.
- UPDATE `revoked_at = now()` WHERE `id = delegacao_id AND concedente_id = userId` (só o concedente revoga) `[CONFIRMED: code]`.
- Sem verificação de linhas afetadas: responde `{ success: true }` mesmo se nada foi atualizado `[CONFIRMED: code]`.

### assumir

- Payload: `{ acao: "assumir", delegacao_id }`.
- SELECT da delegação WHERE `id = delegacao_id AND delegado_id = userId AND revoked_at IS NULL` → se não encontrada: `403 { error: "Acesso não autorizado" }` `[CONFIRMED: code]`.
- Busca dados do owner em `usuarios`; responde `{ usuario_assumido_id, owner: { id, nome, email } }` `[CONFIRMED: code]`.
- **Não altera token/sessão** — o frontend guarda o resultado em `sessionStorage` (`meufenil:login-as`) e a autorização do perfil assumido é exercida por RLS/RPCs via `delegacoes_acesso` `[CONFIRMED: code — delegacoesAcesso.service.ts, AuthContext.tsx; ../security/security-model.md]`.

### sair

- Payload: `{ acao: "sair" }` → `{ success: true }` (a limpeza do estado ocorre no cliente) `[CONFIRMED: code]`.

### Ação desconhecida

- `400 { error: "Ação não suportada" }` `[CONFIRMED: code]`.

## Erros e edge cases

- Método diferente de POST → `405 { error: "Method not allowed" }`; OPTIONS → preflight CORS `200` `[CONFIRMED: code]`.
- Corpo inválido (JSON não parseável) → `acao` indefinido → `400 { error: "acao inválida" }` `[CONFIRMED: code]`.
- Qualquer exceção não tratada → `500 { error: "Erro interno" }` com `console.error("Erro delegar-acesso:", err)` `[CONFIRMED: code]`.

## Uso pelo frontend

`delegacoesAcesso.service.ts`: `concederAcesso`, `revogarAcesso` e `sairDoPerfilAssumido` usam `fetch` com Bearer do session atual; `assumirPerfil` usa `supabase.functions.invoke("delegar-acesso", ...)` `[CONFIRMED: code]`. Consumidores na UI: `AuthContext` (conceder/revogar/assumir/sair), componentes `login-as/` e páginas Perfil/Admin (detalhe na Fase 5).

## Testes

Nenhum teste identificado para esta edge function `[CONFIRMED: ausência — filesystem]`. A autorização subjacente é coberta indiretamente pelos testes de RLS/RPC em `src/shared/security/` `[CONFIRMED: test]`.

## Evidências

- E1 — Código completo: `supabase/functions/delegar-acesso/index.ts` `[CONFIRMED: code]`
- E2 — Chamadores: `src/react-app/services/delegacoesAcesso.service.ts` `[CONFIRMED: code]`
- E3 — Tabela e índice: catálogo + `../database/delegacoes_acesso.md` `[CONFIRMED: database]`
- E4 — Divergências de FK e de `config.toml` `[CONFIRMED: code × database × configuration]`

## Veja também

- [../database/delegacoes_acesso.md](../database/delegacoes_acesso.md), [../security/security-model.md](../security/security-model.md)
- [edge-function-delete-account.md](edge-function-delete-account.md), [overview.md](overview.md)
