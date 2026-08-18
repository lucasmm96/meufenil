# Testing Strategy — Estado Atual

**Última verificação:** 2026-08-15 (commit 0eb2e9b) — suíte executada nesta data (3 execuções: 1 completa verde, 1 cobertura verde, 1 cobertura com falha transitória das suítes de segurança — ver seção 5).

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
| CI | W1 — `.github/workflows/ci.yml` (push/PR: lint → `test:run` → build; sem IA; `contents: read`; suítes de segurança pulam sem `SUPABASE_SERVICE_ROLE_KEY`) | `.github/workflows/ci.yml` |
| Exclusões de coverage | nenhuma configuração explícita | `vitest.config.ts` |

## 2. Organização e convenções

- **Localização:** testes colocalizados ao lado do código (`X.test.ts`/`X.test.tsx` junto de `X.ts`/`X.tsx`) — sem diretório `__tests__` `[CONFIRMED: filesystem]`.
- **Naming:** `describe("<módulo>")` + `it("descrição em pt-BR")` ("deve ...", "define erro quando ..."); cenários de segurança numerados (`AV.x`, `T1.x`, `T2.x`, `T3.x`) `[CONFIRMED: test]`.
- **Fixtures:** dados inline nos testes; nenhuma pasta de fixtures `[CONFIRMED: ausência]`.
- **Mocks:** `vi.mock` de módulos (services mockam o cliente supabase e fazem assertions sobre chamadas — `toHaveBeenCalledWith`); `Admin.test.tsx` mocka 5 módulos (Layout, skeletons, AuthContext, useAdmin, useBackgroundJobsAdmin); os testes de páginas criados pelo TEST-0001 seguem o mesmo padrão de mocks de hooks (e.g. `Perfil.test.tsx` mocka Layout, skeletons, AuthContext, usePerfil, supabase, react-router-dom; `Referencias.test.tsx` e `Dashboard.test.tsx` mockam os hooks e, no Dashboard, os componentes filhos e o recharts); `api/keepalive.test.ts` mocka `createClient` e `recordBackgroundJobExecution` `[CONFIRMED: test]`.
- **Helpers:** `src/shared/security/test-helpers.ts` — Abordagem B (JWTs reais), `createTestUser`, `cleanupAllTestUsers`, `isSecurityMigrationApplied` `[CONFIRMED: test]`.
- **Snapshots:** nenhum identificado `[CONFIRMED: ausência]`.

## 3. Níveis de teste existentes

| Nível | Arquivos | Característica |
|---|---|---|
| Unit (shared) | `src/shared/background-jobs.test.ts` | helper puro com client mockado |
| Service (client-side) | 10 arquivos em `services/*.service.test.ts` | mocks do supabase; assertions de chamadas e AppError |
| Hook | 12 arquivos em `hooks/use*.test.ts(x)` | `renderHook` (Testing Library) + mocks de services/supabase |
| Component/Page | 6 arquivos: `pages/{Admin,Perfil,Referencias,Dashboard}.test.tsx` + `components/{AdicionarRegistro,ConsentimentoLGPD}.test.tsx` | `render` + mocks de hooks; 72 testes (3+17+25+12+13+2) cobrindo estados loading/empty/error, interações e fluxos destrutivos |
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

## 5. Resultados observados

**2026-08-15 (pós-TEST-0001):**
- **34 arquivos de teste, 197 testes.**
- Execução 1 (`test:run`): **197/197 passaram** (0 falhas, 0 skips — as 4 suítes de segurança rodaram).
- Execução 2 (`test:coverage`): **197/197 passaram** — cobertura coletada (seção 6).
- Execução 3 (`test:coverage`): falha transitória em `rpc-remover-referencia` (`createTestUser`: `status=500 Database error creating new user`) — mesmo mecanismo de não-determinismo identificado na Fase 6 (colisão de email entre workers paralelos); demais suítes verdes. Registrada, não tratada (escopo do TEST-0005).

**2026-08-13 (Fase 6):**
- **29 arquivos de teste, 128 testes.**
- Execução 1: **1 suíte falhou** (`rpc-remover-referencia` — erro transitório `422 "A user with this email address has already been registered"` em `createTestUser`); 119 passaram; 9 skipped.
- Execução 2: **128/128 passaram** (0 falhas, 0 skips).
- Execução 3 (coverage): **9 skipped** na mesma suíte (mesmo mecanismo).
- **Causa identificada:** `uniqueTestEmail()` usa `Date.now()` + contador POR PROCESSO (`test-helpers.ts:112-118`); as suítes `rpc-ativar` e `rpc-remover` rodam em workers paralelos e podem gerar o mesmo email no mesmo milissegundo → colisão. **Não-determinismo sob paralelismo — fato confirmado em 2 de 3 execuções.**
- Duração típica: ~30–40s (setup 30s; suítes de segurança 4–10s cada).

## 6. Cobertura quantitativa (execução com --coverage, 2026-08-15)

**Overall: 82.46% statements · 71.25% branches · 83.6% functions · 85.39% lines** (Fase 6: 80.7 / 65.18 / 84.96 / 83.2)

Por área:

| Área | % Stmts | % Branch | % Funcs | % Lines | Observação |
|---|---|---|---|---|---|
| `api/` | 78.18 | 74.07 | 100 | 78.18 | `keepalive.ts` inalterado |
| `src/react-app/components/` | 94.0 | 89.83 | 93.54 | 97.82 | `ConsentimentoLGPD` 100; `AdicionarRegistro` 93.58; `ModalReferencia` e cards login-as exercitados via páginas |
| `src/react-app/hooks/` | 89.81 | 67.05 | 84.21 | 91.13 | inalterado; `useReferencias` 60.86 (mais baixo) |
| `src/react-app/lib/` | 100 | 100 | 100 | 100 | `errors.ts` |
| `src/react-app/pages/` | 80.51 | 74.75 | 72.09 | 84.78 | `Admin` 74.66, `Dashboard` 80.55, `Perfil` 92.75, `Referencias` 77.34 — **4 de 9 páginas na tabela**; as outras 5 não são importadas por nenhum teste (sem cobertura registrada) |
| `src/react-app/services/` | 76.24 | 64.81 | 86.95 | 79.59 | inalterado; `referencias.service` 48.23 (mais baixo) |
| `src/shared/` | 100 | 100 | 100 | 100 | `background-jobs.ts`; `security/test-helpers.ts` 70.31 (exercitado pelas 4 suítes reais) |

Notas factuais sobre a medição:
- A tabela de cobertura lista somente arquivos IMPORTADOS por testes; ausência na tabela = sem cobertura registrada (não aparece com 0%, simplesmente não é listado) `[CONFIRMED: comportamento do relatório observado]`.
- `context/` (AuthContext) continua ausente — apenas MOCKADO pelos testes de páginas → não medido `[CONFIRMED: comportamento do relatório observado]`.
- Nenhum threshold configurado; o percentual é informativo, não um gate `[CONFIRMED: configuration]`.

## 7. Limitações observadas (fatos)

- Páginas sem teste próprio: `Estatisticas`, `Exames`, `Historico`, `Home`, `Sobre` (5 de 9). As 4 testadas (Admin, Perfil, Referencias, Dashboard) usam mocks de hooks — o comportamento real de hooks/contextos não é exercitado nelas.
- Componentes sem teste direto: `Layout`, `ModalReferencia` e os 5 de `login-as/` — exercitados apenas indiretamente via testes de páginas (ModalReferencia e cards login-as) ou mockados (Layout).
- `AuthContext` sem teste direto (apenas mockado).
- `delegacoesAcesso.service` sem teste (único service sem teste).
- Edge functions (`delegar-acesso`, `delete-account`) sem testes.
- CLI e script de migrations sem testes.
- Políticas RLS de `registros`, `exames_pku`, `referencias_favoritas` e `delegacoes_acesso` sem suítes de segurança próprias (as 4 suítes cobrem `usuarios` + 2 RPCs).
- Triggers do banco (normalização de nome, retenção 365d, limpeza de favoritos) sem teste direto.
- Testes de segurança dependem do banco development real (dados de teste criados/limpos; estado compartilhado com desenvolvimento).

## 8. Relação Spec × Test (mecanismo existente)

- Cada spec de `current/` possui a seção `## Testes que cobrem...` (tabelas/RPCs) ou `## Testes existentes` (páginas) — listando os arquivos de teste reais (ou a ausência). Esse é o vínculo atual entre comportamento documentado e comportamento testado `[CONFIRMED: specs — database/*.md, rpc.md, frontend/pages/*.md]`.
- Direção de uso: spec → comportamento esperado → arquivos de teste citados → verificação.
- A consolidação em matrizes (feature × teste etc.) vive no relatório da fase (`.ai/.temp/analyses/22-auditoria-testes.md`), não em `current/`.

## Evidências

- E1 — Inventário: 34 arquivos de teste (find, 2026-08-15); 29 em 2026-08-13 `[CONFIRMED: filesystem]`
- E2 — Execuções: 3 rodadas em 2026-08-15 (resultados na seção 5; saída completa em `.ai/.temp/test-0001-coverage.txt`) `[CONFIRMED: runtime behavior]`
- E3 — Configuração: `vitest.config.ts`, `vitest.setup.ts`, `package.json` `[CONFIRMED: configuration]`
- E4 — Cobertura: saída de `vitest run --coverage` (tabela acima) `[CONFIRMED: runtime behavior]`
- E5 — Helpers e skips: `test-helpers.ts`, `describeOrSkip` nas 4 suítes `[CONFIRMED: test]`
- E6 — Testes criados pelo TEST-0001: `pages/{Perfil,Referencias,Dashboard}.test.tsx`, `components/{AdicionarRegistro,ConsentimentoLGPD}.test.tsx` `[CONFIRMED: test]`

## Veja também

- [../security/security-model.md](../security/security-model.md) (regras testadas), [../backend/](../backend/) e [../frontend/](../frontend/) (componentes sob teste)
- `.ai/.temp/analyses/22-auditoria-testes.md` (gap analysis — fora do Current State)
