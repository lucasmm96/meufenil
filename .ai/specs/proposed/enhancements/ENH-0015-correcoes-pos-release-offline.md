# ENH-0015 — Correções pós-release da implementação offline (ENH-0001)

**Type:** ENH
**Status:** PROPOSED
**Title:** Correções pós-release da implementação offline (ENH-0001)
**Issue:** #125
**Created on:** 2026-10-18

## Problem

Testes manuais realizados após o lançamento de v1.21.0 (ENH-0001) identificaram quatro gaps na implementação offline: (1) travamento indefinido em loading quando a sessão está expirada e o dispositivo está offline; (2) página de Estatísticas indisponível offline — AC12 de ENH-0001 não implementado; (3) lentidão e falhas intermitentes na navegação offline; (4) possibilidade de registrar offline com alimento não-favorito via race condition de seleção.

## Current State

ENH-0001 implementado em v1.21.0 (PR #122 Fase 1, PR #123 Fase 2). Spec arquivada em `../../archive/implemented/enhancements/ENH-0001-pwa-offline.md`.

Os quatro gaps identificados:

**P1 — Loading freeze (sessão expirada + offline):** `src/react-app/context/AuthContext.tsx` — `initAuth()` chama `await supabase.auth.getSession()` sem try/catch e sem timeout. Quando o access token está expirado (>1h de inatividade) e o dispositivo está offline, o cliente Supabase JS v2 tenta renovar o token via HTTP POST. Offline, a chamada nunca retorna (TCP timeout de 30–90s em mobile). `setLoadingAuth(false)` jamais é chamada → `loadingAuth` permanece `true` → app travado em skeleton indefinidamente. `onAuthStateChange` também não resolve: o evento `INITIAL_SESSION` aguarda `getSession()` resolver. Viola AC20 ("sessão verificada ao abrir o app").

**P2 — Estatísticas offline (AC12 não implementado):** `src/react-app/hooks/useEstatisticas.ts` chama `getEstatisticas()` (query direta ao Supabase) sem parâmetro `isOnline` e sem fallback para IndexedDB. Offline, a query falha → `data = null`, `loading = false`. Guard `if (!data)` em `src/react-app/pages/Estatisticas.tsx:36` mantém skeleton indefinidamente. AC12 define: "Offline: Estatísticas disponível com dados cacheados (últimos 7 dias)." Os dados necessários já existem na store `historico` do IndexedDB (campos `data` e `fenil_mg`).

**P3 — Lentidão e falhas intermitentes:** Quatro causas contribuintes: (A) `src/react-app/services/offlineStorage.service.ts` abre e fecha o IndexedDB a cada operação individual, sem connection pooling; (B) `OfflineContext.onSync` + hooks dos componentes montados disparam 6–8 requests simultâneos ao voltar online; (C) `runPings()` em `src/react-app/hooks/useOnlineStatus.ts` executa 2 pings serialmente com 1s de intervalo (mínimo de 1s+ para confirmar online); (D) store `historico` vazia no primeiro acesso offline → Histórico exibe "Nenhum registro encontrado" sem contextualizar a causa.

**P4 — Registro offline com alimento não-favorito:** Race condition: modal `src/react-app/components/AdicionarRegistro.tsx` aberto online (lista completa) → dispositivo vai offline → `useReferencias` recarrega com apenas favoritos + customizados, mas `selectedReferencia` (estado local) não é limpo → formulário aceita submissão com alimento fora do cache. Sem risco de corrupção de dados (`fn_upsert_consumo_offline` valida no servidor), mas viola o princípio de que escritas offline operam apenas sobre dados cacheados.

## Proposed State

Quatro correções correspondentes:

**C1 — try/catch/finally + timeout em `initAuth()`:** `setLoadingAuth(false)` sempre chamada (via `finally`), independente de exceção. Timeout de ~5s com `Promise.race()`: se `getSession()` não resolver em 5s, tratar como sem sessão e redirecionar para login com aviso offline. Após ~3s de loading sem resposta, exibir mensagem contextual visível ao usuário (nunca spinner infinito silencioso).

**C2 — Path offline em `useEstatisticas` (implementa AC12):** Adicionar parâmetros `isOnline: boolean` e `userId: string`. Path offline: ler de `read('historico', userId)`, filtrar pelo período, agregar métricas localmente. Corrigir guard em `Estatisticas.tsx`: quando `loading=false` e `data=null`, exibir estado informativo em vez de skeleton. Período "Último Mês" offline: computar sobre os 7 dias disponíveis + exibir aviso de dados parciais (alinhado com UI já existente na página).

**C3 — Melhorias de performance offline:** (A) Singleton de conexão IDB em `offlineStorage.service.ts` (reutilizar instância, reabrir se fechada); (B) Debounce/gate em `OfflineContext.onSync` para evitar execuções paralelas simultâneas; (D) Mensagem de estado vazio diferenciada no Histórico: "Sem registros offline disponíveis — acesse online para sincronizar" quando a store está vazia, vs. mensagem genérica quando o período simplesmente não tem registros. Nota: a latência de confirmação online (C) é trade-off aceitável da detecção de captive portal — fora de escopo desta spec.

**C4 — Validação de seleção offline em `AdicionarRegistro`:** `useEffect` que observa transição `isOnline → false`: se `selectedReferencia` não constar na lista atual de `referencias`, limpar a seleção e exibir aviso inline — "O alimento selecionado não está disponível offline. Selecione um de seus favoritos."

## Motivation

- **FACTUAL:** P1 e P2 violam ACs formalizados em ENH-0001 (AC20, AC12). Evidência direta nos testes manuais de 2026-10-18.
- **FACTUAL:** P2 representa uma omissão de implementação — a spec define o comportamento esperado mas o código não o entrega.
- **FACTUAL:** P1 causa UX gravemente degradada: o usuário fica sem feedback por 30–90 segundos, sem possibilidade de interação.
- **ASSUMPTION:** P3 melhora perceptível de responsividade, especialmente em mobile com IndexedDB lento (não medido — hipótese baseada em análise de código).
- **FACTUAL:** P4 é uma inconsistência de estado de UI; o servidor descarta ou processa corretamente, mas a UX comunica que a operação é válida quando não deveria ser.

## Evidence

- Testes manuais pós-release v1.21.0 (2026-10-18) — 4 comportamentos observados descritos no diagnóstico técnico gerado em sessão
- AC12 de ENH-0001: "Offline: Estatísticas disponível com dados cacheados (últimos 7 dias)" — não satisfeito na implementação atual
- AC20 de ENH-0001: "Sessão verificada ao abrir o app; sessão inválida → redirecionar para login com aviso" — parcialmente satisfeito (sem timeout, sem tratamento de erro)
- Código analisado: `AuthContext.tsx`, `useEstatisticas.ts`, `Estatisticas.tsx`, `offlineStorage.service.ts`, `OfflineContext.tsx`, `useOnlineStatus.ts`, `AdicionarRegistro.tsx`

## Scope

- Correção dos quatro gaps identificados nos testes manuais de v1.21.0
- Nenhuma nova funcionalidade além do que AC12 e AC20 de ENH-0001 já definem

## Out of Scope

- Novas capabilities offline além das definidas em ENH-0001
- Cache da tabela completa de referências globais (~3.000 alimentos) — excluído por volume (ENH-0001 Scope)
- Latência de confirmação online (`runPings` intervalo 1s) — trade-off de detecção de captive portal, aceitável
- Edição de registros offline
- Alterações de schema, migrations ou RLS

## Impacted Features

- ENH-0001 — PWA offline / service worker (`../../archive/implemented/enhancements/ENH-0001-pwa-offline.md`)
- AC12, AC20, AC21 de ENH-0001

## Impacted Business Rules

N/A — nenhuma BR-NNN alterada; as correções implementam comportamento já definido nas ACs.

## Impacted Architecture

N/A — sem decisão arquitetural nova. Singleton IDB é refactoring interno do service.

## Impacted Frontend / Backend / Database / Security / Tests

**Frontend:**
- `src/react-app/context/AuthContext.tsx` — `initAuth()` (C1)
- `src/react-app/hooks/useEstatisticas.ts` — path offline (C2)
- `src/react-app/pages/Estatisticas.tsx` — guard `!data` (C2)
- `src/react-app/services/offlineStorage.service.ts` — singleton IDB (C3-A)
- `src/react-app/context/OfflineContext.tsx` — debounce onSync (C3-B)
- `src/react-app/pages/Historico.tsx` — mensagem estado vazio (C3-D)
- `src/react-app/components/AdicionarRegistro.tsx` — validação seleção (C4)

**Backend:** N/A

**Database:** N/A — sem migrations

**Security:** N/A — sem alterações em RLS, RPC ou autorização

**Tests:** Novos testes de comportamento para C1 (timeout/fallback), C2 (path offline de useEstatisticas), C4 (limpeza de seleção)

## Dependencies

- ENH-0001 implementado (IMPLEMENTED — v1.21.0) ✓

## Risks

- **C1 — Timeout 5s:** usuários com conexão muito lenta mas online poderiam receber falso "sessão expirada" se `getSession()` levar >5s. ASSUMPTION: improvável em condições normais; Supabase resolve de localStorage sem rede quando o token ainda é válido.
- **C3-A — Singleton IDB:** conexão compartilhada pode ser fechada por outro contexto (tab, upgrade de versão). Necessário tratar `onversionchange` e reabrir a conexão quando necessário.
- **C3-B — Debounce onSync:** se o debounce for muito agressivo, pode atrasar a sincronização de operações pendentes ao voltar online. Implementar como idempotência (se já sincronizando, ignorar) em vez de delay temporal.

## Alternatives

- **C1 — Alternativa:** confiar apenas no `onAuthStateChange` sem timeout. Rejeita: o evento `INITIAL_SESSION` também é bloqueado pelo refresh pendente, não resolve o problema.
- **C2 — Alternativa:** manter Estatísticas indisponível offline e exibir mensagem em vez de dados. Rejeita: viola AC12 explícito de ENH-0001.
- **C3-A — Alternativa:** manter `openDB()` por operação e não implementar singleton. Aceita como alternativa se o custo de manutenção do singleton for alto — a correção C3-D (mensagem de estado vazio) é a de maior valor perceptível de P3.

**Decision:** TBD — a escolha entre alternativas é humana e obrigatória para ACCEPTED/IMPLEMENTED.

## Open Questions

1. **Timeout C1:** 5 segundos é o valor correto ou preferível reduzir para 3s em mobile? Trade-off: menor espera vs. risco de falso negativo em conexões lentas.
2. **C3-A — Singleton IDB:** implementar agora como parte desta ENH ou extrair para DEBT separado? (A correção tem risco de edge case em `onversionchange`.)
3. **Mensagem de loading C1:** o aviso após 3s de loading deve ser exibido na `LayoutSkeleton` (componente compartilhado) ou em cada página individualmente?

## Post-Deploy Steps

N/A — sem migrations, sem configuração de serviço externo, sem variáveis de ambiente.

## Acceptance Criteria

**C1 — Loading freeze:**
- AC1: Ao abrir o app com sessão expirada (access token >1h) e dispositivo offline, a tela de login é exibida em ≤5s com aviso de sessão/offline — nunca spinner indefinido.
- AC2: `initAuth()` com token válido e dispositivo offline: app carrega normalmente com dados offline em <1s (token resolvido de localStorage sem rede).
- AC3: Se `getSession()` lançar exceção, `setLoadingAuth(false)` é chamada e a tela de login é exibida — sem crash, sem estado travado.

**C2 — Estatísticas offline (AC12):**
- AC4: Página /estatisticas abre offline com dados dos últimos 7 dias disponíveis no cache (store `historico`), sem skeleton infinito.
- AC5: Toggle "Último Mês" offline exibe aviso de dados parciais e computa sobre os 7 dias disponíveis.
- AC6: Exportar CSV/JSON bloqueado offline (comportamento já existente, não regredir).
- AC7: Quando `loading=false` e `data=null` (cache vazio ou falha), página exibe estado informativo em vez de skeleton infinito.

**C3 — Lentidão/intermitência:**
- AC8: Histórico offline com store vazia exibe mensagem contextual ("Sem dados offline disponíveis — acesse online para sincronizar") em vez de "Nenhum registro encontrado".
- AC9: Navegar entre Dashboard → Histórico → Estatísticas offline 5× consecutivo sem congelamento perceptível de UI.

**C4 — Seleção de alimento:**
- AC10: Modal AdicionarRegistro: ao transicionar online→offline com alimento não-favorito selecionado, seleção é limpa + aviso inline exibido.
- AC11: Modal AdicionarRegistro: ao transicionar online→offline com favorito selecionado, seleção é mantida e formulário permanece funcional.

## References

- ENH-0001 spec arquivada: `.ai/specs/archive/implemented/enhancements/ENH-0001-pwa-offline.md`
- Diagnóstico técnico completo: gerado em sessão de 2026-10-18 (análise de `AuthContext.tsx`, `useEstatisticas.ts`, `Estatisticas.tsx`, `offlineStorage.service.ts`, `OfflineContext.tsx`, `useOnlineStatus.ts`, `AdicionarRegistro.tsx`)
