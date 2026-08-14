# Template T1 — Spec de Tabela

**Uso:** documentação de uma tabela em `current/database/<tabela>.md` (nome do arquivo = identificador real da tabela).
**Regras:** preencher todos os campos; campo não aplicável recebe "Não se aplica" (ausência é informação factual). Toda afirmação relevante carrega classificação de evidência (ver `CONVENTIONS.md`, seção 3). Regras de negócio não são copiadas aqui — apenas linkadas para `current/domain/business-rules.md` (regra "link, não copie").

---

# Tabela public.<nome>

**Última verificação:** YYYY-MM-DD (commit <sha>)
**DDL versionado em:** <arquivo em supabase/migrations/> | NÃO VERSIONADO (origem: UNKNOWN)

## Propósito

[Preencher — o que esta tabela representa no sistema]

## Colunas

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|

[Preencher — todas as colunas reais, extraídas da migration versionada ou, quando não houver DDL versionado, do banco]

## Constraints e índices

[Preencher — PKs, FKs, UNIQUE, CHECK, índices, com evidência]

## Relacionamentos (FKs)

[Preencher — tabela/coluna referenciada, comportamento de exclusão (ex.: ON DELETE CASCADE)]

## Políticas RLS desta tabela

| política | comando | alvo | USING/WITH CHECK | evidência |
|---|---|---|---|---|

[Preencher — uma linha por política; evidência = arquivo de migration e linha]

## Regras de negócio associadas

[Preencher — links para `current/domain/business-rules.md`; não copiar o texto das regras]

## Lifecycle

[Preencher — criação/atualização/soft-delete quando aplicável; quem/quando insere, atualiza, remove]

## RPCs e triggers que tocam esta tabela

[Preencher — links para `current/database/rpc.md` e `current/database/triggers.md`]

## Testes que cobrem esta tabela

[Preencher — links para arquivos de teste; ou "Nenhum teste identificado" (ausência = fato)]

## Evidências

[Preencher — lista E1, E2... com classificação e origem, ex.: E1 — colunas extraídas de `20260103015052_remote_schema.sql` `[CONFIRMED: migration]`]

## Veja também

[Preencher — links: security-model, features relacionadas, páginas que consomem esta tabela]
