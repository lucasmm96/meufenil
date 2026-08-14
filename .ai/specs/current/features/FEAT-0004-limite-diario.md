# Feature Spec: Limite diário personalizado

**ID:** FEAT-0004
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Permitir que o usuário defina seu teto pessoal de fenilalanina por dia e ver o consumo do dia em relação a ele (total, percentual, restante e alerta de ultrapassagem).

## Actors

- Usuário; Delegado (apenas consulta — Perfil é read-only no modo delegado)

## Preconditions

- Usuário ativo definido

## Main Flow

1. **Definição:** Perfil → campo "Limite diário de fenilalanina (mg)" → `atualizarUsuarioPerfil` (disabled para delegado) `[CONFIRMED: code — Perfil.tsx, usuarios.service]`.
2. **Valores padrão (fatos):** coluna `limite_diario_mg` default 500; novos usuários recebem 150 via trigger `handle_new_user` `[CONFIRMED: database, migration]`.
3. **Indicadores (Dashboard):** total do dia, `percentual = (total/limite)×100` com barra, `restante = max(0, limite−total)` `[CONFIRMED: code — Dashboard.tsx:47,159,173]`.
4. **Alerta:** se `total > limite` → card vermelho + box "Limite ultrapassado" com o excesso `[CONFIRMED: code — Dashboard.tsx:48,220-233]`.

## Alternative Flows

- Nenhum identificado.

## Error Flows

- Falha ao salvar → `AppError("USER_PROFILE_UPDATE_ERROR")` logado; `alert("Perfil atualizado com sucesso!")` apenas em sucesso `[CONFIRMED: code]`.

## Business Rules

- [BR-002](../domain/business-rules.md), [BR-003](../domain/business-rules.md), [BR-004](../domain/business-rules.md), [BR-025](../domain/business-rules.md)

## Frontend

- [pages/perfil](../frontend/pages/perfil.md), [pages/dashboard](../frontend/pages/dashboard.md)
- `usePerfil`, `usuarios.service`, `useDashboard`

## Backend

- N/A

## Database

- [usuarios](../database/usuarios.md) (`limite_diario_mg`), [registros](../database/registros.md)

## Security

- [security-model](../security/security-model.md) (política UPDATE do próprio perfil; delegado sem edição via UI)

## Tests

- `usuarios.service.test.ts` (5, 100%), `usePerfil.test.ts` (5)
- **Coverage status:** PARTIALLY TESTED (indicadores do Dashboard sem teste de página)

## Dependencies

- FEAT-0001, FEAT-0003 (registros)

## Related Features

- [FEAT-0005 Dashboard](FEAT-0005-dashboard.md), [FEAT-0010 Perfil](FEAT-0010-perfil-usuario.md)

## Evidence

- E1 — `Dashboard.tsx:47-48,127-176,220-233`, `Perfil.tsx`, `usuarios.service.ts` `[CONFIRMED: code]`
- E2 — Default 500 + trigger 150: catálogo + baseline linhas 120-148 `[CONFIRMED: database, migration]`

## Unknowns

- Motivo/intenção do valor 150 no sign-up (U-7.3).
