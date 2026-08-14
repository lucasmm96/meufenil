# Feature Spec: Consentimento LGPD

**ID:** FEAT-0002
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Obter o aceite do usuário para coleta e processamento de dados antes do uso da aplicação, registrando a data do consentimento.

## Actors

- Usuário

## Preconditions

- Usuário autenticado SEM `usuarios.consentimento_lgpd_em` preenchido

## Main Flow

1. Dashboard renderiza `ConsentimentoLGPD` enquanto `!usuario.consentimento_lgpd_em` `[CONFIRMED: code — Dashboard.tsx:75]`.
2. Modal apresenta dados coletados, finalidade e direitos (textos fixos) `[CONFIRMED: code — ConsentimentoLGPD.tsx:34-80]`.
3. "Aceitar e Continuar" → `updateConsentimentoLGPD(usuario.id)` grava a data/hora → reload; modal não reaparece `[CONFIRMED: code — Dashboard.tsx:50-53]`.

## Alternative Flows

- Nenhum identificado (modal reaparece a cada carga até o aceite persistir).

## Error Flows

- Falha no aceite → `AppError("CONSENTIMENTO_ERROR")` logado; sem UI de erro `[CONFIRMED: code — dashboard.service.ts]`.

## Business Rules

- [BR-028](../domain/business-rules.md)

## Frontend

- [components/consentimento-lgpd](../frontend/components/consentimento-lgpd.md), [pages/dashboard](../frontend/pages/dashboard.md)

## Backend

- N/A

## Database

- [usuarios](../database/usuarios.md) (`consentimento_lgpd_em`)

## Security

- [security-model](../security/security-model.md) (contexto de dados pessoais; sem enforcement adicional de segurança)

## Tests

- `dashboard.service.test.ts` (updateConsentimentoLGPD coberto no service)
- **Coverage status:** PARTIALLY TESTED (componente sem teste)

## Dependencies

- FEAT-0001 (sessão), FEAT-0005 (Dashboard)

## Related Features

- [FEAT-0010 Perfil](FEAT-0010-perfil-usuario.md) (direitos: exportar/excluir)

## Evidence

- E1 — `Dashboard.tsx:50-53,75`, `ConsentimentoLGPD.tsx` completo `[CONFIRMED: code]`
- E2 — Coluna `consentimento_lgpd_em` no catálogo `[CONFIRMED: database]`

## Unknowns

- Nenhum.
