# Tabela public.referencias

**Última verificação:** 2026-09-04 (ENH-0004 — migrations 20260904000000/010000/020000/030000/040000 aplicadas em dev; canônico de marca revisto em 2026-09-04 — sem marca = em branco `''`; ordem física das colunas ajustada na 040000)
**DDL versionado em:** `supabase/migrations/20260103015052_remote_schema.sql` (linhas 171–260); coluna `is_ativa` e políticas consolidadas: `supabase/migrations/20260814000000_baseline_objetos_nao_versionados.sql` (DEBT-0001); modelo canônico (ENH-0004): `supabase/migrations/20260904000000_referencias_marca_identidade_imutavel.sql` + `20260904010000_referencias_marca_backfill_aninhados.sql`; correções pré-release: `20260904020000_referencias_marca_correcao_wrapper.sql` (bug do backfill — invólucro gravado verbatim), `20260904030000_referencias_marca_sem_marca_em_branco.sql` (canônico revisto) e `20260904040000_referencias_marca_apos_nome.sql` (ordem física: `marca` logo após `nome` — decisão do usuário). Legado: `migrations/referencias.sql`. **Nota:** as migrations ENH-0004 + correções foram aplicadas em dev em 2026-09-04; prod permanece com o schema anterior até a release (este documento descreve o estado pós-ENH-0004 final).

## Propósito

Alimentos de referência com quantidade de fenilalanina por 100g. Podem ser globais (dados ANVISA/administrativos, `is_global = true`) ou criados pelo próprio usuário (`criado_por`). Desde a ENH-0004, `nome` e `marca` são atributos separados; a identidade substantiva de uma referência é `(nome, marca, fenil_mg_por_100g)`, imutável por UPDATE para o conjunto global e única entre referências ATIVAS.

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13; dev pós-ENH-0004 2026-09-04 (migrations 20260904000000/20260904010000); dev pós-040000 2026-09-04]`

**Ordem física** (a partir da migration 20260904040000 — decisão do usuário: a coluna `marca` deve ficar "logo após a coluna nome" também no schema): as linhas abaixo seguem `information_schema.columns.ordinal_position` — `marca` = posição 3, imediatamente após `nome`. Antes da 040000, `marca` era a última coluna (posição 10, após `is_ativa`). A ordem de colunas não tem significado funcional no Postgres (a ordem visual é do frontend); a reordenação física existe por solicitação explícita e fica registrada na migration para que a release entregue prod já nesse layout. Sem efeito em SQL nomeado (queries, RPCs, policies e o índice usam nomes, nunca posições).

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | posição 1 |
| `nome` | text | — | NO | — | posição 2; sem o sufixo de marca (limpo no backfill ENH-0004) |
| `marca` | text | `''` | NO | — | posição 3 (desde a 040000 — imediatamente após `nome`); adicionada na ENH-0004 (A3a/OQ2); **canônico revisto em 2026-09-04:** `''` (em branco) = marca NÃO declarada; `'Produto In Natura'` é marca DECLARADA pela fonte (apenas linhas vindas da planilha ANVISA — 97 em dev) — decidido pelo usuário; o default da coluna era `'Produto In Natura'` e passou a `''` na migration 20260904030000 |
| `fenil_mg_por_100g` | numeric(10,1) | — | NO | — | posição 4; fenilalanina em mg por 100g; `numeric(10,1)` desde a ENH-0004 (A2 — era `real`); 1 casa decimal |
| `criado_por` | uuid | `auth.uid()` | NO | FK → `usuarios(id)` ON DELETE CASCADE | posição 5 |
| `is_global` | boolean | `false` | NO | — | posição 6; global (ANVISA/admin) × pessoal |
| `created_at` | timestamp with time zone | `now()` | YES | — | posição 7 |
| `updated_at` | timestamp with time zone | `now()` | YES | — | posição 8 |
| `is_ativa` | boolean | `true` | NO | — | posição 9; versionada na migration 20260814000000 (ausente do baseline e do legado) `[CONFIRMED: database × migration]` |

Coluna `nome_normalizado` **eliminada** na ENH-0004 (A4(b)) — normalização passou a ser runtime (escopo do FEAT-0017); unicidade usa expressões no índice (abaixo). `[CONFIRMED: migration 20260904000000]`

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13; dev pós-ENH-0004 2026-09-04 (migration 20260904000000)]`

- `referencias_pkey` — PRIMARY KEY (`id`)
- `referencias_criado_por_fkey` — FOREIGN KEY (`criado_por`) REFERENCES `usuarios(id)` ON DELETE CASCADE
- `referencias_identidade_ativa_unique` — UNIQUE INDEX btree (`lower(trim(nome))`, `lower(trim(marca))`, `fenil_mg_por_100g`) **WHERE `is_ativa`** (ENH-0004, A1(b)) — identidade substantiva única entre referências ATIVAS; arquivadas (`is_ativa = false`) podem repetir a identidade livremente (histórico coexiste com o ativo). Violação 23505 → AppError `REFERENCIA_DUPLICADA` no service.
- Índices `referencias_nome_unique` (btree `lower(nome)`) e `referencias_nome_normalizado_unique` (btree `nome_normalizado`) **removidos** na ENH-0004 (A1(b)).
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
- A ENH-0004 NÃO alterou políticas (a nova coluna `marca` não é security-relevant) `[CONFIRMED: migration 20260904000000 × ausência de mudança de policies]`.
- A migration 20260904040000 (reordenação física) RECRIOU as políticas por recriar a tabela — as 10 da tabela e as 4 cross-tabela (`registros`/`referencias_favoritas`) saíram e voltaram verbatim (qual/with_check idênticos no `pg_policies` antes × depois), agora resolvidas para o novo OID; sem mudança semântica `[CONFIRMED: pg_policies dev pré × pós 040000 — 2026-09-04]`.
- O DELETE direto por usuário é bloqueado quando existem `registros` vinculados (o vínculo é preservado — ver [registros.md](registros.md)); a via oficial de remoção é o RPC `remover_ou_desativar_referencia` — para GLOBAIS o RPC sempre arquiva (`is_ativa = false`), nunca exclui fisicamente (OQ4 da ENH-0004); para pessoais mantém a regra soft/hard conforme vínculo `[CONFIRMED: database, migration — 20260904000000]`.

## Regras de negócio associadas

- Identidade substantiva da referência = `(nome, marca, fenil_mg_por_100g)`; para GLOBAIS (`is_global = true`) é IMUTÁVEL por UPDATE após a criação (guarda no service → AppError `REFERENCIA_GLOBAL_IMUTAVEL`; mudança substantiva = arquivar a atual + criar a nova — BR-034). Pessoais seguem editáveis pelo dono (BR-023) `[CONFIRMED: code — referencias.service.ts:242-261; migration 20260904000000]`.
- Unicidade da identidade apenas entre referências ATIVAS (índice `referencias_identidade_ativa_unique`) — arquivadas coexistem com o mesmo nome/marca `[CONFIRMED: migration 20260904000000]`.
- Marca como atributo separado (BR-035): sem marca declarada = `''` EM BRANCO (canônico revisto em 2026-09-04 — a regra "Em branco = Produto In Natura" foi revogada; `'Produto In Natura'` é marca declarada pela fonte ANVISA e se mantém apenas onde a planilha a declara); o frontend monta a apresentação combinada dinamicamente (`nomeComMarca` — sufixo só quando há marca declarada) `[CONFIRMED: migration 20260904030000; code — lib/referencias.ts]`.
- Desativação (arquivamento): `is_ativa = false`; NÃO remove favoritos em nenhum fluxo (trigger de remoção de favoritos foi ELIMINADO na ENH-0004 — OQ3/BR-036; ver [triggers.md](triggers.md) e [referencias_favoritas.md](referencias_favoritas.md)).
- Referências globais nunca são excluídas fisicamente pela aplicação (BR-037); somente admins podem arquivá-las (RPC e política DELETE) `[CONFIRMED: migration — 20260904000000]`.
- Novos registros de consumo exigem referência ativa (política de `registros` — ver [registros.md](registros.md)).

## Lifecycle

- **Criação:** pelo usuário (política INSERT) ou por admin; seed histórico de dados ANVISA em `migrations/dados.sql` (2.959 INSERTs, 2026-01-01) e CLI `seed-referencia` `[CONFIRMED: migration, code — scripts/cli/commands/seed-referencia.js; contagem do seed conferida em 2026-09-02/04]`.
- **Atualização:** pessoais pelo dono/delegado (política UPDATE; WITH CHECK limita `is_ativa` a true/false); `updated_at = now()` nos RPCs; o service sanitiza a identidade (extrai sufixo legado `(Marca: ...)` do nome para a coluna `marca`) antes do UPDATE/INSERT `[CONFIRMED: code — referencias.service.ts:340-355]`. **Globais: nenhum fluxo da aplicação edita a identidade por UPDATE** — edição na UI arquiva a atual e cria a nova (BR-034) `[CONFIRMED: code — referencias.service.ts:242-261; Referencias.tsx:66-94]`.
- **Desativação/remoção:** RPC `remover_ou_desativar_referencia` — GLOBAIS: sempre arquivamento (`is_ativa = false`, retorna `'deactivated'`), inclusive sem registros (OQ4); PESSOAIS: soft (`'deactivated'`) se houver registros, hard (DELETE, `'deleted'`) se não houver `[CONFIRMED: migration 20260904000000 — linhas 96–164]`. Reativação: RPC `ativar_referencia` (dono/delegado/admin — permanece permitida para pessoais pelo dono e para globais por admin) `[CONFIRMED: migration]`.
- **Backfill (ENH-0004, A3a):** o sufixo `(Marca: X)` embutido no `nome` foi extraído para a coluna `marca` em todas as linhas do dev DB (3.164 linhas antes/depois, nenhuma perdida; 4 linhas com parênteses internos na marca tratadas pela migration complemento 20260904010000) `[CONFIRMED: migrations 20260904000000/20260904010000 — execução dev 2026-09-04]`.
- **Correção do invólucro (20260904020000):** o backfill original (20260904000000) usava `regexp_match` SEM grupo de captura e gravou o invólucro literal `(Marca: X)` na coluna (bug pós-merge; ex.: `(Marca: Nestlé Coco)`); a correção re-extraiu o conteúdo do invólucro em 2.955 linhas de dev, preservando o total (3.164) e com 0 residuais de `^(Marca:`, 0 vazias e 0 duplicatas `[CONFIRMED: migration 20260904020000 — execução dev 2026-09-04]`.
- **Canônico de marca revisto (20260904030000):** default da coluna alterado de `'Produto In Natura'` para `''`; linhas com `'Produto In Natura'` cujo NOME não consta da lista da planilha ANVISA → `''` em branco; estado final em dev: 3.164 total preservado / 97 com `'Produto In Natura'` declarado (in natura declarado pela planilha) / 222 em branco (sem marca declarada) / 0 residuais / 0 duplicatas — decisão do usuário em 2026-09-04 registrada no header da migration `[CONFIRMED: migration 20260904030000 — execução dev 2026-09-04]`.
- **Reordenação física (20260904040000, decisão do usuário):** Postgres não suporta `ADD COLUMN AFTER` — a tabela foi recriada com `marca` na posição 3 (logo após `nome`), renomeando a original para `referencias_old`, copiando os dados com lista explícita de colunas e dropando a antiga (a 1ª aplicação falhou com 2BP01: 4 políticas de TABELAS-FILHAS — "Inserir registro apenas com referencia ativa" em `registros` e Ver/Favoritar/Desfavoritar em `referencias_favoritas` — dependem da tabela por OID; a migration foi corrigida para dropá-las antes e recriá-las verbatim depois, apontando para o novo OID). PK, FK → `usuarios`, índice `referencias_identidade_ativa_unique`, RLS, 10 políticas da tabela, grants e FKs dos filhos recriados idênticos; verificação pós-aplicação: 3.164 linhas preservadas, 222 em branco / 97 natura / 0 wrappers, ordem `marca` = posição 3, suítes de segurança 28/28 verdes `[CONFIRMED: migration 20260904040000 — execução dev 2026-09-04; catálogo dev pós-040000; src/shared/security/ 28 testes]`.
- **Exclusão em cascata:** favoritos são excluídos via FK CASCADE apenas quando a referência é removida hard (pessoais sem registros); desativação NÃO remove favoritos (sem trigger) `[CONFIRMED: database × migration 20260904000000]`.

## RPCs e triggers que tocam esta tabela

- `ativar_referencia` (UPDATE `is_ativa = true`) — [rpc.md](rpc.md)
- `remover_ou_desativar_referencia` (SELECT/DELETE/UPDATE; redefinida na migration 20260904000000 — globais sempre arquivam) — [rpc.md](rpc.md)
- `get_estatisticas_admin` (contagens) — [rpc.md](rpc.md)
- Triggers: **nenhum trigger em `referencias` desde a ENH-0004** (`trg_normalizar_nome_referencia` e `trg_remover_favoritos_referencia_inativa` eliminados) — [triggers.md](triggers.md)

## Testes que cobrem esta tabela

- `src/shared/security/rpc-ativar-referencia.test.ts` — autorização do RPC `ativar_referencia` `[CONFIRMED: test]`
- `src/shared/security/rpc-remover-referencia.test.ts` — autorização e soft/hard delete do RPC de remoção; T3.7 (ENH-0004): remoção de GLOBAL por admin SEMPRE arquiva (`'deactivated'`), nunca exclui `[CONFIRMED: test]`
- `src/react-app/services/referencias.service.test.ts` — serviço `referencias.service` (busca nome+marca, sanitização, guarda de global) `[CONFIRMED: test]`
- `src/react-app/lib/referencias.test.ts` — helpers do modelo canônico (`normalizarMarca`, `extrairMarcaDoNome`, `nomeComMarca`) `[CONFIRMED: test]`

## Evidências

- E1 — Colunas (incluindo `is_ativa`; pós-ENH-0004: `marca`, sem `nome_normalizado`), constraints, índices: catálogo dev e prod (2026-08-13); dev pós-ENH-0004 (2026-09-04) `[CONFIRMED: database, migration]`
- E2 — DDL base: baseline linhas 171–260; legado `migrations/referencias.sql`; modelo canônico: migrations 20260904000000/20260904010000 `[CONFIRMED: migration]`
- E3 — `is_ativa` ausente de todas as migrations versionadas e legadas até a baseline 20260814000000 (DEBT-0001), que a versiona `[CONFIRMED: ausência em migrations; migration 20260814000000]`
- E4 — Políticas: `pg_policies` dev e prod (2026-08-13) `[CONFIRMED: database]`
- E5 — Chamadores no código: 11 referências `.from("referencias")` em `src/`; RPCs chamados em `referencias.service.ts:246,263` `[CONFIRMED: code]`
- E6 — Contagens: dev = 3.164, prod = 2.986 (2026-08-13); dev permanece 3.164 após o backfill ENH-0004 (antes = depois, asserção da migration) `[CONFIRMED: database, migration]`

## Veja também

- [rpc.md](rpc.md), [triggers.md](triggers.md), [referencias_favoritas.md](referencias_favoritas.md), [registros.md](registros.md)
- `../frontend/pages/referencias.md` (Fase 5) — uso pela página Referências
