# Feature Spec: Perfil do usuário + privacidade

**ID:** FEAT-0010
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Gerir os dados pessoais do usuário (nome, limite diário), seus acessos concedidos/recebidos, e exercer direitos de privacidade: exportar dados (JSON) e excluir a conta.

## Actors

- Usuário; Delegado (modo somente-leitura: campos desabilitados, cards de delegação read-only e seção de privacidade OCULTA)

## Preconditions

- Usuário ativo definido

## Main Flow

1. Form "Informações Pessoais": nome (required), e-mail (sempre disabled), limite diário (number, required); "Salvar alterações" → `salvar()` → `alert("Perfil atualizado com sucesso!")` `[CONFIRMED: code — Perfil.tsx:60-70]`.
2. Cards de delegação (concedidas/recebidas) — detalhe em FEAT-0011 `[CONFIRMED: code]`.
3. "Exportar meus dados": consulta DIRETA ao supabase na página (usuarios.* + registros) → JSON `{usuario, registros, exportado_em, versao: "1.0"}` → download `meufenil-dados-{data}.json` `[CONFIRMED: code — Perfil.tsx:72-124]`.
4. "Excluir minha conta": `confirm` + `prompt('Digite "EXCLUIR" para confirmar:')` → POST `functions/v1/delete-account` com Bearer → sucesso: `signOut()` + navegação `/`; falha: `alert("Erro ao excluir conta")` `[CONFIRMED: code — Perfil.tsx:127-160]`.

## Alternative Flows

- Delegado visualiza perfil do concedente com aviso âmbar ("apenas para consulta") `[CONFIRMED: code — Perfil.tsx:184-190]`.

## Error Flows

- Export falha → `alert("Erro ao exportar dados")`; exclusão falha → `alert("Erro ao excluir conta")` `[CONFIRMED: code]`.

## Business Rules

- [BR-026](../domain/business-rules.md), [BR-029](../domain/business-rules.md)

## Frontend

- [pages/perfil](../frontend/pages/perfil.md), [components/login-as](../frontend/components/login-as.md)
- `usePerfil`, `usuarios.service`, `useLayoutPerfil`

## Backend

- [edge-function-delete-account](../backend/edge-function-delete-account.md) (exclusão em 3 passos)

## Database

- [usuarios](../database/usuarios.md), [registros](../database/registros.md) (excluídos antes do perfil)

## Security

- [security-model](../security/security-model.md) (políticas do perfil; exclusão via service role)

## Tests

- `usuarios.service.test.ts` (5, 100%), `usePerfil.test.ts` (5), `useLayoutPerfil.test.ts` (4)
- **Coverage status:** PARTIALLY TESTED (página, export e fluxo de exclusão sem teste; edge function sem teste)

## Dependencies

- FEAT-0001, FEAT-0011 (delegação)

## Related Features

- [FEAT-0002 Consentimento](FEAT-0002-consentimento-lgpd.md), [FEAT-0004 Limite](FEAT-0004-limite-diario.md)

## Evidence

- E1 — `Perfil.tsx` completo `[CONFIRMED: code]`
- E2 — `delete-account/index.ts` `[CONFIRMED: code]`

## Unknowns

- Nenhum.
