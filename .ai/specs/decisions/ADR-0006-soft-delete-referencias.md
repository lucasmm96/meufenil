# ADR-0006 — Soft delete de referências via coluna de estado + RPC

**Status:** Accepted
**Origin:** RECONSTRUCTED
**Data da decisão:** UNKNOWN (coluna `is_ativa` e RPC endurecidos/consolidados até 2026-08-11)
**Reconstruída por engenharia reversa em:** 2026-08-13

## Context

Referências alimentares com registros vinculados não podem ser excluídas fisicamente (FK sem CASCADE): o RPC `remover_ou_desativar_referencia` marca `is_ativa = false` (retorna `'deactivated'`) quando há vínculo, ou DELETE hard (`'deleted'`) quando não há; a policy DELETE reproduz a mesma regra; a desativação remove favoritos (trigger) e impede novos registros (policy INSERT) `[CONFIRMED: database, migration — Fases 2–3]`.

## Decision

Modelar remoção de referências como soft delete (`is_ativa`) preservando o histórico de registros, com desativação/reativação via RPCs autorizados.

## Origin

RECONSTRUCTED — a coluna `is_ativa` não possui DDL versionado e não há registro explícito da decisão; reconstruída da implementação (RPC + policies + trigger + UI).

## Evidence

- RPC `remover_ou_desativar_referencia` e `ativar_referencia` (migration 20260811) `[CONFIRMED: migration]`
- Coluna `is_ativa boolean NOT NULL default true` (catálogo; NÃO versionada) `[CONFIRMED: database]`
- Trigger `trg_remover_favoritos_referencia_inativa` + policy "Inserir registro apenas com referencia ativa" `[CONFIRMED: database]`
- UI: confirm com aviso "se houver registros associados, ela será apenas desativada" + fallback FK 23503 `[CONFIRMED: code — Referencias.tsx:80,92-95]`

## Consequences (OBSERVED)

1. Histórico de registros preservado ao desativar referência `[CONFIRMED: database]`.
2. Favoritos de referência desativada são removidos automaticamente `[CONFIRMED: database]`.
3. Duas vias de enforcement coexistem (RPC e policy DELETE) com a mesma regra `[CONFIRMED: database]`.
4. Referências inativas aparecem riscadas na UI e podem ser reativadas por quem tem permissão `[CONFIRMED: UI]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/database/referencias.md](../current/database/referencias.md), [../current/database/rpc.md](../current/database/rpc.md), [../current/features/FEAT-0008-referencias-alimentares.md](../current/features/FEAT-0008-referencias-alimentares.md), [../current/domain/business-rules.md](../current/domain/business-rules.md) (BR-018, BR-024)
