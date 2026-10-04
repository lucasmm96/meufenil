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

Comportamento por tela:
- **Telas bloqueadas offline:** Exames PKU, Perfil, Admin — informativo por tela; demais funcionalidades indisponíveis
- **Telas parcialmente disponíveis:** Dashboard (dados cacheados; criar medição bloqueado), Histórico (AC3: 7 dias; exportar bloqueado), Referências (AC2: só favoritos; tabela completa bloqueada), Estatísticas (dados 7d cacheados; toggle "Último Mês" com aviso de dados parciais; export bloqueado)
- **Telas totalmente disponíveis offline:** Login (AC11: login padrão + OfflineBanner), Sobre (conteúdo estático — app shell)

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
- **Responsabilidade SW vs app layer:** SW gerencia apenas o app shell (precaching Workbox); detecção de offline e gerenciamento do IndexedDB são realizados no app layer (hooks/services React) — sem interceptação de requests de API pelo SW, sem JWT handling no SW (Fase 1)
- **Schema IndexedDB:** duas stores — `favoritos` e `historico`; chaves prefixadas por `user_id`; sem limite explícito de tamanho; expiração por substituição na sync online (ao fazer fetch com rede, substitui conteúdo com os últimos 7 dias); limpeza completa no logout
- **Atualização do SW pós-deploy:** prompt ao usuário via banner/toast "Nova versão disponível. Atualizar agora?" — Workbox suporta nativamente via `workbox-window`
- **Verificação de conectividade real:** ao evento `online`, executar lightweight ping antes de declarar estado online — evitar false positives de captive portals (Wi-Fi de hospital/restaurante sem autenticação)
- **Re-sync proativo:** ao confirmar online via ping, re-fetchar e atualizar todas as stores IndexedDB (favoritos + histórico); `OfflineBanner` transiciona para estado "sincronizando" durante o re-sync
- **Limpeza do IndexedDB — triggers:** logout explícito (botão) + expiração silenciosa de sessão via Supabase auth state change listener
- **Limpeza do IndexedDB — delegação (FEAT-0011):** ao sair de conta delegada e retornar à conta própria, stores prefixadas com o `user_id` do usuário delegado são limpas
- **Sincronização de favoritos:** store `favoritos` atualizada em dois momentos: (1) fetch bem-sucedido na página de Referências (substituição completa); (2) imediatamente após add/remove de favorito (atualização incremental) — garante que favorito recém-adicionado já esteja offline se o usuário perder rede antes do próximo fetch
- **Vercel + SW — configuração de headers:** adicionar regra no `vercel.json` para o `/sw.js` gerado: `Cache-Control: no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /` — sem isso, Vercel pode cachear o SW com TTL longo e usuários ficariam com app shell desatualizado após novo deploy; o rewrite `/(.*) → /index.html` não afeta o SW (Vercel serve arquivos reais antes de aplicar rewrites)
- **Detecção de iOS offline:** `useOnlineStatus` detecta iOS (via user agent) — ao perder conexão em iOS, `OfflineBanner` exibe informativo específico em vez da experiência offline normal; dados cacheados não são exibidos no iOS

## Out of Scope

- Escrita offline (criação de medições sem rede) — Fase 2, spec futura
- Sincronização de dados de escrita / conflict resolution — Fase 2
- Cache de toda a tabela de referências (~3 mil itens) — excluído por volume
- Suporte offline no iOS Safari — excluído; usuário iOS que perde conexão recebe informativo específico ("Acesso offline não disponível no iOS. Reconecte-se para continuar."); app funciona normalmente online em qualquer iOS

## Impacted Features

- [FEAT-0014 PWA](../../current/features/FEAT-0014-pwa.md)
- [FEAT-0008 Referências alimentares](../../current/features/FEAT-0008-referencias-alimentares.md) (favoritos)
- [FEAT-0011 Delegação de acesso](../../current/features/FEAT-0011-delegacao-acesso.md) (limpeza do IndexedDB ao sair da conta delegada — AC13)

## Impacted Frontend

- `vite.config.ts` — adicionar `@vite-pwa/vite-plugin-pwa`
- `public/` — manifest, SW gerado
- Novo hook: `useOnlineStatus` (navigator.onLine + eventos online/offline + ping de conectividade + dispatch de re-sync proativo)
- Novo componente: `OfflineBanner` — dois estados: offline ("Você está offline. Exibindo dados armazenados localmente.") e sincronizando ("Conexão restaurada. Atualizando dados...")
- Modificações por tela: avisos de funcionalidade offline parcial/indisponível

## Impacted Tests

- NONE hoje (FEAT-0014) — testes necessários:

**Unitários — `useOnlineStatus`:**
- Estado inicial correto (`navigator.onLine`)
- Transição offline → online e online → offline via evento
- Detecção de iOS (user agent)
- Ping executado após evento `online`; falha mantém estado offline; sucesso dispara re-sync

**Componente — `OfflineBanner`:**
- Não renderiza quando online
- Estado offline: texto e visibilidade corretos
- Estado sincronizando: texto de feedback ("Conexão restaurada. Atualizando dados...")
- Estado iOS offline: mensagem específica de iOS

**Unitários — Serviço IndexedDB (via `fake-indexeddb`):**
- Escrita de favoritos: substituição completa por user_id
- Leitura de favoritos quando offline
- Atualização incremental após add/remove de favorito
- Escrita de histórico: substituição dos últimos 7 dias
- Limpeza completa de stores por user_id no logout
- Limpeza de stores do usuário delegado ao sair da delegação
- Isolamento: stores de user A não afetam stores de user B

**Componente — Telas com comportamento offline:**
- Referências: exibe apenas favoritos + aviso quando offline
- Histórico: exibe últimos 7 dias + aviso; export bloqueado
- Estatísticas: dados 7d com aviso no toggle "Último Mês"; export bloqueado
- Exames e Perfil: informativo "indisponível offline" exibido
- Dashboard: dados cacheados exibidos; "criar medição" bloqueada

**Validação manual (não automatizável via vitest):**
- AC1: app abre offline a partir do segundo carregamento (requer SW real no browser)
- AC10: prompt de atualização SW após novo deploy (requer ciclo de deploy)
- AC14: headers do `/sw.js` no Vercel (requer ambiente deployado)
- AC15: comportamento iOS em dispositivo real

## Dependencies

- `vite-plugin-pwa` (nova dependência de dev)
- Workbox (transitiva via plugin)
- `fake-indexeddb` (nova dependência de dev — testes unitários do serviço IndexedDB)

## Risks

- **Cache stale de dados clínicos**: network-first mitiga; avisos ao usuário garantem clareza
- **iOS Safari**: suporte offline excluído do escopo da Fase 1 — ao perder conexão no iOS, `OfflineBanner` exibe informativo específico ("Acesso offline não disponível no iOS. Reconecte-se para continuar."); app funciona normalmente online em qualquer iOS
- **Invalidação no logout**: dados de usuário no IndexedDB devem ser limpos ao sair da conta
- **Vercel rewrite vs. escopo do SW (U-5.2)**: rewrite `/(.*) → /index.html` não afeta o SW (Vercel serve arquivos reais antes de reescrever — sem conflito); risco real é o `Cache-Control` do `/sw.js` — mitigado com regra de header `no-cache` em `vercel.json` (ver Scope e AC14)
- **Atualização do SW pós-deploy**: mitigado — prompt ao usuário via `workbox-window` (AC10); Workbox suporta nativamente
- **Login offline sem sessão prévia**: mitigado — AC11 cobre o comportamento (tela de login padrão + `OfflineBanner`)
- **Re-sync em dados móveis**: re-fetchar todas as stores ao voltar online consome dados; volume PKU (histórico 7d + favoritos) é pequeno — risco aceitável

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

**Resolvidas no refinamento:**

| Questão | Resolução |
|---|---|
| Schema do IndexedDB | Duas stores: `favoritos` e `historico`; chaves prefixadas por `user_id`; sem limite de tamanho; limpeza completa no logout |
| Política de expiração dos 7 dias | Na sync online: ao fazer fetch com rede, IndexedDB é substituído com os últimos 7 dias recém-buscados — sem lógica extra de data |
| Atualização do SW pós-deploy | Prompt ao usuário: banner/toast "Nova versão disponível. Atualizar agora?" com botão — Workbox suporta nativamente |
| Comportamento offline sem sessão | Tela de login padrão com `OfflineBanner` no topo — sem tela dedicada; login requer conexão |
| Limites de armazenamento IndexedDB | Sem limite explícito — volume PKU (20–100 registros + favoritos) não representa risco de quota |
| Mapeamento de telas × comportamento offline | Ver seção "Comportamento Offline por Tela" — 9 telas mapeadas com informativo contextual por tela |
| Sincronização de favoritos no IndexedDB | Fetch bem-sucedido na página de Referências (substituição completa) + add/remove imediato (atualização incremental) |
| Vercel rewrite vs. escopo do SW (U-5.2) | Rewrite não afeta o SW; risco real é Cache-Control do `/sw.js` — mitigado com regra de header no `vercel.json` (AC14); risco aceito, validar na implementação |
| iOS Safari — postura offline | Excluído do escopo offline; informativo específico ao perder conexão no iOS (AC15); app funciona normalmente online |

## Acceptance Criteria (Fase 1)

- **AC1:** App abre offline (sem rede) a partir do segundo carregamento — app shell servido pelo SW
- **AC2:** Offline: página de referências exibe apenas favoritos do usuário com aviso explícito ("Você está offline. Exibindo apenas seus favoritos.")
- **AC3:** Offline: histórico exibe apenas registros dos últimos 7 dias com aviso explícito ("Exibindo registros armazenados localmente dos últimos 7 dias.")
- **AC4:** Offline: barra fixa visível em todas as páginas indicando versão offline
- **AC5:** Offline: funcionalidades somente-online (criar medição, exportar, etc.) mostram informativo claro de indisponibilidade
- **AC6:** Ao voltar online: (1) ping de conectividade real executado; (2) após confirmação: `OfflineBanner` transiciona para estado "sincronizando" com mensagem de feedback ao usuário (ex: "Conexão restaurada. Atualizando dados..."); (3) re-sync completo das stores IndexedDB (favoritos + histórico) executado em background; (4) ao concluir: `OfflineBanner` e informativos por tela removidos automaticamente; dados da UI refletidos com dados frescos
- **AC7:** IndexedDB do usuário é limpo em dois triggers: (1) logout explícito (botão de logout); (2) expiração silenciosa de sessão (token expirado) — via listener do auth state change do Supabase
- **AC8:** Sem regressão na experiência online (performance, atualização de dados, comportamento existente)
- **AC9:** Cobertura de testes automatizados: (1) `useOnlineStatus` — estados, transições online/offline, detecção de iOS, lógica de ping, dispatch de re-sync; (2) `OfflineBanner` — três estados (offline, sincronizando, iOS offline); (3) serviço IndexedDB via `fake-indexeddb` — escrita/leitura/limpeza por user_id, isolamento entre usuários, atualização incremental de favoritos; (4) telas com comportamento offline diferenciado (Referências, Histórico, Estatísticas, Exames, Perfil)
- **AC10:** Quando novo SW é detectado após deploy, prompt "Nova versão disponível. Atualizar agora?" é exibido; ao confirmar, app recarrega com a versão atualizada
- **AC11:** Offline sem sessão prévia: tela de login padrão exibida com `OfflineBanner` visível no topo, comunicando que login requer conexão
- **AC12:** Offline: Estatísticas disponível com dados cacheados (últimos 7 dias); toggle "Última Semana" exibe normalmente; toggle "Último Mês" exibe aviso "Dados incompletos offline — exibindo apenas os últimos 7 dias disponíveis"; exportar CSV/JSON bloqueado com informativo
- **AC13:** Delegação de acesso: ao retornar da conta delegada para a conta própria, stores do IndexedDB prefixadas com o `user_id` do usuário delegado são limpas automaticamente
- **AC14:** `vercel.json` configurado com `Cache-Control: no-cache, no-store, must-revalidate` e `Service-Worker-Allowed: /` para `/sw.js`; SW servido como JS (não reescrito para HTML pelo rewrite) e registrado com scope `/`
- **AC15:** iOS offline: ao perder conexão em dispositivo iOS, `OfflineBanner` exibe mensagem específica ("Acesso offline não disponível no iOS. Reconecte-se para continuar.") em vez da experiência offline normal; dados cacheados não são apresentados

## Comportamento Offline por Tela

| Tela | Comportamento offline | Informativo contextual |
|---|---|---|
| Login (`/`) | Disponível — login padrão + `OfflineBanner` (AC11) | — |
| Dashboard (`/dashboard`) | Disponível — dados do dia via historico cacheado; "criar medição" bloqueada | "Criar medições requer conexão." (junto à ação bloqueada) |
| Histórico (`/historico`) | Disponível parcial — últimos 7 dias; exportar bloqueado (AC3) | "Exibindo registros armazenados localmente dos últimos 7 dias." |
| Referências (`/referencias`) | Disponível parcial — só favoritos; tabela completa bloqueada (AC2) | "Você está offline. Exibindo apenas seus favoritos." |
| Estatísticas (`/estatisticas`) | Disponível parcial — dados 7d cacheados; toggle "Último Mês" com aviso de dados parciais; export bloqueado (AC12) | "Você está offline. Exibindo dados dos últimos 7 dias. O período 'Último Mês' pode estar incompleto." |
| Exames (`/exames`) | Bloqueada offline | "Exames PKU indisponíveis offline." |
| Perfil (`/perfil`) | Bloqueada offline | "Perfil indisponível offline." |
| Admin (`/admin`) | Bloqueada offline | "Painel administrativo indisponível offline." |
| Sobre (`/sobre`) | Disponível — conteúdo estático (app shell) | — |

> **iOS Safari:** ao perder conexão em qualquer tela, o `OfflineBanner` exibe informativo específico de iOS em vez do comportamento offline normal descrito acima. Suporte offline excluído do escopo da Fase 1 em iOS.

## Evidence / References

- `.ai/specs/current/features/FEAT-0014-pwa.md`
- `.ai/specs/current/features/FEAT-0008-referencias-alimentares.md`
- `vercel.json` (rewrite `/(.*) → /index.html`)
- `vite.config.ts` (sem plugin PWA atual)
- `public/manifest.json` (manifest completo)
- `database: referencias_favoritas` (tabela de favoritos existente, FEAT-0008)
