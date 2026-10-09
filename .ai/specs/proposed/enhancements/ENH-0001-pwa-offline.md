# ENH-0001 — PWA offline / service worker

**Type:** ENH
**Status:** PROPOSED
**Issue:** #10
**Title:** PWA offline / service worker

## Problem

A capacidade PWA limita-se à instalação (manifest/ícones); não há service worker, cache ou comportamento offline no repositório. Usuários de PKU registram refeições fora de casa (restaurantes, consultas médicas) — conectividade intermitente é real e impacta o uso diário do app.

## Current State

Manifest completo (standalone, ícones 192/512/maskable, pt-BR); sem service worker; sem `vite-plugin-pwa` ou workbox nas dependências; comportamento de cache da plataforma Vercel não verificado (U-5.2) `[CONFIRMED: configuration, filesystem — FEAT-0014]`.

## Modelo de Fases

Esta spec cobre **duas fases** de implementação sequenciais:

- **Fase 1 — Offline somente-leitura:** app shell + cache de dados do usuário (favoritos, alimentos customizados, 7 dias de histórico); dados disponíveis para consulta offline; escritas bloqueadas (exceto via fila, na Fase 2).
- **Fase 2 — Offline com escrita:** criação e exclusão de registros de consumo offline; fila de sincronização local; sincronização ao retornar online. Edição offline está fora de escopo — para corrigir um registro, o usuário exclui e cria novo. **Dependência:** Fase 1 implementada e estável (AC1–AC21 passing).

As seções abaixo são organizadas por fase quando o comportamento difere. Critérios de aceite da Fase 1 são pré-requisito para iniciar a Fase 2.

## Proposed State — Fase 1

PWA com cache offline somente-leitura, cobrindo:

1. **App Shell** — HTML/CSS/JS/ícones/manifest com precaching via Workbox (network-first ou cache-first para assets estáticos)
2. **Referências favoritas do usuário** — cacheadas localmente (IndexedDB); offline exibe apenas favoritos com aviso explícito; adição/remoção de favoritos bloqueada offline
3. **Alimentos customizados do usuário** — referências criadas pelo próprio usuário; cacheadas localmente (IndexedDB); disponíveis offline junto com favoritos; base para seleção em registros offline na Fase 2
4. **Registros dos últimos 7 dias** — medições recentes cacheadas localmente (IndexedDB); offline exibe somente esse intervalo com aviso explícito
5. **Dados de perfil** — nome, e-mail e limite diário cacheados localmente (IndexedDB); offline exibe em modo somente leitura
6. **UI de estado offline completa:**
   - Barra fixa no topo (todas as páginas) indicando acesso à versão offline
   - Informativos por tela para funcionalidades indisponíveis ou parcialmente disponíveis
   - Ao voltar online: barra e informativos removidos automaticamente; dados re-fetched

Comportamento por tela (Fase 1):
- **Telas bloqueadas offline:** Exames PKU, Admin — informativo por tela
- **Telas somente leitura offline:** Perfil (nome, e-mail, limite diário exibidos; ações bloqueadas), Conta delegada bloqueada (offline prioriza registro da dieta PKU do próprio usuário)
- **Telas parcialmente disponíveis:** Dashboard (dados cacheados; criar medição bloqueado; dia atual vazio com aviso se sem registros), Histórico (AC3: 7 dias; exportar bloqueado), Referências (AC2: só favoritos e customizados; add/remove/busca bloqueados; lista vazia: mensagem específica), Estatísticas (dados 7d cacheados; toggle "Último Mês" com aviso de dados parciais; export bloqueado)
- **Telas totalmente disponíveis offline:** Login (AC11: login padrão + OfflineBanner; primeiro acesso: mensagem específica), Sobre (conteúdo estático — app shell)

## Proposed State — Fase 2

Escrita offline com fila de sincronização: usuário pode criar e excluir registros de consumo offline; operações ficam em fila local (`pendente_sync`); ao retornar online, sincronização com Supabase. Edição offline não está em escopo — para corrigir, o usuário exclui e cria novo. Dependência: Fase 1 implementada.

Comportamento por tela (Fase 2 — delta sobre Fase 1):
- **Dashboard:** criar medição disponível offline — registro entra na fila de sync; indicador visual "pendente de sincronização" por registro
- **Histórico:** excluir registros dos últimos 7 dias (disponíveis no cache) offline — operação entra na fila de sync

## Motivation

- **FACTUAL:** gap documentado (FEAT-0014 "sem offline"); ~3 mil referências no banco mas somente favoritos e customizados do usuário precisam estar offline.
- **VALIDATED:** necessidade real — uso em contextos sem rede (refeições fora, consultas) confirmado como cenário esperado pelo stakeholder.

## Evidence

FEAT-0014 (spec); U-5.2; `referencias_favoritas` (banco existente, FEAT-0008); Fase 5 (PWA).

## Scope

### Fase 1 — Somente leitura

- Adicionar `vite-plugin-pwa` + Workbox ao projeto
- Configurar precaching do app shell
- Verificar compatibilidade com rewrite Vercel `/(.*) → /index.html` e escopo do SW
- `useOnlineStatus` hook (navigator.onLine + eventos online/offline + ping múltiplo + detecção iOS + despacho de re-sync)
- **Cache offline de favoritos** (IndexedDB, store `favoritos`, prefixado por `user_id`)
- **Cache offline de alimentos customizados** (IndexedDB, store `customizadas`, prefixado por `user_id`) — referências criadas pelo usuário; disponíveis offline para consulta e, na Fase 2, para associação em novos registros
- **Cache offline de histórico** (IndexedDB, store `historico`, prefixado por `user_id`) — últimos 7 dias
- **Cache offline de perfil** (IndexedDB, store `perfil`, prefixado por `user_id`) — nome, e-mail, limite diário; usado para exibição somente leitura offline
- Estratégia network-first com fallback para IndexedDB para endpoints de dados
- `OfflineBanner` — componente fixo no topo visível em todas as páginas quando offline
- Informativos contextuais por tela (funcionalidade indisponível ou parcial)
- **Responsabilidade SW vs app layer:** SW gerencia apenas o app shell (precaching Workbox); detecção de offline, gerenciamento do IndexedDB e sync são realizados no app layer (hooks/services React) — sem interceptação de requests de API pelo SW
- **Schema IndexedDB — Fase 1:** quatro stores — `favoritos`, `customizadas`, `historico`, `perfil`; chaves prefixadas por `user_id`; sem limite explícito de tamanho; expiração por substituição na sync online; limpeza completa no logout
- **Verificação de conectividade múltipla (pings):** ao detectar evento `online`, executar 2–3 pings em intervalo curto (≤3s) antes de declarar estado online — evitar false positive por captive portal (Wi-Fi de hospital/restaurante sem autenticação) ou instabilidade momentânea; somente após confirmação, iniciar re-sync
- **Re-sync proativo:** ao confirmar online via pings, re-fetchar e atualizar todas as stores IndexedDB (favoritos + customizados + histórico + perfil); `OfflineBanner` transiciona para estado "sincronizando" durante o re-sync ("Conexão restaurada. Atualizando dados...")
- **Sincronização atômica (all or nothing):** qualquer falha no re-sync interrompe o processo e mantém estado offline; `OfflineBanner` exibe erro de sync ("Erro ao sincronizar. Tentaremos novamente em breve."); retry automático ao restabelecer conexão; dados locais NÃO são removidos antes de confirmar que o upload concluiu (relevante na Fase 2 — na Fase 1, dados são somente recebidos do servidor)
- **Limpeza do IndexedDB — triggers:** (1) logout explícito (botão); (2) expiração silenciosa de sessão via Supabase `onAuthStateChange` listener [CONFIRMED: já existe em `AuthContext.tsx` linha 78 — evento `SIGNED_OUT` → `setAuthUser(null)` → app redireciona para login; AC20 atua como segunda linha de defesa para quando o app está fechado/backgrounded]
- **Limpeza do IndexedDB — delegação:** ao sair de conta delegada e retornar à conta própria, stores prefixadas com `user_id` do usuário delegado são limpas
- **Conta delegada bloqueada offline:** modo offline não disponibiliza acesso a conta delegada — ao tentar acessar, exibir: "Acesso delegado indisponível offline. Conecte-se para acessar a conta de outra pessoa."; offline prioriza registro confiável da dieta PKU do próprio usuário
- **Perfil offline — somente leitura + painel de dados:** tela de Perfil exibe dados do cache local (nome, e-mail, limite diário) em modo leitura; botões de editar, exportar, excluir conta e ações de delegação desabilitados com informativo; **painel "Dados armazenados neste dispositivo"** exibe contagem por store (favoritos: N itens, customizados: N itens, histórico: N registros, período: DD/MM–DD/MM, sincronizado em: [data/hora]); Fase 2: painel inclui N operações pendentes de sync + botão [Tentar sincronizar agora] (habilitado apenas quando online)
- **Favoritos bloqueados offline (add/remove):** no modo offline, botões de adicionar/remover favorito desabilitados com informativo — offline só expõe referências favoritas, adicionar/remover não faz sentido sem acesso à lista completa
- **Referências — sem favoritos offline:** ao abrir Referências offline com listas de favoritos e customizados vazias → exibir: "Você está offline e não possui alimentos favoritos salvos. Adicione favoritos online para acessá-los sem conexão."
- **Dashboard offline — dia atual sem registros:** se não houver registros do dia atual no cache, exibir o dia com valores vazios/zerados e aviso "Nenhum registro encontrado para hoje no modo offline." — não exibir o dia anterior como se fosse hoje
- **Verificação de sessão ao abrir o app:** ao inicializar, checar validade da sessão antes de exibir dados offline; sessão inválida → redirecionar para login com aviso
- **Sessão expirada ao retornar online:** ao retornar online com sessão expirada → apagar dados locais → redirecionar para login com aviso: "Sua sessão expirou enquanto você estava offline. Faça login novamente. Atenção: dados não sincronizados foram perdidos." (relevante na Fase 2)
- **Cópia local sempre atualizada:** toda atividade do usuário enquanto online (add/remove favoritos, criação de referências customizadas, acesso a registros) atualiza o cache local imediatamente — o IndexedDB reflete o estado mais recente para aquele usuário/dispositivo
- **Consistência multi-dispositivo — comunicação explícita:** o cache offline é local ao dispositivo; trocar de dispositivo não garante acesso aos mesmos dados offline; aviso exibido no modo offline reforça que dados são do último estado sincronizado NESTE dispositivo
- **Comunicação proativa para usuários iOS (online):** ao detectar iOS e usuário estar online, exibir informativo discreto (por sessão, em local a definir na implementação — ex.: banner inicial único ou seção no Perfil): "Em iPhones e iPads, o acesso offline não está disponível no momento."
- **Detecção de iOS offline:** `useOnlineStatus` detecta iOS (via user agent) — ao perder conexão em iOS, `OfflineBanner` exibe informativo específico em vez da experiência offline normal; dados cacheados não são exibidos no iOS
- **Primeiro acesso offline — mensagem específica:** ao abrir app pela primeira vez sem internet (sem dados locais), exibir mensagem específica na tela de login: "Você está offline. Faça o primeiro acesso online para habilitar as funcionalidades offline." (em substituição ao OfflineBanner padrão)
- **Sincronização de favoritos e customizados:** stores `favoritos` e `customizadas` atualizadas em dois momentos: (1) fetch bem-sucedido na página de Referências (substituição completa); (2) imediatamente após add/remove/criar referência customizada (atualização incremental)
- **Atualização do SW pós-deploy (forced update — ambas as fases):** decisão tomada (3ª curadoria, GAP-forced-update resolvido). Ambas as fases usam update forçado controlado pelo app layer (não `autoUpdate` automático). Fluxo: (1) SW em espera detectado → app verifica `pendente_sync`; (2) sem pendentes → `messageSkipWaiting()` imediato → página recarrega; (3) com pendentes + online → sync silencioso primeiro; se sync OK → `messageSkipWaiting()`; se sync falha → `UpdateBanner` exibe erro ("Não foi possível sincronizar os dados antes de atualizar. Dados offline mantidos."); update aguarda próxima oportunidade; (4) offline → update aguarda (SW não consegue buscar novo `sw.js` sem rede — comportamento padrão do browser); (5) próxima sessão online com update aguardando → sync → se OK: atualização aplicada. **Pendência:** schema `pendente_sync` deve ser declarado estável entre versões (sem breaking changes) para evitar perda de ops pendentes em caso de incompatibilidade — ver GAP-sync-schema-stability
- **Vercel + SW — configuração de headers:** adicionar regra no `vercel.json` para `/sw.js`: `Cache-Control: no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /` — sem isso, Vercel pode cachear o SW com TTL longo; o rewrite `/(.*) → /index.html` não afeta o SW (Vercel serve arquivos reais antes de aplicar rewrites)

### Fase 2 — Escrita offline (dependência: Fase 1 implementada + AC1–AC21 passing)

- **Schema IndexedDB — Fase 2:** store adicional `pendente_sync`; cada entrada contém: operação (criar/excluir), entidade (registro de consumo), payload completo, `client_uuid` (UUID gerado client-side antes de enviar — usado como idempotency key para prevenir duplicatas em caso de confirmação perdida mid-sync), timestamp da operação offline, número de tentativas de sync. **Formato imutável:** schema `pendente_sync` declarado estável entre versões do app — sem breaking changes; mudanças futuras requerem migração explícita com versionamento da store antes de qualquer forced update (4ª curadoria — GAP-sync-schema-stability e GAP-sync-idempotency resolvidos)
- **Criação offline de registros:** usuário pode registrar consumo de fenilalanina offline usando favoritos ou customizados do cache; registro entra na store `pendente_sync` com indicador visual "pendente de sincronização" na UI
- **Exclusão offline de registros:** exclusão de registros dos últimos 7 dias disponível offline; operação entra na `pendente_sync`
- **Auth para sync no app layer:** ao voltar online, sync usa a sessão do usuário no app layer (sem JWT handling no SW); se sessão inválida ao tentar sync, redirecionar para login com aviso de perda
- **Sincronização atômica da fila de pendentes:** ao voltar online, processar `pendente_sync` — qualquer falha interrompe e mantém estado offline; dados NÃO são removidos da fila antes de confirmar recebimento do servidor; retry automático
- **Conflito com referência arquivada:** ao sincronizar registro criado offline que usa referência arquivada no servidor → esse registro é descartado automaticamente; demais registros da fila continuam sendo processados. Mecanismo: `fn_upsert_consumo_offline` (SECURITY DEFINER) verifica internamente se o alimento está ativo; se arquivado, rejeita o INSERT, insere notificação em `notificacoes` como sistema (sem INSERT direto pelo client) e retorna `{status: 'archived_ref'}` ao handler de sync, que remove a entrada da `pendente_sync`. Notificação: `type: system_event`, corpo: "[Nome do alimento] não pôde ser sincronizado — o alimento não está mais disponível. Você pode registrar novamente usando outro alimento." Sem fluxo de correção inline. (4ª curadoria — GAP-archived-ref resolvido; 5ª curadoria — GAP-feat0018-write-access resolvido)
- **RPC `fn_upsert_consumo_offline` — design de segurança (GAP-feat0018-write-access resolvido — 5ª curadoria):** a notificação de archived-ref é emitida pelo sistema, não pelo client — modelo: notificação originada pelo sistema, usuário é destinatário. Assinatura: `fn_upsert_consumo_offline(p_client_uuid UUID, p_alimento_id UUID, p_quantidade NUMERIC, p_data_registro DATE, p_hora_registro TIME) RETURNS JSONB`. Propriedades: (1) `user_id` derivado exclusivamente de `auth.uid()` dentro do SECURITY DEFINER — não é parâmetro; (2) conteúdo da notificação fixo — nenhum campo livre aceito pelo client; (3) alimento verificado contra o banco na mesma operação — client não pode declarar rejeição sem que ela exista; (4) idempotência dupla: `client_uuid` único em `registros` (para o registro) + EXISTS check em `notificacoes` por `(user_id, type, content->>'client_uuid')` (para a notificação) — ENH-0001 adiciona coluna `content JSONB` (nullable) à tabela `notificacoes` via migration para habilitar esse check (análise de coerência pré-implementação, 2026-10-09); (5) policy `notificacoes_insert_admin_only` **inalterada** — INSERT ocorre via SECURITY DEFINER, não por usuário diretamente; (6) retorno estruturado: `{status: 'ok', registro_id}` | `{status: 'archived_ref', client_uuid}` | `{status: 'error', code}`.
- **Indicadores de estado de sync por registro:** "pendente de sync" → "sincronizando" → "sincronizado"; registros rejeitados por referência arquivada são descartados automaticamente sem estado de erro na UI — usuário é notificado via FEAT-0018
- **Logout com dados pendentes:** fluxo completo definido (ver GAP-logout-pending): (1) verificar `pendente_sync` antes de executar o logout; (2) se há dados pendentes e usuário está online → tentar sync silencioso; se sync OK → logout normal sem aviso; se sync falha ou usuário está offline → exibir aviso; (3) diálogo: "Você possui [N] registro(s) não sincronizado(s). Ao sair, esses dados serão perdidos permanentemente. Deseja continuar?" + [Cancelar] / [Sair mesmo assim]; (4) confirmação → limpeza imediata de todos os stores + `supabase.auth.signOut()`. Sem prazo/countdown — decisão imediata ao confirmar.

## Out of Scope

- Cache de toda a tabela de referências (~3 mil itens) — excluído por volume; somente favoritos e customizados do usuário ficam offline
- Suporte offline no iOS Safari — excluído; usuário iOS que perde conexão recebe informativo específico; app funciona normalmente online em qualquer iOS; comunicação proativa ao usuário iOS quando online (AC16)
- Conflict resolution entre dispositivos (usuário edita o mesmo registro em dois devices offline e sincroniza) — fora de escopo em ambas as fases; cópia offline é por dispositivo; servidor é a fonte de verdade
- **Edição offline de registros de consumo** — para corrigir um registro, o usuário exclui e cria novo; escrita offline cobre apenas criação e exclusão (Fase 2)
- Offline write para entidades além de registros de consumo (ex.: exames PKU, dados de perfil, configurações, favoritos) — escrita offline limitada a registros de consumo (Fase 2)
- Acesso offline à conta delegada — offline prioriza registro confiável da dieta PKU do próprio usuário
- Resolução automática de conflitos de dados do tipo "mesmo dia em dois dispositivos" — usuário deve resolver manualmente ao retornar online

## Impacted Features

- [FEAT-0014 PWA](../../current/features/FEAT-0014-pwa.md)
- [FEAT-0008 Referências alimentares](../../current/features/FEAT-0008-referencias-alimentares.md) (favoritos e customizados)
- [FEAT-0011 Delegação de acesso](../../current/features/FEAT-0011-delegacao-acesso.md) (bloqueio offline + limpeza ao sair da conta delegada — AC13)
- [FEAT-0018 Central de Notificações](../features/FEAT-0018-central-notificacoes.md) — canal de notificação para rejeição de registro arquivado (AC27, `type: system_event`); ✅ em produção (v1.20.0, 2026-10-09) — GAP-feat0018-prod resolvido

## Impacted Frontend

- `vite.config.ts` — adicionar `@vite-pwa/vite-plugin-pwa`
- `public/` — manifest, SW gerado
- Novo hook: `useOnlineStatus` (navigator.onLine + eventos online/offline + ping múltiplo de conectividade + detecção iOS + dispatch de re-sync proativo + verificação de sessão)
- Novo serviço: `offlineStorage.service.ts` — gerencia IndexedDB (stores: `favoritos`, `customizadas`, `historico`, `perfil`; Fase 2: `pendente_sync`)
- Novo componente: `OfflineBanner` — quatro estados: offline ("Você está offline. Exibindo dados armazenados localmente."), sincronizando ("Conexão restaurada. Atualizando dados..."), erro de sync ("Erro ao sincronizar. Tentaremos novamente em breve."), iOS offline ("Acesso offline não disponível no iOS. Reconecte-se para continuar.")
- Novo componente: `UpdateBanner` — exibido quando online com novo SW em espera + sync pendente; dois estados: sincronizando ("Há uma atualização disponível. Sincronizando dados antes de atualizar...") e erro ("Não foi possível sincronizar os dados antes de atualizar. Dados offline mantidos. Tente novamente ou reinicie o app quando possível.")
- Modificações por tela: avisos contextuais; Perfil — modo somente leitura offline + painel de dados (AC28); Referências — add/remove bloqueados offline; Dashboard — Fase 2: criar medição offline com indicador
- `vercel.json` — regra de header para `/sw.js`

## Impacted Tests

- NONE hoje (FEAT-0014) — testes necessários:

**Unitários — `useOnlineStatus`:**
- Estado inicial correto (`navigator.onLine`)
- Transição offline → online e online → offline via evento
- Detecção de iOS (user agent)
- Ping múltiplo executado após evento `online`; falha mantém estado offline; sucesso dispara re-sync
- Verificação de sessão ao inicializar
- Detecção de primeiro acesso (sem dados locais)

**Componente — `OfflineBanner`:**
- Não renderiza quando online
- Estado offline: texto e visibilidade corretos
- Estado sincronizando: texto de feedback
- Estado erro de sync: texto de erro
- Estado iOS offline: mensagem específica de iOS

**Unitários — Serviço IndexedDB (via `fake-indexeddb`):**
- Escrita de favoritos: substituição completa por user_id
- Escrita de customizados: substituição completa por user_id
- Escrita de perfil: substituição por user_id
- Leitura de favoritos quando offline
- Leitura de customizados quando offline
- Leitura de perfil quando offline
- Atualização incremental após add/remove de favorito ou criação de customizado
- Escrita de histórico: substituição dos últimos 7 dias
- Limpeza completa de stores por user_id no logout
- Limpeza de stores do usuário delegado ao sair da delegação
- Isolamento: stores de user A não afetam stores de user B
- Fase 2: escrita na store `pendente_sync`; leitura da fila; processamento atômico; rollback em falha

**Componente — Telas com comportamento offline:**
- Referências: exibe apenas favoritos e customizados + aviso; add/remove bloqueados; lista vazia: mensagem específica
- Histórico: exibe últimos 7 dias + aviso; export bloqueado
- Estatísticas: dados 7d com aviso no toggle "Último Mês"; export bloqueado
- Exames: informativo "indisponível offline" exibido
- Perfil: dados exibidos em modo leitura; ações bloqueadas
- Dashboard: dados cacheados exibidos; dia atual vazio com aviso se sem registros; criar medição bloqueada (Fase 1) / disponível com indicador de pendência (Fase 2)
- Dashboard: dia sem registros exibe valores zerados + aviso específico (não exibe dia anterior)
- Login: primeiro acesso offline exibe mensagem específica (não OfflineBanner padrão)

**Validação manual (não automatizável via vitest):**
- AC1: app abre offline a partir do segundo carregamento (requer SW real no browser)
- AC10: comportamento de atualização do SW após novo deploy (requer ciclo de deploy; decisão sobre forced update em aberto)
- AC14: headers do `/sw.js` no Vercel (requer ambiente deployado)
- AC15: comportamento iOS offline em dispositivo real
- AC16: comunicação proativa iOS online em dispositivo real

## Dependencies

- `vite-plugin-pwa` (nova dependência de dev)
- Workbox (transitiva via plugin)
- `fake-indexeddb` (nova dependência de dev — testes unitários do serviço IndexedDB)
- **FEAT-0018 (Central de Notificações)** — ✅ em produção (v1.20.0, 2026-10-09); tabela `notificacoes` disponível; escrita de notificações de archived-ref via `fn_upsert_consumo_offline` SECURITY DEFINER (GAP-feat0018-prod e GAP-feat0018-write-access resolvidos — 5ª curadoria)

## Comunicações ao Usuário — Canal FEAT-0018

> 4ª curadoria: FEAT-0018 (Central de Notificações) é o canal oficial para comunicações assíncronas ao usuário nesta spec.

| Comunicação | Canal | Fase | Tipo FEAT-0018 | Condição |
|---|---|---|---|---|
| Rejeição de registro por referência arquivada (AC27) | FEAT-0018 via `fn_upsert_consumo_offline` (SECURITY DEFINER) | Fase 2 | `system_event` | ✅ FEAT-0018 em prod (v1.20.0); escrita via SECURITY DEFINER — policy `notificacoes_insert_admin_only` inalterada (GAP-feat0018-prod e GAP-feat0018-write-access resolvidos) |
| `OfflineBanner` — offline / sincronizando / erro / iOS | Inline (componente de estado) | Fase 1 | N/A — estado em tempo real | — |
| `UpdateBanner` — update aguardando | Inline (componente de estado) | Ambas | N/A — estado em tempo real | — |
| Primeiro acesso offline | Inline (tela de login) | Fase 1 | N/A — usuário não autenticado | — |
| Sessão expirada ao retornar online | Inline (redirect + aviso) | Fase 1 | N/A — usuário já desautenticado | — |
| Logout com dados pendentes | Dialog síncrono (inline) | Fase 2 | N/A — confirmação síncrona | — |

**Análise de viabilidade da notificação de archived-ref via FEAT-0018:**
- **Timing:** rejeição detectada durante sync, que ocorre exclusivamente quando online + autenticado → FEAT-0018 disponível no momento da notificação ✓
- **Payload:** `title` (≤ 255 chars) + `body` (≤ 255 chars) — texto curto, sem restrições ✓
- **Persistência:** notificação persiste até 30 dias na tabela `notificacoes` — usuário vê no badge ao abrir o app mesmo após fechar ✓
- **Agrupamento:** se múltiplos registros rejeitados na mesma sessão de sync, pode-se criar uma notificação por rejeição ou uma sumarizando — a definir na implementação
- **Mecanismo de escrita:** notificação emitida internamente pela RPC `fn_upsert_consumo_offline` (SECURITY DEFINER) — o client não chama `notificacoes.insert()` diretamente; sistema é o autor, usuário é o destinatário; policy `notificacoes_insert_admin_only` inalterada (GAP-feat0018-write-access resolvido — 5ª curadoria; ver Scope — Fase 2)
- **Fallback:** se FEAT-0018 não estiver em prod, op é descartada silenciosamente sem notificação

## Risks

- **Cache stale de dados clínicos**: network-first mitiga; avisos ao usuário garantem clareza
- **iOS Safari**: suporte offline excluído — ao perder conexão no iOS, `OfflineBanner` exibe informativo específico; comunicação proativa ao usuário iOS online adicionada (AC16)
- **Invalidação no logout**: dados de usuário no IndexedDB limpos ao sair da conta; Fase 2: logout com dados pendentes exibe aviso ao usuário (AC26)
- **Vercel rewrite vs. escopo do SW (U-5.2)**: rewrite não afeta o SW; risco real é Cache-Control do `/sw.js` — mitigado com regra de header `no-cache` em `vercel.json` (AC14)
- **Atualização do SW pós-deploy**: implicações analisadas (ver GAP-forced-update); Fase 1 usa prompt; Fase 2 requer migração IndexedDB antes de forced update
- **Login offline sem sessão prévia**: mitigado — AC11 + mensagem específica para primeiro acesso (AC11)
- **Re-sync em dados móveis**: volume PKU confirmado como negligível (máx. ~74 KB em uso pesado — fórmula em GAP-volume); risco descartado
- **Sync parcial (Fase 2)**: mitigado — sincronização atômica (all or nothing); sem sync parcial; retry automático; dados locais preservados até confirmação do servidor
- **Conflito com referência arquivada (Fase 2)**: viabilidade confirmada via RLS policy existente; UX simplificada: auto-discard + notificação via FEAT-0018; sem fluxo de correção inline; dependência de FEAT-0018 em prod para notificação
- **Sessão expirada offline**: mitigado com duas linhas de defesa: `onAuthStateChange` [CONFIRMED: `AuthContext.tsx` linha 78] + verificação ao abrir app (AC20)
- **Listener Supabase onAuthStateChange**: [CONFIRMED] — já existe em `AuthContext.tsx` linha 78; gap encerrado

## Alternatives

- A — service worker com cache estático apenas (app shell)
- B — cache estático + dados de leitura limitados (favoritos + 7d histórico) ← base da Fase 1
- C — manter status quo
- D — cache leitura + escrita offline com sync queue ← Fase 2

**Decision:** Alternativa B como Fase 1 + Alternativa D como Fase 2, implementadas sequencialmente nesta spec.

## Análise de Feasibility — Escrita Offline (Fase 2)

> Esta seção documenta a análise de viabilidade original. Fase 2 está agora **em escopo** — ver seção Scope para decisões implementadas.

**Background Sync API:**
- Chrome/Edge: suportado ✅ | Firefox: não suportado ✗ | iOS Safari: limitado (sem background real) ✗
- Alternativa adotada: sync no app layer ao detectar evento `online` (usuário precisa abrir o app); sem dependência da Background Sync API

**Complexidade:**
- IndexedDB para queue de operações pendentes (store `pendente_sync`) — UUID local gerado client-side antes de enviar ao Supabase
- Auth handling no app layer (sem JWT no SW — decisão Fase 1 mantida)
- Conflict resolution limitada: registros criados offline podem conflitar com referências arquivadas (auto-discard + notificação FEAT-0018) ou com criações/exclusões do mesmo dia em outro device (fora de escopo)
- Total de Phe calculado localmente com favoritos/customizados pode divergir do total real se dados mudaram no servidor — usuário deve ser informado ao sync
- UI: cada operação pendente de sync exibe indicador de estado

**Custo:** estimativa de ~2× o escopo da Fase 1 — incluído nesta spec com implementação sequencial.

## Análise de Viabilidade — Sync Atômico (Fase 2)

> Análise realizada na 3ª curadoria (2026-10-05). Documenta a abordagem técnica viável para o sync "tudo ou nada" definido em AC6 e AC25.

### Restrição técnica fundamental

O cliente `@supabase/supabase-js@^2.87.1` (confirmado em `package.json`) não suporta transações multi-statement nativas. Cada chamada (`.insert()`, `.update()`, `.delete()`) é uma operação independente ao banco de dados.

### Opções avaliadas

| Opção | Descrição | Prós | Contras |
|---|---|---|---|
| **A — Sequential client sync (selecionada)** | Processar ops sequencialmente no app layer; erros de rede interrompem tudo; erros de aplicação (archived-ref) marcam a op e continuam as demais | Sem novos objetos DB; usa padrões existentes (`.rpc()` e chamadas diretas); compatível com partial processing de archived-ref | Não é transação DB; crash mid-sync pode deixar fila inconsistente (mitigado — ver abaixo) |
| **B — RPC PostgreSQL** | `fn_sync_registros_offline(ops jsonb[])` em transação única | Atomicidade DB real | Incompatível com "archived-ref não bloqueia outros" sem SAVEPOINTs por op; HIGH RISK (novo schema object — CLAUDE.md §7); maior complexidade |

### Abordagem selecionada: Sequential client sync (Opção A)

O handler de sync no app layer processa cada operação da fila individualmente:

```
for op in pendente_sync (ordem por timestamp):
  result = await supabaseOp(op)   // .insert(), .update(), .delete()

  if isNetworkError(result):
    stopAll()                      // fila preservada, retry automático
    throw NetworkError

  if isArchivedRefError(result):         // RPC retornou {status: 'archived_ref'}
    removeFromQueue(op)                  // descartado automaticamente
    // notificação já emitida pela RPC (SECURITY DEFINER) internamente
    continue

  if isSuccess(result):
    removeFromQueue(op)            // removida APENAS após confirmação do servidor
```

*(4ª curadoria: `updateRegistro()` não é necessário — edição offline fora de escopo; GAP-sync-update-service removido.)*

### Semântica de "sync atômico" nesta spec

| Cenário | Comportamento | Garantia |
|---|---|---|
| Erro de rede/servidor (5xx, timeout) | Stop all + retry automático | All-or-nothing (perspectiva de rede) |
| Referência arquivada (RLS reject) | Op descartada automaticamente; notificação via FEAT-0018; demais continuam | Auto-discard + notificação (por design de UX — 4ª curadoria) |
| Crash do cliente mid-sync | IndexedDB preservado (durável por natureza); ops já enviadas com sucesso não retornam | Sem perda de dados locais; possível reprocessamento |
| Sucesso total | Fila limpa; `OfflineBanner` removido | Estado consistente |

**"Atômico" nesta spec = all-or-nothing para falhas de rede, não transação de banco de dados.** Isso é consistente com a decisão de partial processing para archived-ref.

### Gaps identificados nesta análise — status atualizado (4ª curadoria)

- ~~**GAP-sync-update-service:**~~ **REMOVIDO** — edição offline fora de escopo desta spec; `updateRegistro()` não é necessário (4ª curadoria).
- **GAP-sync-idempotency:** **RESOLVIDO (4ª curadoria)** — UUID client-side (`client_uuid`) adotado como idempotency key; incluído no schema `pendente_sync` e enviado no payload do INSERT ao Supabase para prevenir duplicatas de CREATE em caso de perda de confirmação mid-sync.
- **GAP-sync-schema-stability:** **RESOLVIDO (4ª curadoria)** — opção (a) adotada: schema `pendente_sync` declarado imutável entre versões do app; sem breaking changes permitidos; mudanças futuras exigem migração explícita com versionamento da store antes de qualquer forced update.

## Open Questions

Resolvidas pela análise:

| Questão | Resolução |
|---|---|
| Quais dados podem ser cacheados sem risco? | App shell + favoritos + customizados + 7 dias de histórico + perfil (leitura) — sem risco clínico; avisos de dados parciais no UI |
| Necessidade real de offline para o público? | Confirmada — uso em campo sem rede é cenário esperado |
| Escrita offline é viável? | Sim — incluída nesta spec como Fase 2; ~2× o custo da Fase 1 |
| Date range dos registros offline? | 7 dias, com aviso claro ao usuário sobre a limitação |

**Resolvidas no refinamento:**

| Questão | Resolução |
|---|---|
| Schema do IndexedDB | Fase 1: quatro stores — `favoritos`, `customizadas`, `historico`, `perfil`; chaves prefixadas por `user_id`; sem limite de tamanho; limpeza completa no logout. Fase 2: store adicional `pendente_sync` |
| Política de expiração dos 7 dias | Na sync online: IndexedDB substituído com os últimos 7 dias recém-buscados — sem lógica extra de data |
| Comportamento offline sem sessão | Tela de login padrão com `OfflineBanner`; primeiro acesso: mensagem específica "Você está offline. Faça o primeiro acesso online para habilitar as funcionalidades offline." |
| Limites de armazenamento IndexedDB | Sem limite explícito — volume PKU não representa risco de quota; estimativa de volume pendente (ver GAP-volume) |
| Mapeamento de telas × comportamento offline | Ver seção "Comportamento Offline por Tela" — 9 telas + conta delegada mapeadas |
| Sincronização de favoritos no IndexedDB | Fetch bem-sucedido na página de Referências (substituição completa) + add/remove/criar imediato (atualização incremental) |
| Vercel rewrite vs. escopo do SW (U-5.2) | Rewrite não afeta o SW; risco real é Cache-Control do `/sw.js` — mitigado com regra de header no `vercel.json` (AC14) |
| iOS Safari — postura offline | Excluído do escopo offline; informativo específico ao perder conexão no iOS (AC15); comunicação proativa ao usuário iOS online (AC16) |
| Falha parcial de re-sync | Sincronização atômica (all or nothing): qualquer falha reverte ao offline; OfflineBanner exibe erro de sync; retry automático |
| Dashboard offline sem registros do dia atual | Exibir dia atual com valores vazios/zerados + aviso "Nenhum registro encontrado para hoje no modo offline." — não exibir o dia anterior |
| Comunicação proativa iOS | Sim — ao detectar iOS online, exibir informativo discreto (por sessão) sobre ausência de suporte offline (AC16) |
| Sessão expirada ao retornar online | Apagar dados locais → redirecionar para login com aviso: "Sua sessão expirou enquanto você estava offline. Faça login novamente. Atenção: dados não sincronizados foram perdidos." (AC21) |
| Conta delegada offline | Bloqueada — informativo específico; offline prioriza registro da dieta PKU do próprio usuário (AC13) |
| Perfil offline | Somente leitura (nome, e-mail, limite diário a partir de cache); ações bloqueadas (AC17) |
| Favoritos add/remove offline | Bloqueados — offline só expõe referências favoritas; add/remove sem lista completa não faz sentido (AC18) |
| Primeiro acesso offline | Mensagem específica: "Você está offline. Faça o primeiro acesso online para habilitar as funcionalidades offline." (AC11) |
| Sem favoritos offline | Mensagem específica: "Você está offline e não possui alimentos favoritos salvos. Adicione favoritos online para acessá-los sem conexão." (AC2) |
| Ping único vs. múltiplo | Múltiplos pings — 2–3 tentativas em ≤3s antes de declarar online (AC6) |
| Verificação de sessão ao abrir | Sim — verificar validade da sessão ao inicializar o app (AC20) |
| Alimentos customizados offline | Incluídos — store `customizadas` no IndexedDB; disponíveis offline junto com favoritos (AC2) |
| Consistência multi-dispositivo | Cache é local ao dispositivo; trocar de dispositivo não garante mesmos dados offline; comunicação explícita ao usuário no modo offline |
| Cópia local | Sempre atualizada com toda atividade online do usuário |
| Escrita offline (Fase 2) | Incluída nesta spec — criar e excluir registros de consumo offline via fila `pendente_sync` (AC22–AC27); edição offline fora de escopo — AC23 removido na 4ª curadoria |
| Listener Supabase onAuthStateChange (GAP-listener) | [CONFIRMED] Existe em `AuthContext.tsx` linha 78; evento `SIGNED_OUT` → `setAuthUser(null)` → app redireciona para login; AC20 (verificação ao abrir) atua como segunda linha de defesa para quando o app está fechado/backgrounded |
| Volume de armazenamento offline (GAP-volume) | [CONFIRMED] Fórmula: `(N_fav + N_custom) × 230 B + (N_dias × N_reg/dia) × 185 B + 280 B`; máx. ~74 KB (uso pesado); sem risco de quota |
| Duração da sessão Supabase (GAP-session-duration) | [CLARIFICADO] Supabase default sem override no código: access 1h + refresh 7 dias + auto-refresh; sessão sobrevive offline < 7 dias; sessão dos ACs (AC20, AC21) relevante apenas para ausência > 7 dias |
| Logout com dados pendentes — fluxo completo (GAP-logout-pending) | [DEFINIDO] Ver seção Scope — Fase 2; fluxo: sem pendências → logout direto; com pendências + online → sync silencioso → se OK: logout; se falha/offline → dialog com [Cancelar] / [Sair mesmo assim]; sem prazo/countdown |

**Pendentes de refinamento:**

| Questão | Natureza | O que precisa ser decidido |
|---|---|---|
| Conflito com referência arquivada (GAP-archived-ref) | **RESOLVIDO — 4ª curadoria** | **Decisão:** UX simplificada — auto-discard + notificação FEAT-0018; sem fluxo de correção inline. Handler de sync detecta erro de RLS, remove op da fila e insere `system_event` via FEAT-0018: "[Nome] não pôde ser sincronizado — o alimento não está mais disponível. Você pode registrar novamente usando outro alimento." Fila continua normalmente. Sem design visual adicional necessário. |
| Volume real de favoritos e customizados (GAP-volume) | **RESOLVIDO** | **Fórmula:** `(N_fav + N_custom) × 230 B + (N_dias × N_reg_por_dia) × 185 B + 280 B (perfil)`. **Cenários:** leve (~7 KB), médio (~21 KB), pesado (~74 KB). **Sem imagens/blobs** nos registros. **Conclusão:** volume negligível; quota do browser (mín. 50 MB) nunca será atingida — risco descartado |
| Duração da sessão Supabase (GAP-session-duration) | **CLARIFICADO** | **Fato verificado no código:** `createClient` sem opções custom de auth → Supabase defaults: access token 1h + refresh token 7 dias + auto-refresh (renovação automática ~60s antes do vencimento). **Implicação offline:** sessão sobrevive offline < 7 dias (refresh token ainda válido ao voltar online). Sessão expira offline apenas após 7+ dias sem usar o app. **Não verificável sem acesso ao dashboard:** se o JWT expiry foi alterado das defaults. **Decisão:** manter comportamento definido (AC20 + AC21); doc assume defaults do Supabase |
| Logout com dados pendentes — fluxo completo (GAP-logout-pending) | **RESOLVIDO** — fluxo definido na seção Scope | Fluxo completo definido: (1) sem pendências → logout imediato; (2) com pendências + online → tentar sync silencioso → se OK: logout normal; se falha: dialog; (3) com pendências + offline → dialog imediato. Dialog: "Você possui [N] registro(s) não sincronizado(s). Ao sair, esses dados serão perdidos permanentemente." + [Cancelar] / [Sair mesmo assim]. Sem prazo/countdown — decisão imediata. AC26 atualizado. |
| Atualização forçada do SW pós-deploy (GAP-forced-update) | **RESOLVIDO — 3ª curadoria** | **Decisão:** forced update em ambas as fases, controlado pelo app layer; sync silencioso antes de atualizar quando há pendentes; offline = update aguarda; ver AC10 e seção Scope — Fase 1. **Pendência remanescente:** schema `pendente_sync` estável entre versões — ver GAP-sync-schema-stability |
| Painel de dados offline no Perfil (GAP-profile-offline-panel) | **EM ESCOPO — 3ª curadoria** | **Decisão:** incluído no escopo da implementação desde o início (não ideia futura). Painel mostra contagem por store + última sincronização + (Fase 2) pendentes de sync + botão de sync manual. Ver AC28 e seção Scope — Fase 1. |
| Dependência de prod — FEAT-0018 (GAP-feat0018-prod) | **RESOLVIDO — 5ª curadoria (2026-10-09)** | FEAT-0018 em produção com v1.20.0. Tabela `notificacoes` disponível em prod. Dependência de deploy encerrada. |
| Escrita em `notificacoes` — mecanismo (GAP-feat0018-write-access) | **RESOLVIDO — 5ª curadoria** | **Decisão:** notificação de archived-ref emitida internamente por `fn_upsert_consumo_offline` (SECURITY DEFINER) — o client não chama `notificacoes.insert()` diretamente; `user_id` derivado de `auth.uid()` dentro da função; conteúdo fixo (template hardcoded, sem campos livres); idempotência via EXISTS check em `notificacoes` por `(user_id, type, content->>'client_uuid')`; policy `notificacoes_insert_admin_only` **inalterada** — canal é o SECURITY DEFINER, não policy mais permissiva. Modelo: notificação originada pelo sistema, usuário é destinatário (não autor). Ver Scope — Fase 2 para assinatura e propriedades completas da RPC. |

**Pendências em Aberto:**

| Gap/Pendência | Natureza | O que precisa ser decidido/feito |
|---|---|---|
| AC14 — Vercel headers | Implementar na Fase 1 + verificar pós-deploy | `vercel.json` atual sem `Cache-Control` para `/sw.js`; adicionar na implementação da Fase 1; validar em produção após o primeiro deploy |
| AC15, AC16 — iOS | GAP ACEITO — verificação manual futura | Só pode ser validado em dispositivo iOS físico; aceito como gap; não impeditivo para implementação nem para merge |

## Acceptance Criteria

### Fase 1 (AC1–AC21)

- **AC1:** App abre offline (sem rede) a partir do segundo carregamento — app shell servido pelo SW
- **AC2:** Offline: página de referências exibe apenas favoritos e alimentos customizados do usuário, com aviso explícito ("Você está offline. Exibindo apenas seus favoritos e alimentos customizados."); lista vazia → mensagem específica ("Você está offline e não possui alimentos favoritos salvos. Adicione favoritos online para acessá-los sem conexão.")
- **AC3:** Offline: histórico exibe apenas registros dos últimos 7 dias com aviso explícito ("Exibindo registros armazenados localmente dos últimos 7 dias.")
- **AC4:** Offline: barra fixa visível em todas as páginas indicando versão offline
- **AC5:** Offline: funcionalidades somente-online (exportar, add/remove favoritos, ações de perfil, etc.) mostram informativo claro de indisponibilidade
- **AC6:** Ao voltar online: (1) 2–3 pings executados em ≤3s para verificar conectividade real; (2) após confirmação: `OfflineBanner` transiciona para "sincronizando"; (3) re-sync atômico das stores IndexedDB; (4) falha → `OfflineBanner` exibe erro de sync + retry automático; (5) sucesso → `OfflineBanner` e informativos removidos; dados frescos exibidos
- **AC7:** IndexedDB do usuário é limpo em dois triggers: (1) logout explícito; (2) expiração silenciosa de sessão via Supabase `onAuthStateChange`
- **AC8:** Sem regressão na experiência online (performance, atualização de dados, comportamento existente)
- **AC9:** Cobertura de testes automatizados: (1) `useOnlineStatus` — estados, transições, iOS, ping múltiplo, sessão, primeiro acesso; (2) `OfflineBanner` — quatro estados (offline, sincronizando, erro de sync, iOS offline); (3) serviço IndexedDB — escrita/leitura/limpeza por user_id para todas as stores, isolamento entre usuários, atualização incremental; (4) telas com comportamento offline diferenciado
- **AC10:** Ao detectar nova versão do SW disponível: (1) sem pendentes de sync → `messageSkipWaiting()` automático → página recarrega com nova versão; (2) com pendentes + online → sync silencioso antes do update; se OK: update aplicado; se falha: `UpdateBanner` exibe erro e dados offline são mantidos; (3) offline → update aguarda (SW não pode buscar nova versão sem rede); (4) próxima sessão online com update aguardando: sync → se OK: atualização aplicada
- **AC11:** Offline sem sessão prévia (primeiro acesso — sem dados locais): mensagem específica na tela de login: "Você está offline. Faça o primeiro acesso online para habilitar as funcionalidades offline."
- **AC12:** Offline: Estatísticas disponível com dados cacheados (últimos 7 dias); toggle "Última Semana" exibe normalmente; toggle "Último Mês" exibe aviso "Dados incompletos offline — exibindo apenas os últimos 7 dias disponíveis"; exportar CSV/JSON bloqueado com informativo
- **AC13:** Conta delegada: indisponível em modo offline — informativo exibido ao tentar acessar; ao retornar da conta delegada (após sessão online), stores do IndexedDB do usuário delegado são limpas automaticamente
- **AC14:** `vercel.json` configurado com `Cache-Control: no-cache, no-store, must-revalidate` e `Service-Worker-Allowed: /` para `/sw.js`; SW servido como JS e registrado com scope `/`
- **AC15:** iOS offline: ao perder conexão em dispositivo iOS, `OfflineBanner` exibe mensagem específica ("Acesso offline não disponível no iOS. Reconecte-se para continuar."); dados cacheados não são apresentados
- **AC16:** iOS online: ao detectar iOS durante sessão online, informativo discreto exibido (uma vez por sessão) informando que o acesso offline não está disponível em iPhones/iPads
- **AC17:** Perfil offline: dados exibidos em modo somente leitura (nome, e-mail, limite diário a partir do cache); botões de editar, exportar, excluir conta e ações de delegação desabilitados com informativo; painel "Dados armazenados neste dispositivo" visível (AC28)
- **AC18:** Favoritos offline: botões de add/remove favorito desabilitados com informativo no modo offline
- **AC19:** Dashboard offline — dia atual sem registros: dia exibido com valores vazios/zerados e aviso "Nenhum registro encontrado para hoje no modo offline."
- **AC20:** Ao inicializar o app: validade da sessão verificada antes de exibir dados offline; sessão inválida → redirecionar para login com aviso
- **AC21:** Ao retornar online com sessão expirada: dados locais apagados → redirecionar para login com aviso de possível perda de dados não sincronizados

### Fase 2 — AC22–AC28 (dependência: Fase 1 + AC1–AC21 passing)

- **AC22:** Usuário pode criar registro de consumo offline — registro entra na fila de sync com indicador visual "pendente de sincronização"
- *(AC23 removido — edição offline fora de escopo desta spec; para corrigir um registro, o usuário exclui e cria novo — 4ª curadoria)*
- **AC24:** Usuário pode excluir registros dos últimos 7 dias offline — operação entra na fila de sync
- **AC25:** Ao voltar online: fila `pendente_sync` (ops de criar e excluir — edição offline não está em escopo) processada sequencialmente; `client_uuid` enviado como idempotency key em cada CREATE; erros de rede interrompem toda a fila (stop all + retry automático); archived-ref → op descartada automaticamente + notificação FEAT-0018 + fila continua; dados não removidos da fila antes de confirmação do servidor; ao concluir sem erros de rede: `OfflineBanner` e informativos removidos
- **AC26:** Ao fazer logout com dados pendentes: (1) se online → sync silencioso tentado; se OK → logout direto sem aviso; se falha → diálogo; (2) se offline → diálogo imediato. Diálogo: "Você possui [N] registro(s) não sincronizado(s). Ao sair, esses dados serão perdidos permanentemente. Deseja continuar?" + [Cancelar] / [Sair mesmo assim]; sem countdown; ao confirmar: limpeza imediata de todos os stores + `supabase.auth.signOut()`
- **AC27:** Conflito com referência arquivada ao sincronizar: `fn_upsert_consumo_offline` (SECURITY DEFINER) detecta alimento arquivado, rejeita o INSERT, insere notificação FEAT-0018 internamente (`type: system_event`, corpo: "[Nome do alimento] não pôde ser sincronizado — o alimento não está mais disponível. Você pode registrar novamente usando outro alimento.") e retorna `{status: 'archived_ref'}` ao handler de sync, que remove op da `pendente_sync`; demais registros da fila continuam; sem fluxo de correção inline; sem estado de erro na UI para o registro descartado.
- **AC28:** Tela de Perfil offline exibe painel "Dados armazenados neste dispositivo": favoritos (N itens), customizados (N itens), histórico (N registros, período: DD/MM–DD/MM), sincronizado em: [data/hora]. Fase 2: painel inclui N operações pendentes de sync + botão [Tentar sincronizar agora] (habilitado apenas quando online)

## Comportamento Offline por Tela

| Tela | Comportamento offline (Fase 1) | Delta Fase 2 | Informativo contextual |
|---|---|---|---|
| Login (`/`) | Disponível — login padrão + `OfflineBanner`; primeiro acesso: mensagem específica (AC11) | Sem mudança | — |
| Dashboard (`/dashboard`) | Disponível — dados do dia via cache; criar medição bloqueada; dia atual sem registros: vazio com aviso (AC19) | Criar medição disponível offline — entra na fila de sync | "Criar medições requer conexão." (Fase 1) / indicador "pendente de sync" (Fase 2) |
| Histórico (`/historico`) | Disponível parcial — últimos 7 dias; exportar bloqueado (AC3) | Excluir registros dos 7 dias — fila de sync | "Exibindo registros armazenados localmente dos últimos 7 dias." |
| Referências (`/referencias`) | Disponível parcial — só favoritos e customizados; add/remove/busca bloqueados; lista vazia: mensagem específica (AC2, AC18) | Sem mudança | "Você está offline. Exibindo apenas seus favoritos e alimentos customizados." |
| Estatísticas (`/estatisticas`) | Disponível parcial — dados 7d; toggle "Último Mês" com aviso de dados parciais; export bloqueado (AC12) | Sem mudança | "Você está offline. Exibindo dados dos últimos 7 dias. O período 'Último Mês' pode estar incompleto." |
| Exames (`/exames`) | Bloqueada offline | Sem mudança | "Exames PKU indisponíveis offline." |
| Perfil (`/perfil`) | Somente leitura (nome, e-mail, limite diário); painel de dados offline (AC17, AC28); ações bloqueadas | Fase 2: painel inclui N pendentes + [Tentar sincronizar agora] (se online) | "Perfil disponível somente para visualização offline." |
| Admin (`/admin`) | Bloqueada offline | Sem mudança | "Painel administrativo indisponível offline." |
| Sobre (`/sobre`) | Disponível — conteúdo estático (app shell) | Sem mudança | — |
| Conta delegada | Bloqueada offline (AC13) | Sem mudança | "Acesso delegado indisponível offline. Conecte-se para acessar a conta de outra pessoa." |

> **iOS Safari:** ao perder conexão em qualquer tela, o `OfflineBanner` exibe informativo específico de iOS (AC15). Quando online em iOS, informativo proativo discreto exibido uma vez por sessão (AC16). Suporte offline excluído do escopo em iOS em ambas as fases.

## Evidence / References

- `.ai/specs/current/features/FEAT-0014-pwa.md`
- `.ai/specs/current/features/FEAT-0008-referencias-alimentares.md`
- `vercel.json` (rewrite `/(.*) → /index.html`)
- `vite.config.ts` (sem plugin PWA atual)
- `public/manifest.json` (manifest completo)
- `database: referencias_favoritas` (tabela de favoritos existente, FEAT-0008)

## Plano de Implementação (Paralelizado)

> Adicionado na análise de coerência pré-implementação (2026-10-09). Orquestrador: agente principal. Sub-agentes: despachados em paralelo por stream, com arquivos exclusivos para evitar colisão de edição.

### Dependências externas (instalar antes dos streams)

```bash
npm install --save-dev vite-plugin-pwa workbox-window
npm install --save-dev fake-indexeddb
```

> `vite-plugin-pwa` inclui Workbox como transitiva. `fake-indexeddb` é exclusivo para testes unitários do IndexedDB service — não vai para produção.

### Streams da Fase 1 (paralelos entre si)

| Stream | Responsabilidade | Arquivos exclusivos | Pré-requisito |
|---|---|---|---|
| A — infra | PWA config + vercel.json | `vite.config.ts`, `vercel.json` | `vite-plugin-pwa` instalado |
| B — indexeddb | `offlineStorage.service.ts` + testes | `src/react-app/services/offlineStorage.service.ts`, `offlineStorage.service.test.ts` | `fake-indexeddb` instalado |
| C — hook | `useOnlineStatus` + testes | `src/react-app/hooks/useOnlineStatus.ts`, `useOnlineStatus.test.ts` | nenhum |
| D — components | `OfflineBanner` + `UpdateBanner` | `src/react-app/components/OfflineBanner.tsx`, `OfflineBanner.test.tsx`, `UpdateBanner.tsx` | nenhum |

**Stream A — infra:**
Entregável: `vite.config.ts` com `vite-plugin-pwa` configurado (precaching Workbox, scope `/`, SW gerado em `public/sw.js`); `vercel.json` com nova entrada `headers` para `/sw.js`: `Cache-Control: no-cache, no-store, must-revalidate` e `Service-Worker-Allowed: /`.
Validação: `npm run build` verde; arquivo SW gerado no output.

**Stream B — indexeddb:**
Entregável: `offlineStorage.service.ts` com API para 4 stores (`favoritos`, `customizadas`, `historico`, `perfil`) — funções `write(store, userId, data)`, `read(store, userId)`, `clearUser(userId)`, `clearDelegado(userId)`, `clearAll()`; atualização incremental para favoritos/customizadas; `offlineStorage.service.test.ts` cobrindo escrita, leitura, limpeza por `userId`, isolamento entre usuários, atualização incremental.
Validação: `npm run test:run -- offlineStorage` verde.

**Stream C — hook:**
Entregável: `useOnlineStatus.ts` exportando `{ isOnline, isSyncing, syncError, isIos, triggerSync }`; lógica: evento `online/offline` + 2–3 pings HTTP (≤3s) antes de declarar online; detecção iOS via `navigator.userAgent`; verificação de sessão ao inicializar (chamar `supabase.auth.getSession()`); ao confirmar online: chamar `triggerSync` para re-fetch de todas as stores; `useOnlineStatus.test.ts` cobrindo estados, transições, iOS, ping múltiplo, falha de ping mantém offline.
Validação: `npm run test:run -- useOnlineStatus` verde.

**Stream D — components:**
Entregável: `OfflineBanner.tsx` com 4 estados via props `{ isOnline, isSyncing, syncError, isIos }` — sem renderização quando online; `OfflineBanner.test.tsx` cobrindo os 4 estados; `UpdateBanner.tsx` com 2 estados `{ isSyncing, syncError }`.
Validação: `npm run test:run -- OfflineBanner` verde.

### Ponto de sincronização 1 — barreira (A + B + C + D)

Orquestrador aguarda os 4 streams. Depois: `npm run test:run` completo — todos os testes existentes + novos devem passar.

### Stream E — Adaptações de tela (sequencial, após barreira 1)

Agente único. Arquivos exclusivos (não editados por A–D):

- `src/react-app/components/Layout.tsx` — adicionar `<OfflineBanner />` acima de `<LoginAsBanner />` no header sticky; integrar `useOnlineStatus`
- `src/react-app/context/AuthContext.tsx` — integrar `offlineStorage.clearUser(userId)` no `signOut()` e no listener `onAuthStateChange` quando `session` for `null` (AC7)
- `src/react-app/pages/Dashboard.tsx` — informativo + criar medição bloqueado offline (AC19)
- `src/react-app/pages/Historico.tsx` — AC3: 7 dias + aviso; exportar bloqueado
- `src/react-app/pages/Perfil.tsx` — AC17: somente leitura; painel "Dados armazenados" (AC28 Fase 1)
- `src/react-app/pages/Referencias.tsx` — AC2: só favoritos + customizados; add/remove bloqueados (AC18)
- `src/react-app/pages/Estatisticas.tsx` — AC12: dados 7d; aviso no toggle "Último Mês"
- `src/react-app/pages/Exames.tsx` — informativo offline
- `src/react-app/pages/Admin.tsx` — informativo offline
- `src/react-app/pages/Home.tsx` — AC11: primeiro acesso offline (sem dados locais)
- `src/react-app/pages/Sobre.tsx` — sem mudança (conteúdo estático; app shell)

Validação: `npm run test:run` suíte completa verde.

### Validação Fase 1 — critério de pronto

- [ ] `npm run test:run` verde (inclui novos testes de B, C, D e telas de E)
- [ ] `npm run build` verde
- [ ] ACs automatizáveis (AC2–AC13, AC17–AC21) verificados via testes
- [ ] AC14 (`vercel.json`): arquivo revisado; validação completa apenas pós-deploy
- [ ] AC15, AC16 (iOS): gap aceito — validação manual em dispositivo físico

### Fase 2 (inicia após Fase 1 + AC1–AC21 passing)

> ⚠ **HIGH RISK — Migration:** orquestrador para e confirma antes de executar qualquer mudança de schema.

**Migration** — `supabase/migrations/20261009000001_enh0001_fase2_offline_write.sql`:
- `ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS content JSONB`
- `ALTER TABLE registros ADD COLUMN IF NOT EXISTS client_uuid UUID`
- `CREATE UNIQUE INDEX IF NOT EXISTS registros_client_uuid_idx ON registros(client_uuid) WHERE client_uuid IS NOT NULL`
- `CREATE OR REPLACE FUNCTION fn_upsert_consumo_offline(p_client_uuid UUID, p_alimento_id UUID, p_quantidade NUMERIC, p_data_registro DATE, p_hora_registro TIME) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER` — conforme propriedades 1–6 definidas em Scope — Fase 2

**Stream H — Sync engine** (após migration aplicada; arquivos exclusivos):
- `src/react-app/services/offlineStorage.service.ts` (extend: store `pendente_sync`)
- `src/react-app/services/sync.service.ts` (novo: `processarFilaSync()` — sequential client sync, Opção A)
- `src/react-app/services/sync.service.test.ts`

**Stream I — Screens Fase 2** (pode rodar em paralelo com H; arquivos exclusivos):
- `src/react-app/pages/Dashboard.tsx` — criar medição offline + indicador de pendência (AC22)
- `src/react-app/pages/Historico.tsx` — excluir offline (AC24)
- `src/react-app/pages/Perfil.tsx` — painel AC28 Fase 2: N pendentes + botão [Tentar sincronizar agora]
- `src/react-app/hooks/useLogout.ts` + `src/react-app/context/AuthContext.tsx` — AC26: verificar pendente_sync antes de logout

### Ponto de sincronização 2 — barreira (H + I)

`npm run test:run` suíte completa verde.

### Validação Fase 2 — critério de pronto

- [ ] `npm run test:run` verde (inclui sync engine e telas Fase 2)
- [ ] AC22–AC28 verificados via testes e/ou smoke test manual
- [ ] Migration aplicada em ambiente de dev via `npm run supabase:migrations:apply`

### Caminho crítico

```
Instalar deps
→ [A + B + C + D em paralelo]
→ Barreira 1 + npm run test:run
→ Stream E (telas)
→ Validação Fase 1
→ ⚠ Confirmar migration (HIGH RISK)
→ Migration aplicada
→ [H + I em paralelo]
→ Barreira 2 + npm run test:run
→ Validação Fase 2
```

### Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `vite-plugin-pwa` conflita com build | Testar `npm run build` imediatamente após stream A; reverter e investigar se falhar |
| iOS sem suporte a SW | Gap aceito; informativo específico (AC15); nenhuma ação além do texto |
| Migration em tabela em produção | `IF NOT EXISTS` em todas as cláusulas; colunas nullable; sem lock de tabela esperado |
| Crash mid-sync com dados pendentes | IndexedDB durável por natureza; op não removida antes de confirmação do servidor; retry automático |
| Schema `pendente_sync` incompatível após update forçado | Schema declarado estável (GAP-sync-schema-stability resolvido); breaking changes exigem migração explícita |
