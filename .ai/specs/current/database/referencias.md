# Tabela public.referencias

**Última verificação:** 2026-08-14 (migration 20260814000000 aplicada em dev e prod)
**DDL versionado em:** `supabase/migrations/20260103015052_remote_schema.sql` (linhas 171–260); coluna `is_ativa` e políticas consolidadas: `supabase/migrations/20260814000000_baseline_objetos_nao_versionados.sql` (DEBT-0001). Legado: `migrations/referencias.sql`

## Propósito

Alimentos de referência com quantidade de fenilalanina por 100g. Podem ser globais (dados ANVISA/administrativos, `is_global = true`) ou criados pelo próprio usuário (`criado_por`).

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `nome` | text | — | NO | — | |
| `fenil_mg_por_100g` | real | — | NO | — | fenilalanina em mg por 100g |
| `criado_por` | uuid | `auth.uid()` | NO | FK → `usuarios(id)` ON DELETE CASCADE | |
| `is_global` | boolean | `false` | NO | — | global (ANVISA/admin) × pessoal |
| `created_at` | timestamp with time zone | `now()` | YES | — | |
| `updated_at` | timestamp with time zone | `now()` | YES | — | |
| `nome_normalizado` | text | — | NO | UNIQUE (índice) | `lower(trim(nome))` via trigger |
| `is_ativa` | boolean | `true` | NO | — | versionada na migration 20260814000000 (ausente do baseline e do legado) `[CONFIRMED: database × migration]` |

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13]`

- `referencias_pkey` — PRIMARY KEY (`id`)
- `referencias_criado_por_fkey` — FOREIGN KEY (`criado_por`) REFERENCES `usuarios(id)` ON DELETE CASCADE
- `referencias_nome_unique` — UNIQUE INDEX btree (`lower(nome)`)
- `referencias_nome_normalizado_unique` — UNIQUE INDEX btree (`nome_normalizado`)
- Nenhuma CHECK constraint.

## Relacionamentos (FKs)

- **Referencia:** `usuarios(id)` via `criado_por` (ON DELETE CASCADE)
- **É referenciada por:**
  - `registros.referencia_id` → `referencias(id)` (sem CASCADE — ver [registros.md](registros.md))
  - `referencias_favoritas.referencia_id` → `referencias(id)` ON DELETE CASCADE

## Políticas RLS desta tabela

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `Usuário lista referências` | SELECT | public | USING: `is_global = true OR criado_por = auth.uid()` | catálogo; migration 20260814000000 |
| `Usuário lista referências globais ou próprias` | SELECT | public | USING: `is_global = true OR criado_por = auth.uid()` | catálogo; migration 20260814000000 |
| `Listar referencia como dono ou delegado` | SELECT | public | USING: `criado_por = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; migration 20260814000000 |
| `Usuário cria própria referencia` | INSERT | public | WITH CHECK: `criado_por = auth.uid()` | catálogo; migration 20260814000000 |
| `Adicionar referencia como dono ou delegado` | INSERT | public | WITH CHECK: `criado_por = auth.uid() OR EXISTS (delegacoes_acesso ativa do dono)` | catálogo; migration 20260814000000 |
| `Atualizar referencia como dono ou delegado` | UPDATE | public | USING: dono OU delegado OU `auth.jwt()->>'role' = 'admin'`; WITH CHECK: `is_ativa = ANY (ARRAY[true, false])` | catálogo; migration 20260814000000 |
| `Remover referencia como dono ou delegado` | DELETE | public | USING: (dono OU delegado OU jwt admin) AND (`is_global = false` OU jwt admin) AND `NOT EXISTS (registros vinculados)` | catálogo; migration 20260814000000 |
| `Admin lista referencias` | SELECT | authenticated | USING: `EXISTS (usuarios.id = auth.uid() AND role = 'admin')` | catálogo; migration 20260814000000 |
| `Admin adiciona referencias` | INSERT | authenticated | WITH CHECK: `EXISTS (... role = 'admin')` | catálogo; migration 20260814000000 |
| `Admin atualiza referencias` | UPDATE | authenticated | USING: `EXISTS (... role = 'admin')`; WITH CHECK: (vazio) | catálogo; migration 20260814000000 |

Notas factuais:
- As políticas do baseline ("usuario ve referencias", "usuario cria referencia", "Usuário pode ler referências", "Usuário pode ver referências globais ou próprias", "admin_can_insert_referencias", "admin_can_select_referencias", "admin_can_update_referencias") NÃO existem com esses nomes no banco real — o conjunto foi recriado/renomeado e versionado pela migration 20260814000000 (DEBT-0001) `[CONFIRMED: database × migration]`.
- Existem DUAS políticas SELECT com semântica idêntica ("Usuário lista referências" e "Usuário lista referências globais ou próprias") — ambas vigentes `[CONFIRMED: database]`.
- O DELETE direto por usuário é bloqueado quando existem `registros` vinculados (o vínculo é preservado — ver [registros.md](registros.md)); a via oficial de remoção é o RPC `remover_ou_desativar_referencia` (soft-delete via `is_ativa`) `[CONFIRMED: database, migration]`.

## Regras de negócio associadas

- Normalização do nome (`lower(trim(nome))`) — trigger `trg_normalizar_nome_referencia` (ver [triggers.md](triggers.md)).
- Unicidade de nome: tanto pelo índice em `lower(nome)` quanto pelo índice em `nome_normalizado`.
- Desativação (soft delete): `is_ativa = false` quando a referência tem registros vinculados (RPC); o trigger `trg_remover_favoritos_referencia_inativa` remove favoritos ao desativar (ver [triggers.md](triggers.md)).
- Referências globais: somente admins podem removê-las (RPC e política DELETE) `[CONFIRMED: migration, database]`.
- Novos registros de consumo exigem referência ativa (política de `registros` — ver [registros.md](registros.md)).

## Lifecycle

- **Criação:** pelo usuário (política INSERT) ou por admin; seed histórico de dados ANVISA em `migrations/dados.sql` (2.958 INSERTs, 2026-01-01) e CLI `seed-referencia` `[CONFIRMED: migration, code — scripts/cli/commands/seed-referencia.js]`.
- **Atualização:** pelo dono/delegado/admin (política UPDATE; WITH CHECK limita `is_ativa` a true/false); `updated_at = now()` nos RPCs.
- **Desativação/remoção:** RPC `remover_ou_desativar_referencia` — soft (`is_ativa = false`, retorna `'deactivated'`) se houver registros; hard (DELETE, retorna `'deleted'`) se não houver `[CONFIRMED: migration]`. Reativação: RPC `ativar_referencia` `[CONFIRMED: migration]`.
- **Exclusão em cascata:** favoritos são excluídos via FK CASCADE quando a referência é removida hard.

## RPCs e triggers que tocam esta tabela

- `ativar_referencia` (UPDATE `is_ativa = true`) — [rpc.md](rpc.md)
- `remover_ou_desativar_referencia` (SELECT/DELETE/UPDATE) — [rpc.md](rpc.md)
- `get_estatisticas_admin` (contagens) — [rpc.md](rpc.md)
- Triggers: `trg_normalizar_nome_referencia` (BEFORE INSERT OR UPDATE), `trg_remover_favoritos_referencia_inativa` (AFTER UPDATE) — [triggers.md](triggers.md)

## Testes que cobrem esta tabela

- `src/shared/security/rpc-ativar-referencia.test.ts` — autorização do RPC `ativar_referencia` `[CONFIRMED: test]`
- `src/shared/security/rpc-remover-referencia.test.ts` — autorização e soft/hard delete do RPC de remoção `[CONFIRMED: test]`
- `src/react-app/services/referencias.service.test.ts` — serviço `referencias.service` `[CONFIRMED: test]`

## Evidências

- E1 — Colunas (incluindo `is_ativa`), constraints, índices: catálogo dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — DDL base: baseline linhas 171–260; legado `migrations/referencias.sql` `[CONFIRMED: migration]`
- E3 — `is_ativa` ausente de todas as migrations versionadas e legadas até a baseline 20260814000000 (DEBT-0001), que a versiona `[CONFIRMED: ausência em migrations; migration 20260814000000]`
- E4 — Políticas: `pg_policies` dev e prod (2026-08-13) `[CONFIRMED: database]`
- E5 — Chamadores no código: 11 referências `.from("referencias")` em `src/`; RPCs chamados em `referencias.service.ts:246,263` `[CONFIRMED: code]`
- E6 — Contagens: dev = 3.164, prod = 2.986 (2026-08-13) `[CONFIRMED: database]`

## Veja também

- [rpc.md](rpc.md), [triggers.md](triggers.md), [referencias_favoritas.md](referencias_favoritas.md), [registros.md](registros.md)
- `../frontend/pages/referencias.md` (Fase 5) — uso pela página Referências
