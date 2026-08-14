# Tabela public.registros

**Última verificação:** 2026-08-13 (commit 6323664)
**DDL versionado em:** `supabase/migrations/20260103015052_remote_schema.sql` (linhas 186–198, 263–270) — legado: `migrations/registros.sql`

## Propósito

Registro diário de consumo alimentar: o usuário informa o peso consumido de um alimento de referência e a fenilalanina correspondente (`fenil_mg`).

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `data` | date | — | NO | — | dia do consumo |
| `usuario_id` | uuid | — | NO | FK → `usuarios(id)` (sem CASCADE) | |
| `referencia_id` | uuid | — | NO | FK → `referencias(id)` (sem CASCADE) | |
| `peso_g` | real | — | NO | — | peso consumido em gramas |
| `fenil_mg` | real | — | NO | — | fenilalanina em mg (calculada na UI) |
| `created_at` | timestamp with time zone | `now()` | YES | — | |
| `updated_at` | timestamp with time zone | `now()` | YES | — | |

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13]`

- `registros_pkey` — PRIMARY KEY (`id`)
- `registros_usuario_id_fkey` — FOREIGN KEY (`usuario_id`) REFERENCES `usuarios(id)` — **sem** ON DELETE (comportamento default: NO ACTION)
- `registros_referencia_id_fkey` — FOREIGN KEY (`referencia_id`) REFERENCES `referencias(id)` — **sem** ON DELETE
- Nenhuma CHECK constraint; nenhum índice além do implícito da PK.

## Relacionamentos (FKs)

- **Referencia:** `usuarios(id)` e `referencias(id)` — ambos sem CASCADE: exclusão de usuário ou referência com registros vinculados é bloqueada pelo FK (por isso a edge function `delete-account` exclui registros antes do usuário, e o RPC de remoção de referência faz soft-delete quando há vínculo) `[CONFIRMED: database, code]`.

## Políticas RLS desta tabela

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `Listar registro como dono ou delegado` | SELECT | public | USING: `usuario_id = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; NÃO versionada |
| `Adicionar registro como dono ou delegado` | INSERT | public | WITH CHECK: `usuario_id = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; NÃO versionada |
| `Inserir registro apenas com referencia ativa` | INSERT | public | WITH CHECK: `EXISTS (referencias r WHERE r.id = registros.referencia_id AND r.is_ativa = true)` | catálogo; NÃO versionada |
| `Remover registro como dono ou delegado` | DELETE | public | USING: `usuario_id = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; NÃO versionada |
| `Usuário pode deletar seus próprios registros` | DELETE | public | USING: `usuario_id = auth.uid()` | baseline (linha 283) e catálogo |

Notas factuais:
- **NÃO existe política de UPDATE**: registros não podem ser alterados via RLS por nenhum papel — a aplicação só cria, lista e remove `[CONFIRMED: database × code]`.
- As políticas do baseline "usuario ve registros" e "usuario cria registro" NÃO existem no banco real — substituídas pelas versões "dono ou delegado" por canal não-versionado `[CONFIRMED: database × migration]`.

## Regras de negócio associadas

- `fenil_mg` é calculado na aplicação a partir de `peso_g` × `fenil_mg_por_100g` da referência (o banco armazena o valor informado, sem cálculo) `[CONFIRMED: code — registros.service.ts, useCreateRegistro.ts]`.
- Registro só é aceito se a referência estiver ativa (política INSERT) `[CONFIRMED: database]`.
- Consumo diário consolidado pelas funções `dashboard_hoje` (soma do dia + limite) e `dashboard_ultimos_dias` (soma por dia) — ver [rpc.md](rpc.md).

## Lifecycle

- **Criação:** pelo usuário (ou delegado) via aplicação (`registros.service.createRegistro`) — INSERT com `usuario_id`, `referencia_id`, `data`, `peso_g`, `fenil_mg` `[CONFIRMED: code]`.
- **Atualização:** não suportada pela aplicação nem pelo RLS (sem política UPDATE) `[CONFIRMED: code, database]`.
- **Exclusão:** pelo dono/delegado (políticas DELETE) via `registros.service.deleteRegistro`; também pela edge function `delete-account` na exclusão de conta `[CONFIRMED: code]`.

## RPCs e triggers que tocam esta tabela

- `dashboard_hoje` (SELECT, soma do dia) — [rpc.md](rpc.md)
- `dashboard_ultimos_dias` (SELECT, soma por dia) — [rpc.md](rpc.md)
- `remover_ou_desativar_referencia` (SELECT para verificar vínculo de referência) — [rpc.md](rpc.md)
- Nenhum trigger em `public` toca esta tabela `[CONFIRMED: database]`.

## Testes que cobrem esta tabela

- `src/react-app/services/registros.service.test.ts` — serviço `registros.service` `[CONFIRMED: test]`
- `src/react-app/hooks/useRegistros.test.ts` — hook `useRegistros` `[CONFIRMED: test]`
- `src/react-app/hooks/useCreateRegistro.test.tsx` — hook de criação `[CONFIRMED: test]`

## Evidências

- E1 — Colunas, constraints e ausência de índices extras: catálogo dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — DDL: baseline linhas 186–198, 263–270; legado `migrations/registros.sql` `[CONFIRMED: migration]`
- E3 — Políticas: `pg_policies` dev e prod (2026-08-13) `[CONFIRMED: database]`
- E4 — Chamadores no código: 12 referências `.from("registros")` em `src/` e 1 em `supabase/functions/delete-account/` `[CONFIRMED: code]`
- E5 — Contagens: dev = 13, prod = 1.363 (2026-08-13) `[CONFIRMED: database]`

## Veja também

- [referencias.md](referencias.md), [rpc.md](rpc.md), [usuarios.md](usuarios.md)
- `../frontend/pages/dashboard.md` e `../frontend/pages/historico.md` (Fase 5)
