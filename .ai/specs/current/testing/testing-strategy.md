# Testing Strategy — Estado Atual

**Última verificação:** 2026-08-13 (commit 6323664) — suíte executada nesta data (3 execuções); cobertura coletada em 1 execução.

Este documento descreve a infraestrutura e a estratégia de testes que EXISTEM hoje. A análise de gaps e as recomendações estão no relatório da fase (`.ai/.temp/analyses/22-auditoria-testes.md`) — NÃO aqui.

## 1. Stack

| Item | Valor | Evidência |
|---|---|---|
| Runner | Vitest ^4.0.17 | `package.json` |
| UI | @testing-library/react ^16.3.1 + jest-dom ^6.9.1 | `package.json`, `vitest.setup.ts` |
| Ambiente | jsdom (`test.environment = "jsdom"`) | `vitest.config.ts` |
| Globals | `test.globals = true` (describe/it/expect sem import) | `vitest.config.ts` |
| Setup file | `vitest.setup.ts` (jest-dom + carga de `.env.development` e `.env` no processo Node) | `vitest.setup.ts` |
| Coverage provider | @vitest/coverage-v8 | `package.json` |
| Aliases | `@` → `./src`, `@skeletons` → skeletons/index | `vitest.config.ts`, `tsconfig.json` |
| Scripts npm | `test` (vitest watch), `test:run` (vitest run), `test:coverage` (vitest run --coverage) | `package.json` |
| Thresholds de coverage | **NENHUM configurado** (`vitest.config.ts` não possui `coverage.thresholds`) | `vitest.config.ts` |
| CI | **NÃO existe** (sem `.github/`) | filesystem |
| Exclusões de coverage | nenhuma configuração explícita | `vitest.config.ts` |

## 2. Organização e convenções

- **Localização:** testes colocalizados ao lado do código (`X.test.ts`/`X.test.tsx` junto de `X.ts`/`X.tsx`) — sem diretório `__tests__` `[CONFIRMED: filesystem]`.
- **Naming:** `describe("<módulo>")` + `it("descrição em pt-BR")` ("deve ...", "define erro quando ..."); cenários de segurança numerados (`AV.x`, `T1.x`, `T2.x`, `T3.x`) `[CONFIRMED: test]`.
- **Fixtures:** dados inline nos testes; nenhuma pasta de fixtures `[CONFIRMED: ausência]`.
- **Mocks:** `vi.mock` de módulos (services mockam o cliente supabase e fazem assertions sobre chamadas — `toHaveBeenCalledWith`); `Admin.test.tsx` mocka 5 módulos (Layout, skeletons, AuthContext, useAdmin, useBackgroundJobsAdmin); `api/keepalive.test.ts` mocka `createClient` e `recordBackgroundJobExecution` `[CONFIRMED: test]`.
- **Helpers:** `src/shared/security/test-helpers.ts` — Abordagem B (JWTs reais), `createTestUser`, `cleanupAllTestUsers`, `isSecurityMigrationApplied` `[CONFIRMED: test]`.
- **Snapshots:** nenhum identificado `[CONFIRMED: ausência]`.

## 3. Níveis de teste existentes

| Nível | Arquivos | Característica |
|---|---|---|
| Unit (shared) | `src/shared/background-jobs.test.ts` | helper puro com client mockado |
| Service (client-side) | 10 arquivos em `services/*.service.test.ts` | mocks do supabase; assertions de chamadas e AppError |
| Hook | 12 arquivos em `hooks/use*.test.ts(x)` | `renderHook` (Testing Library) + mocks de services/supabase |
| Component/Page | `pages/Admin.test.tsx` (ÚNICO) | `render` + mocks pesados; 3 cenários |
| API/Serverless | `api/keepalive.test.ts` | handler Node-style com mocks; 4 cenários |
| Security (integração real) | `src/shared/security/` — 4 suítes | clientes Supabase reais com JWTs contra o banco **development**; service role para criar usuários de teste; cleanup em afterAll |
| E2E | **NÃO identificado** `[CONFIRMED: ausência]` | — |
| Smoke | **NÃO identificado** `[CONFIRMED: ausência]` | — |

## 4. Testes de segurança (integração real)

- `auth-real-validation.test.ts` (AV.1–AV.7): criação de usuário de teste, autenticação email/senha, cliente anon bloqueado por RLS, visibilidade da própria role, admin vê todos, usuário comum não vê terceiros.
- `rls-usuarios.test.ts` (T1.0–T1.4): políticas de `usuarios` — incluindo T1.0 (detecção legada de `debug_allow_all`, "sempre passa").
- `rpc-ativar-referencia.test.ts` (T2.0–T2.5): autorização de `ativar_referencia` (dono, delegado, admin, não autorizado, inexistente; T2.0 legado).
- `rpc-remover-referencia.test.ts` (T3.0–T3.8): autorização de `remover_ou_desativar_referencia` (dono, delegado, admin, global, vínculo soft-delete, inexistente; T3.0 legado).
- **Skip condicional:** as 4 suítes usam `describeOrSkip = hasServiceRole ? describe : describe.skip` (pulam se `SUPABASE_SERVICE_ROLE_KEY` ausente) `[CONFIRMED: test]`.
- Pré-condição: `isSecurityMigrationApplied()` (exige `admin_can_select_all_usuarios` em pg_policies) `[CONFIRMED: test]`.

## 5. Resultados observados (2026-08-13)

- **29 arquivos de teste, 128 testes.**
- Execução 1: **1 suíte falhou** (`rpc-remover-referencia` — erro transitório `422 "A user with this email address has already been registered"` em `createTestUser`); 119 passaram; 9 skipped.
- Execução 2: **128/128 passaram** (0 falhas, 0 skips).
- Execução 3 (coverage): **9 skipped** na mesma suíte (mesmo mecanismo).
- **Causa identificada:** `uniqueTestEmail()` usa `Date.now()` + contador POR PROCESSO (`test-helpers.ts:112-118`); as suítes `rpc-ativar` e `rpc-remover` rodam em workers paralelos e podem gerar o mesmo email no mesmo milissegundo → colisão. **Não-determinismo sob paralelismo — fato confirmado em 2 de 3 execuções.**
- Duração típica: ~30–40s (setup 30s; suítes de segurança 4–10s cada).

## 6. Cobertura quantitativa (execução com --coverage, 2026-08-13)

**Overall: 80.7% statements · 65.18% branches · 84.96% functions · 83.2% lines**

Por área (valores capturados da saída; seções de components/context/shared/skeletons truncadas — ver notas):

| Área | % Stmts | % Lines | Observação |
|---|---|---|---|
| `api/` | 78.18 | 78.18 | `keepalive.ts` 100% funcs; linhas 51-155,196-202 descobertas |
| `src/react-app/hooks/` | 89.81 | 91.13 | `useReferencias` 60.86 (mais baixo); 8 hooks com 100% |
| `src/react-app/lib/` | 100 | 100 | `errors.ts` |
| `src/react-app/pages/` | 74.66 | 77.61 | **apenas `Admin.tsx` aparece na tabela** — as outras 8 páginas não são importadas por nenhum teste (sem cobertura registrada) |
| `src/react-app/services/` | 76.24 | 79.59 | `referencias.service` 48.23 (mais baixo; linhas 158,183-270 = update/activate/deleteOrDeactivate/toggleFavorito); `usuarios.service`, `auth.service`, `layout.service`, `exames.service` 100 |
| `src/react-app/components/` | — | — | **nenhum teste importa componentes** → ausentes da tabela de cobertura |
| `src/react-app/context/` (AuthContext) | — | — | apenas MOCKADO em `Admin.test.tsx` → não medido |
| `src/shared/` | (truncado) | (truncado) | `background-jobs.ts` coberto por 3 testes; `security/` exercitado pelas 4 suítes reais |

Notas factuais sobre a medição:
- A tabela de cobertura lista somente arquivos IMPORTADOS por testes; ausência na tabela = sem cobertura registrada (não aparece com 0%, simplesmente não é listado) `[CONFIRMED: comportamento do relatório observado]`.
- Valores de `components/`, `context/`, `skeletons/`, `dtos/` e a parte de `shared/` não foram capturados na saída truncada — o que É confirmado por inventário: nenhum teste importa componentes; dtos/skeletons são exercitados indiretamente apenas via mocks/types.
- Nenhum threshold configurado; o percentual é informativo, não um gate `[CONFIRMED: configuration]`.

## 7. Limitações observadas (fatos)

- Única página testada é Admin (3 cenários, com 5 módulos mockados — o comportamento real de hooks/contextos não é exercitado nela).
- Zero componentes testados (10 componentes relevantes documentados na Fase 5).
- `AuthContext` sem teste direto.
- `delegacoesAcesso.service` sem teste (único service sem teste).
- Edge functions (`delegar-acesso`, `delete-account`) sem testes.
- CLI e script de migrations sem testes.
- Políticas RLS de `registros`, `exames_pku`, `referencias_favoritas` e `delegacoes_acesso` sem suítes de segurança próprias (as 4 suítes cobrem `usuarios` + 2 RPCs).
- Triggers do banco (normalização de nome, retenção 365d, limpeza de favoritos) sem teste direto.
- Operações destrutivas de UI (excluir conta, revogar acesso) sem teste.
- Testes de segurança dependem do banco development real (dados de teste criados/limpos; estado compartilhado com desenvolvimento).

## 8. Relação Spec × Test (mecanismo existente)

- Cada spec de `current/` possui a seção `## Testes que cobrem...` (tabelas/RPCs) ou `## Testes existentes` (páginas) — listando os arquivos de teste reais (ou a ausência). Esse é o vínculo atual entre comportamento documentado e comportamento testado `[CONFIRMED: specs — database/*.md, rpc.md, frontend/pages/*.md]`.
- Direção de uso: spec → comportamento esperado → arquivos de teste citados → verificação.
- A consolidação em matrizes (feature × teste etc.) vive no relatório da fase (`.ai/.temp/analyses/22-auditoria-testes.md`), não em `current/`.

## Evidências

- E1 — Inventário: 29 arquivos de teste (find, 2026-08-13) `[CONFIRMED: filesystem]`
- E2 — Execuções: 3 rodadas em 2026-08-13 (resultados acima; JSON em `.ai/.temp/analyses/fase6-vitest-results.json`) `[CONFIRMED: runtime behavior]`
- E3 — Configuração: `vitest.config.ts`, `vitest.setup.ts`, `package.json` `[CONFIRMED: configuration]`
- E4 — Cobertura: saída de `vitest run --coverage` (tabela acima) `[CONFIRMED: runtime behavior]`
- E5 — Helpers e skips: `test-helpers.ts`, `describeOrSkip` nas 4 suítes `[CONFIRMED: test]`

## Veja também

- [../security/security-model.md](../security/security-model.md) (regras testadas), [../backend/](../backend/) e [../frontend/](../frontend/) (componentes sob teste)
- `.ai/.temp/analyses/22-auditoria-testes.md` (gap analysis — fora do Current State)
