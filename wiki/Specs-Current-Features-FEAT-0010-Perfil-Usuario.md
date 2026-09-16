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

- [BR-026](Specs-Current-Domain-Business-Rules), [BR-029](Specs-Current-Domain-Business-Rules)

## Frontend

- [pages/perfil](Specs-Current-Frontend-Pages-Perfil), [components/login-as](Specs-Current-Frontend-Components-Login-As)
- `usePerfil`, `usuarios.service`, `useLayoutPerfil`

## Backend

- [edge-function-delete-account](Specs-Current-Backend-Edge-Function-Delete-Account) (exclusão em 3 passos)

## Database

- [usuarios](Specs-Current-Database-Usuarios), [registros](Specs-Current-Database-Registros) (excluídos antes do perfil)

## Security

- [security-model](Specs-Current-Security-Security-Model) (políticas do perfil; exclusão via service role)

## Tests

- `usuarios.service.test.ts` (5, 100%), `usePerfil.test.ts` (5), `useLayoutPerfil.test.ts` (4)
- **Coverage status:** PARTIALLY TESTED (página, export e fluxo de exclusão sem teste; edge function sem teste)

## Dependencies

- FEAT-0001, FEAT-0011 (delegação)

## Related Features

- [FEAT-0002 Consentimento](Specs-Current-Features-FEAT-0002-Consentimento-Lgpd), [FEAT-0004 Limite](Specs-Current-Features-FEAT-0004-Limite-Diario)

## Evidence

- E1 — `Perfil.tsx` completo `[CONFIRMED: code]`
- E2 — `delete-account/index.ts` `[CONFIRMED: code]`

## Unknowns

- Nenhum.
