# Feature Spec: Delegação de acesso (login-as)

**ID:** FEAT-0011
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Permitir que um usuário (delegado) opere em nome de outro (concedente): conceder/revogar acessos, assumir um perfil e voltar à própria conta — com a autorização exercida no banco via `delegacoes_acesso`.

## Actors

- Concedente (dono do perfil); Delegado (recebe/assume); Usuário real (identidade de sessão — nunca muda)

## Preconditions

- Ambos os usuários autenticados; concedente e delegado cadastrados em `usuarios`

## Main Flow

1. **Conceder:** Perfil → "Conceder acesso" → `ModalConcederAcesso` (email, erro inline) → edge function `conceder` (valida Bearer, localiza alvo por email, bloqueia auto-concessão, INSERT) `[CONFIRMED: code]`.
2. **Assumir:** `AcessosRecebidosCard` → "assumir" → edge function valida delegação ativa → retorna `usuario_assumido_id` + owner → UI grava em `sessionStorage["meufenil:login-as"]` `[CONFIRMED: code — AuthContext.tsx:134-149]`.
3. **Operar como usuário ativo:** todas as páginas usam `usuarioAtivoId`; o banco autoriza via 15 policies "dono ou delegado" e 2 RPCs `[CONFIRMED: database, security]`.
4. **Voltar:** banner âmbar "Você está acessando o perfil de {nome}" + "Voltar para minha conta" → limpa sessionStorage `[CONFIRMED: code — LoginAsBanner.tsx]`.
5. **Revogar:** `AcessosConcedidosCard` → edge function `revogar` (UPDATE `revoked_at`, efeito imediato) `[CONFIRMED: code]`.

## Alternative Flows

- Logout real também limpa a sessão login-as `[CONFIRMED: code — AuthContext.tsx:157-162]`.
- Perfil em modo delegado é somente-leitura (privacidade oculta) `[CONFIRMED: code — Perfil.tsx]`.

## Error Flows

- Edge function: 401 token ausente/inválido, 404 alvo não encontrado, 400 auto-concessão/email inválido, 403 assumir sem delegação ativa, 500 genérico (inclusive colisão do índice único) `[CONFIRMED: code — delegar-acesso/index.ts]`.
- UI: erro inline no modal de concessão; demais ações propagam sem UI própria `[CONFIRMED: code]`.

## Business Rules

- [BR-013](../domain/business-rules.md), [BR-015](../domain/business-rules.md), [BR-020](../domain/business-rules.md), [BR-021](../domain/business-rules.md), [BR-022](../domain/business-rules.md)

## Frontend

- [components/login-as](../frontend/components/login-as.md), [pages/perfil](../frontend/pages/perfil.md)
- `delegacoesAcesso.service`, `AuthContext`, `useUsuarioAtivo`

## Backend

- [edge-function-delegar-acesso](../backend/edge-function-delegar-acesso.md)

## Database

- [delegacoes_acesso](../database/delegacoes_acesso.md), [usuarios](../database/usuarios.md)

## Security

- [security-model](../security/security-model.md) (seção 9 — deep-dive da delegação)

## Tests

- Suítes reais cobrem delegado em RPCs: `rpc-ativar` (T2.3), `rpc-remover` (T3.4)
- **Coverage status:** PARTIALLY TESTED (serviço, edge function, componentes e policies de delegacoes_acesso SEM teste)

## Dependencies

- FEAT-0001, FEAT-0008 (referências — RPCs com delegado), FEAT-0010

## Related Features

- [FEAT-0003 Registro](FEAT-0003-registro-diario-consumo.md), [FEAT-0009 Exames](FEAT-0009-exames-pku.md) (operações delegadas)

## Evidence

- E1 — `delegar-acesso/index.ts` completo, `delegacoesAcesso.service.ts`, `AuthContext.tsx` `[CONFIRMED: code]`
- E2 — Tabela/policies: catálogo + migration `[CONFIRMED: database, migration]`

## Unknowns

- Reativação de delegação revogada (U-2.4).
- Configuração de deploy da edge function no Supabase (U-4.1).
