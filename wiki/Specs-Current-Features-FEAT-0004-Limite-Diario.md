# Feature Spec: Limite diário personalizado

**ID:** FEAT-0004
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-15 (DEBT-0002)

## Purpose

Permitir que o usuário defina seu teto pessoal de fenilalanina por dia e ver o consumo do dia em relação a ele (total, percentual, restante e alerta de ultrapassagem).

## Actors

- Usuário; Delegado (apenas consulta — Perfil é read-only no modo delegado)

## Preconditions

- Usuário ativo definido

## Main Flow

1. **Definição:** Perfil → campo "Limite diário de fenilalanina (mg)" → `atualizarUsuarioPerfil` (disabled para delegado) `[CONFIRMED: code — Perfil.tsx, usuarios.service]`.
2. **Valores padrão (fatos):** coluna `limite_diario_mg` default 500; novos usuários recebem 500 (default da coluna — o trigger `handle_new_user` não define limite desde a DEBT-0002) `[CONFIRMED: database, migration]`.
3. **Indicadores (Dashboard):** total do dia, `percentual = (total/limite)×100` com barra, `restante = max(0, limite−total)` `[CONFIRMED: code — Dashboard.tsx:47,159,173]`.
4. **Alerta:** se `total > limite` → card vermelho + box "Limite ultrapassado" com o excesso `[CONFIRMED: code — Dashboard.tsx:48,220-233]`.

## Alternative Flows

- Nenhum identificado.

## Error Flows

- Falha ao salvar → `AppError("USER_PROFILE_UPDATE_ERROR")` logado; `alert("Perfil atualizado com sucesso!")` apenas em sucesso `[CONFIRMED: code]`.

## Business Rules

- [BR-002](Specs-Current-Domain-Business-Rules), [BR-003](Specs-Current-Domain-Business-Rules), [BR-004](Specs-Current-Domain-Business-Rules), [BR-025](Specs-Current-Domain-Business-Rules)

## Frontend

- [pages/perfil](Specs-Current-Frontend-Pages-Perfil), [pages/dashboard](Specs-Current-Frontend-Pages-Dashboard)
- `usePerfil`, `usuarios.service`, `useDashboard`

## Backend

- N/A

## Database

- [usuarios](Specs-Current-Database-Usuarios) (`limite_diario_mg`), [registros](Specs-Current-Database-Registros)

## Security

- [security-model](Specs-Current-Security-Security-Model) (política UPDATE do próprio perfil; delegado sem edição via UI)

## Tests

- `usuarios.service.test.ts` (5, 100%), `usePerfil.test.ts` (5)
- **Coverage status:** PARTIALLY TESTED (indicadores do Dashboard sem teste de página)

## Dependencies

- FEAT-0001, FEAT-0003 (registros)

## Related Features

- [FEAT-0005 Dashboard](Specs-Current-Features-FEAT-0005-Dashboard), [FEAT-0010 Perfil](Specs-Current-Features-FEAT-0010-Perfil-Usuario)

## Evidence

- E1 — `Dashboard.tsx:47-48,127-176,220-233`, `Perfil.tsx`, `usuarios.service.ts` `[CONFIRMED: code]`
- E2 — Default 500 da coluna (baseline linha 206) + trigger sem limite explícito: migration `20260815000000_limite_diario_default_500.sql` `[CONFIRMED: database, migration]`

## Unknowns

- Nenhum. (U-7.3 — intenção do 150 no sign-up — tornou-se irrelevante: valor removido pela DEBT-0002, decisão B.)
