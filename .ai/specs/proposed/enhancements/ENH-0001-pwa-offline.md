# ENH-0001 — PWA offline / service worker

**Type:** ENH
**Status:** PROPOSED
**Issue:** #10
**Title:** PWA offline / service worker

## Problem

A capacidade PWA limita-se à instalação (manifest/ícones); não há service worker, cache ou comportamento offline no repositório. Usuários de PKU registram refeições fora de casa (restaurantes, consultas médicas) — conectividade intermitente é real e impacta o uso diário do app.

## Current State

Manifest completo (standalone, ícones 192/512/maskable, pt-BR); sem service worker; sem `vite-plugin-pwa` ou workbox nas dependências; comportamento de cache da plataforma Vercel não verificado (U-5.2) `[CONFIRMED: configuration, filesystem — FEAT-0014]`.

## Proposed State — Fase 1

PWA com cache offline somente-leitura, cobrindo:

1. **App Shell** — HTML/CSS/JS/ícones/manifest com precaching via Workbox (network-first ou cache-first para assets estáticos)
2. **Referências favoritas do usuário** — a tabela `referencias_favoritas` do usuário é cacheada localmente (IndexedDB); offline exibe apenas os favoritos com aviso explícito
3. **Registros dos últimos 7 dias** — medições recentes cacheadas localmente (IndexedDB); offline exibe somente esse intervalo com aviso explícito
4. **UI de estado offline completa:**
   - Barra fixa no topo (todas as páginas) indicando acesso à versão offline
   - Informativos por tela para funcionalidades indisponíveis ou parcialmente disponíveis
   - Ao voltar online: barra e informativos removidos automaticamente; dados re-fetched

Funcionalidades somente-online (indisponíveis offline): criação de medições, edição, sincronização de referências, exportação, acesso à tabela de referências completa.

## Proposed State — Fase 2 (spec futura, não neste escopo)

Escrita offline com fila de sincronização: usuário pode criar medições offline (usando favoritos); registro fica "pendente de sync" localmente; ao retornar online, sincroniza automaticamente com Supabase. Dependência: Fase 1 implementada. Ver análise de feasibility abaixo.

## Motivation

- **FACTUAL:** gap documentado (FEAT-0014 "sem offline"); ~3 mil referências no banco mas somente favoritos do usuário precisam estar offline.
- **VALIDATED:** necessidade real — uso em contextos sem rede (refeições fora, consultas) confirmado como cenário esperado pelo stakeholder.

## Evidence

FEAT-0014 (spec); U-5.2; `referencias_favoritas` (banco existente, FEAT-0008); Fase 5 (PWA).

## Scope (Fase 1)

- Adicionar `vite-plugin-pwa` + Workbox ao projeto
- Configurar precaching do app shell
- Verificar compatibilidade com rewrite Vercel `/(.*) → /index.html` e escopo do SW
- `useOnlineStatus` hook (navigator.onLine + eventos online/offline)
- Cache offline de favoritos do usuário (IndexedDB, invalidado no logout)
- Cache offline de registros dos últimos 7 dias (IndexedDB)
- Estratégia network-first com fallback para IndexedDB para endpoints de dados
- `OfflineBanner` — componente fixo no topo visível em todas as páginas quando offline
- Informativos contextuais por tela (funcionalidade indisponível ou parcial)
- Restore online: evento `online` → refetch + remoção de informativos

## Out of Scope

- Escrita offline (criação de medições sem rede) — Fase 2, spec futura
- Sincronização de dados de escrita / conflict resolution — Fase 2
- Cache de toda a tabela de referências (~3 mil itens) — excluído por volume

## Impacted Features

- [FEAT-0014 PWA](../../current/features/FEAT-0014-pwa.md)
- [FEAT-0008 Referências alimentares](../../current/features/FEAT-0008-referencias-alimentares.md) (favoritos)

## Impacted Frontend

- `vite.config.ts` — adicionar `@vite-pwa/vite-plugin-pwa`
- `public/` — manifest, SW gerado
- Novo hook: `useOnlineStatus`
- Novo componente: `OfflineBanner`
- Modificações por tela: avisos de funcionalidade offline parcial/indisponível

## Impacted Tests

- NONE hoje (FEAT-0014) — testes necessários:
  - Comportamento offline/online do hook `useOnlineStatus`
  - Renderização e visibilidade do `OfflineBanner`
  - Lógica de exibição de avisos por tela

## Dependencies

- `vite-plugin-pwa` (nova dependência de dev)
- Workbox (transitiva via plugin)

## Risks

- **Cache stale de dados clínicos**: network-first mitiga; avisos ao usuário garantem clareza
- **iOS Safari**: Service Worker tem suporte parcial no iOS; testar comportamento de cache e atualização
- **Invalidação no logout**: dados de usuário no IndexedDB devem ser limpos ao sair da conta
- **Vercel rewrite vs. escopo do SW**: validar que o SW é servido em `/` e intercepta corretamente

## Alternatives

- A — service worker com cache estático apenas (app shell)
- B — cache estático + dados de leitura limitados (favoritos + 7d histórico) **← DECISÃO**
- C — manter status quo

**Decision:** Alternativa B com UI offline completa (barra + informativos por tela + restore online)

## Análise de Feasibility — Escrita Offline (Fase 2)

> Esta seção documenta a análise de viabilidade para embasar a spec da Fase 2.

**Background Sync API:**
- Chrome/Edge: suportado ✅ | Firefox: não suportado ✗ | iOS Safari: limitado (sem background real) ✗
- Alternativa para iOS: sync manual ao detectar evento `online` (usuário precisa abrir o app)

**Complexidade:**
- IndexedDB para queue de registros pendentes (UUID local gerado client-side antes de enviar ao Supabase)
- JWT handling no SW (interceptar requests autenticados)
- Conflict resolution: registros criados offline podem conflitar com o mesmo dia em outro device
- Total de Phe calculado localmente com favoritos parciais diverge do total real — usuário precisa ser informado
- UI: cada registro pendente de sync precisa de indicador visual de estado

**Custo:** estimativa de ~2× o escopo da Fase 1. Requer spec separada com análise aprofundada.

**Dependências da Fase 2:** Fase 1 implementada; decisão sobre conflict resolution strategy; revisão de segurança (JWT + SW).

## Open Questions

Resolvidas pela análise:

| Questão | Resolução |
|---|---|
| Quais dados podem ser cacheados sem risco? | App shell + favoritos do usuário + 7 dias de histórico (leitura) — sem risco clínico; avisos de dados parciais no UI |
| Necessidade real de offline para o público? | Confirmada — uso em campo sem rede é cenário esperado |
| Escrita offline é viável? | Tecnicamente viável, mas custo alto e suporte iOS limitado → Fase 2 separada |
| Date range dos registros offline? | 7 dias, com aviso claro ao usuário sobre a limitação |

## Acceptance Criteria (Fase 1)

- **AC1:** App abre offline (sem rede) a partir do segundo carregamento — app shell servido pelo SW
- **AC2:** Offline: página de referências exibe apenas favoritos do usuário com aviso explícito ("Você está offline. Exibindo apenas seus favoritos.")
- **AC3:** Offline: histórico exibe apenas registros dos últimos 7 dias com aviso explícito ("Exibindo registros armazenados localmente dos últimos 7 dias.")
- **AC4:** Offline: barra fixa visível em todas as páginas indicando versão offline
- **AC5:** Offline: funcionalidades somente-online (criar medição, exportar, etc.) mostram informativo claro de indisponibilidade
- **AC6:** Ao voltar online: barra e informativos removidos automaticamente; dados atualizados via re-fetch
- **AC7:** Logout limpa dados do usuário do IndexedDB (favoritos e histórico cacheados)
- **AC8:** Sem regressão na experiência online (performance, atualização de dados, comportamento existente)
- **AC9:** Testes unitários para `useOnlineStatus` e `OfflineBanner`

## Evidence / References

- `.ai/specs/current/features/FEAT-0014-pwa.md`
- `.ai/specs/current/features/FEAT-0008-referencias-alimentares.md`
- `vercel.json` (rewrite `/(.*) → /index.html`)
- `vite.config.ts` (sem plugin PWA atual)
- `public/manifest.json` (manifest completo)
- `database: referencias_favoritas` (tabela de favoritos existente, FEAT-0008)
