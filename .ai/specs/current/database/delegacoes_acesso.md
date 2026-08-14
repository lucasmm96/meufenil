# Tabela public.delegacoes_acesso

**Última verificação:** 2026-08-13 (commit 6323664)
**DDL versionado em:** NÃO VERSIONADO — ausente de todas as migrations (raiz e `supabase/migrations/`). DDL abaixo reconstruído a partir do catálogo dos bancos dev e prod (2026-08-13) `[CONFIRMED: database; ausência em migrations CONFIRMADA]`. Origem/canal de criação: `UNKNOWN` (git: commits `e19f43a` "Adicionar função Supabase para delegação de acesso" e `d14b1de` "Criar tipos e serviços para delegações de acesso" adicionaram código, sem arquivo de migration).

## Propósito

Delegação de acesso: um usuário (concedente) autoriza outro usuário (delegado) a operar em seu nome (criar/ver/remover registros, exames, referências — o mecanismo "login as" da aplicação).

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `concedente_id` | uuid | — | NO | FK → `usuarios(id)` ON DELETE CASCADE | dono do perfil |
| `delegado_id` | uuid | — | NO | FK → `usuarios(id)` ON DELETE CASCADE | quem recebe o acesso |
| `created_at` | timestamp with time zone | `now()` | NO | — | |
| `revoked_at` | timestamp with time zone | — | YES | — | não-nulo = delegação revogada |

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13]`

- `delegacoes_acesso_pkey` — PRIMARY KEY (`id`)
- `delegacoes_acesso_concedente_fk` — FOREIGN KEY (`concedente_id`) REFERENCES `usuarios(id)` ON DELETE CASCADE
- `delegacoes_acesso_delegado_fk` — FOREIGN KEY (`delegado_id`) REFERENCES `usuarios(id)` ON DELETE CASCADE
- `delegacoes_acesso_unique_ativo` — UNIQUE INDEX btree (`concedente_id`, `delegado_id`) **WHERE (`revoked_at` IS NULL)** — no máximo UMA delegação ativa por par
- Nenhuma CHECK constraint.

Nota factual: os nomes reais das FKs no banco (`delegacoes_acesso_concedente_fk` / `delegacoes_acesso_delegado_fk`) DIFEREM dos nomes referenciados no código da edge function (`delegacoes_acesso_concedente_id_fkey` / `delegacoes_acesso_delegado_id_fkey` em `supabase/functions/delegar-acesso/index.ts:86,98`) `[CONFIRMED: database × code]`.

## Relacionamentos (FKs)

- **Referencia:** `usuarios(id)` duas vezes (concedente e delegado), ambas ON DELETE CASCADE.
- **É referenciada por:** nenhuma FK — mas é consultada pelas políticas RLS de `registros`, `exames_pku`, `referencias`, `referencias_favoritas` e pelos RPCs `ativar_referencia` / `remover_ou_desativar_referencia` (verificação "delegado pelo dono") `[CONFIRMED: database, migration]`.

## Políticas RLS desta tabela

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `Listar Delegações` | SELECT | public | USING: `concedente_id = auth.uid() OR delegado_id = auth.uid()` | catálogo; NÃO versionada |
| `Usuário concede acesso ao proprio perfil` | INSERT | public | WITH CHECK: `concedente_id = auth.uid() AND delegado_id <> auth.uid()` | catálogo; NÃO versionada |
| `Usuário revoga acessos concedidos ao proprio perfil` | UPDATE | public | USING: `concedente_id = auth.uid() AND revoked_at IS NULL`; WITH CHECK: `concedente_id = auth.uid()` | catálogo; NÃO versionada |

Notas factuais:
- Não existe política de DELETE — revogação é feita por UPDATE (`revoked_at`) `[CONFIRMED: database]`.
- A concessão é escrita pela aplicação via edge function `delegar-acesso` (service role), não por INSERT direto do cliente — o RLS também permite INSERT direto pelo concedente (fato) `[CONFIRMED: code — delegacoesAcesso.service.ts; database]`.

## Regras de negócio associadas

- Delegação ativa = `revoked_at IS NULL`; usada pelas políticas "dono ou delegado" e pelos RPCs `[CONFIRMED: database, migration]`.
- Reativação após revogação: o índice único parcial permite novo INSERT após `revoked_at` ser preenchido (o par volta a ficar livre) — o histórico de delegações anteriores é preservado em linhas antigas `[INFERRED: inferido do índice parcial (concedente_id, delegado_id) WHERE revoked_at IS NULL combinado com ausência de política DELETE; não há evidência de comportamento de reativação no código — UNKNOWN se a aplicação reativa ou cria nova linha]`.
- "Assumir perfil" (`usuario_ativo`) e listagens concedidas/recebidas são mediados pela edge function `delegar-acesso` (ações `listar`, `conceder`, `revogar`, `assumir`, `sair`) `[CONFIRMED: code — delegacoesAcesso.service.ts]`.

## Lifecycle

- **Criação:** INSERT com `concedente_id` e `delegado_id` via edge function `delegar-acesso` (ação `conceder`; verifica se o email existe em `usuarios`) `[CONFIRMED: code — supabase/functions/delegar-acesso/index.ts:148]`.
- **Revogação:** UPDATE `revoked_at = now()` via edge function (ação `revogar`) `[CONFIRMED: code]`.
- **Exclusão física:** apenas via cascata das FKs (exclusão de usuário) — não há DELETE pela aplicação `[CONFIRMED: code, database]`.

## RPCs e triggers que tocam esta tabela

- `ativar_referencia` — consulta delegações ativas (EXISTS) `[CONFIRMED: migration]`
- `remover_ou_desativar_referencia` — consulta delegações ativas (EXISTS) `[CONFIRMED: migration]`
- Nenhum trigger nesta tabela `[CONFIRMED: database]`.

## Testes que cobrem esta tabela

- `src/shared/security/rpc-ativar-referencia.test.ts` e `src/shared/security/rpc-remover-referencia.test.ts` — cenários de delegado na autorização dos RPCs `[CONFIRMED: test]`
- Nenhum teste de segurança dedicado às políticas desta tabela identificado `[CONFIRMED: ausência — src/shared/security/]`

## Evidências

- E1 — Colunas, constraints, índice parcial, RLS e políticas: catálogo dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — Ausência de DDL em todas as migrations versionadas e legadas `[CONFIRMED: ausência em migrations — grep, 2026-08-13]`
- E3 — Uso pelos RPCs: migration `20260811210456_fix_security_rls_rpc.sql` linhas 40–45, 90–95 `[CONFIRMED: migration]`
- E4 — Chamadores no código: 5 referências `.from("delegacoes_acesso")` na edge function `delegar-acesso` e 5 em `src/` `[CONFIRMED: code]`
- E5 — Contagens: não coletadas individualmente `[UNKNOWN: evidência necessária — SELECT count(*) na tabela]`

## Veja também

- [usuarios.md](usuarios.md), [rpc.md](rpc.md)
- `../security/security-model.md` (Fase 3) — delegação e usuário ativo
- `../backend/edge-function-delegar-acesso.md` (Fase 4)
