# Tabela public.exames_pku

**Última verificação:** 2026-08-13 (commit 6323664)
**DDL versionado em:** `supabase/migrations/20260103015052_remote_schema.sql` (linhas 158–168, 217–255) — legado: `migrations/exames_pku.sql`

## Propósito

Histórico de exames laboratoriais de PKU do usuário: data do exame e resultado de fenilalanina no sangue em mg/dL.

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `usuario_id` | uuid | — | NO | FK → `usuarios(id)` ON DELETE CASCADE | |
| `data_exame` | date | — | NO | — | data do exame |
| `resultado_mg_dl` | real | — | NO | — | resultado em mg/dL |
| `created_at` | timestamp with time zone | `now()` | YES | — | |
| `updated_at` | timestamp with time zone | `now()` | YES | — | |

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13]`

- `exames_pku_pkey` — PRIMARY KEY (`id`)
- `exames_pku_usuario_id_fkey` — FOREIGN KEY (`usuario_id`) REFERENCES `usuarios(id)` ON DELETE CASCADE
- Nenhuma CHECK constraint; nenhum índice além do implícito da PK.

## Relacionamentos (FKs)

- **Referencia:** `usuarios(id)` — ON DELETE CASCADE (excluir o usuário exclui os exames)
- **É referenciada por:** nenhuma outra tabela `[CONFIRMED: database]`.

## Políticas RLS desta tabela

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `Listar exame como dono ou delegado` | SELECT | public | USING: `usuario_id = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; NÃO versionada |
| `Adicionar exame como dono ou delegado` | INSERT | public | WITH CHECK: `usuario_id = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; NÃO versionada |
| `Atualizar exame como dono ou delegado` | UPDATE | public | USING: `usuario_id = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)`; WITH CHECK: (vazio) | catálogo; NÃO versionada |
| `Remover exame como dono ou delegado` | DELETE | public | USING: `usuario_id = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; NÃO versionada |

Notas factuais:
- As políticas do baseline ("select own exames", "insert own exames", "delete own exames") NÃO existem no banco real — substituídas pelas versões "dono ou delegado" por canal não-versionado `[CONFIRMED: database × migration]`.
- O baseline não possuía política de UPDATE; a política "Atualizar exame como dono ou delegado" existe apenas no banco real `[CONFIRMED: database × migration]`.

## Regras de negócio associadas

- Exames são por usuário; delegação permite que o delegado gerencie os exames do concedente (ver [delegacoes_acesso.md](delegacoes_acesso.md)).

## Lifecycle

- **Criação:** pelo usuário (ou delegado) via página Exames (`exames.service`) `[CONFIRMED: code]`.
- **Atualização:** permitida ao dono/delegado (política UPDATE) `[CONFIRMED: database]`.
- **Exclusão:** pelo dono/delegado; cascata quando o usuário é excluído `[CONFIRMED: database]`.

## RPCs e triggers que tocam esta tabela

- Nenhum RPC ou trigger versionado toca esta tabela `[CONFIRMED: database]`.

## Testes que cobrem esta tabela

- `src/react-app/services/exames.service.test.ts` — serviço `exames.service` `[CONFIRMED: test]`
- `src/react-app/hooks/useExames.test.ts` — hook `useExames` `[CONFIRMED: test]`

## Evidências

- E1 — Colunas, constraints: catálogo dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — DDL: baseline linhas 158–168, 217–255; legado `migrations/exames_pku.sql` `[CONFIRMED: migration]`
- E3 — Políticas: `pg_policies` dev e prod (2026-08-13) `[CONFIRMED: database]`
- E4 — Chamadores no código: 4 referências `.from("exames_pku")` em `src/` `[CONFIRMED: code]`
- E5 — Contagens: dev = 4, prod = 21 (2026-08-13) `[CONFIRMED: database]`

## Veja também

- [usuarios.md](usuarios.md), [delegacoes_acesso.md](delegacoes_acesso.md)
- `../frontend/pages/exames.md` (Fase 5)
