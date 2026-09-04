# Tabela public.referencias_favoritas

**Última verificação:** 2026-09-04 (ENH-0004 — preservação de favoritos na desativação; migration 20260904000000 aplicada em dev)
**DDL versionado em:** `supabase/migrations/20260814000000_baseline_objetos_nao_versionados.sql` (DEBT-0001) — tabela, constraints, índice e políticas. DDL abaixo conferido contra o catálogo dos bancos dev e prod (2026-08-14) `[CONFIRMED: database × migration]`. Origem/canal de criação: `UNKNOWN` (git mostra apenas commits de código da feature de favoritos).

## Propósito

Favoritos do usuário: relação N:N entre `usuarios` e `referencias` marcando as referências favoritas para filtros na página de referências.

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `usuario_id` | uuid | — | NO | FK → `usuarios(id)` ON DELETE CASCADE | |
| `referencia_id` | uuid | — | NO | FK → `referencias(id)` ON DELETE CASCADE | |
| `created_at` | timestamp with time zone | `now()` | NO | — | NOT NULL (diferente do padrão das tabelas do baseline) |

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13]`

- `referencias_favoritas_pkey` — PRIMARY KEY (`id`)
- `referencias_favoritas_usuario_fk` — FOREIGN KEY (`usuario_id`) REFERENCES `usuarios(id)` ON DELETE CASCADE
- `referencias_favoritas_referencia_fk` — FOREIGN KEY (`referencia_id`) REFERENCES `referencias(id)` ON DELETE CASCADE
- `referencias_favoritas_unique` — UNIQUE INDEX btree (`usuario_id`, `referencia_id`) — um favorito por par usuário/referência
- Nenhuma CHECK constraint.

## Relacionamentos (FKs)

- **Referencia:** `usuarios(id)` e `referencias(id)` — ambos ON DELETE CASCADE (favoritos somem com o usuário ou com a referência).
- **É referenciada por:** nenhuma outra tabela.

## Políticas RLS desta tabela

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `Ver favoritos como dono delegado ou global` | SELECT | public | USING: `usuario_id = auth.uid() AND EXISTS (referencias r WHERE r.id = referencia_id AND (r.is_global = true OR r.criado_por = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono da referência)))` | catálogo; migration 20260814000000 |
| `Favoritar referencia como dono delegado ou global` | INSERT | public | WITH CHECK: mesma condição (usuário é dono do favorito E a referência é visível: global, própria ou de concedente) | catálogo; migration 20260814000000 |
| `Desfavoritar referencia como dono delegado ou global` | DELETE | public | USING: mesma condição | catálogo; migration 20260814000000 |

Nota factual: não existe política de UPDATE nesta tabela `[CONFIRMED: database]`.

## Regras de negócio associadas

- Um favorito por par (usuário, referência) — índice único `[CONFIRMED: database]`.
- Favorito exige referência visível ao usuário (global, própria ou de concedente ativo) `[CONFIRMED: database]`.
- **Desativação/arquivamento NÃO remove favoritos** desde a ENH-0004 (OQ3/BR-036): o trigger `trg_remover_favoritos_referencia_inativa` foi eliminado (migration 20260904000000); a referência arquivada permanece favoritada, é exibida como inativa/indisponível, não pode ser usada em novos registros e pode ser desfavoritada normalmente `[CONFIRMED: migration 20260904000000 — ver triggers.md]`.

## Lifecycle

- **Criação:** pelo usuário ao favoritar na página de referências (`referencias.service` — `.from("referencias_favoritas")`) `[CONFIRMED: code]`.
- **Exclusão:** desfavoritar (DELETE) `[CONFIRMED: code]`; cascata por usuário ou referência (FK CASCADE vale apenas na remoção HARD — pessoais sem registros; desativação não remove o favorito) `[CONFIRMED: database]`.

## RPCs e triggers que tocam esta tabela

- Nenhum trigger toca esta tabela desde a ENH-0004 (o `trg_remover_favoritos_referencia_inativa` foi eliminado) `[CONFIRMED: migration 20260904000000 — ver triggers.md]`.
- Nenhum RPC toca esta tabela `[CONFIRMED: database]`.

## Testes que cobrem esta tabela

- `src/react-app/services/referencias.service.test.ts` — cobre o serviço que usa esta tabela (favoritos) `[CONFIRMED: test]`
- Nenhum teste de segurança dedicado a esta tabela identificado `[CONFIRMED: ausência — src/shared/security/ contém testes de RLS apenas para usuarios e RPCs]`

## Evidências

- E1 — Colunas, constraints, índices, RLS e políticas: catálogo dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — Ausência de DDL em todas as migrations versionadas e legadas até a baseline 20260814000000 (DEBT-0001), que o versiona `[CONFIRMED: ausência em migrations — grep, 2026-08-13; migration 20260814000000]`
- E3 — Chamadores no código: 5 referências `.from("referencias_favoritas")` em `src/` (favoritos e filtros em `referencias.service.ts:36-59,111`) `[CONFIRMED: code]`
- E4 — Contagens: não coletadas individualmente (sem contagem dedicada na coleta de 2026-08-13) `[UNKNOWN: evidência necessária — SELECT count(*) na tabela]`

## Veja também

- [referencias.md](referencias.md), [usuarios.md](usuarios.md), [triggers.md](triggers.md)
- `../frontend/pages/referencias.md` (Fase 5)
