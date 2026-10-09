# FEAT-0018 — Central de Notificações ao Usuário

**Type:** FEAT
**Status:** IMPLEMENTED
**Title:** Central de notificações ao usuário
**Issue:** #116
**Created on:** 2026-10-05

## Problem

O app não possui nenhum mecanismo de comunicação assíncrona com o usuário — eventos relevantes do sistema não chegam de forma estruturada e persistente, apenas via feedback síncrono imediato (`alert()`, estados inline).

## Current State

Nenhum sistema de notificações existe. Feedback ao usuário é estritamente síncrono e efêmero: `alert()` nativo (confirmações, erros) e estados inline de UI (loading/error dentro de páginas). Após a interação encerrar, nenhuma mensagem persiste `[CONFIRMED: code — overview.md, Layout.tsx]`.

- Header (`Layout.tsx:43-78`): sem badge ou ícone de notificações `[CONFIRMED: code]`.
- `lib/logger.ts`: logs apenas no console — sem integração com Sentry ou canal de comunicação ao usuário `[CONFIRMED: code — lib/logger.ts]`.
- Não existe tabela de notificações no banco `[CONFIRMED: ausência]`.
- Supabase Realtime: disponível na stack mas não utilizado atualmente `[CONFIRMED: ausência de subscription no código]`.

Ver: [`frontend/overview.md`](../current/frontend/overview.md), [`architecture/overview.md`](../current/architecture/overview.md).

## Proposed State

Ícone de notificações no header (badge com contador de não lidas), que ao ser clicado abre um painel overlay sem sair da página atual. O feed exibe notificações persistidas por até 30 dias e atualiza o badge em tempo real via Supabase Realtime. Tipos confirmados: eventos do sistema (sync, jobs), mensagens do admin (broadcast ou para usuário específico), alertas de saúde/limite diário e novidades do app. A estrutura é extensível para novos tipos futuros. Push notifications fora do escopo desta spec.

## Motivation

- FACTUAL: não existe canal estruturado de comunicação assíncrona app → usuário `[CONFIRMED: ausência]`.
- FACTUAL: o painel admin (FEAT-0012) e a sincronização de referências (FEAT-0017) já geram eventos de sistema que hoje não chegam ao usuário comum de forma visível.
- ASSUMPTION: usuários podem se beneficiar de notificações assíncronas (ex.: "nova sincronização de referências disponível", "atualização do app", mensagem do administrador) — hipótese não validada com usuários reais.
- ASSUMPTION: o valor da feature depende fortemente do volume e tipos de notificações — se forem raras, a infraestrutura pode não se justificar.

## Evidence

Draft 008 (`proposed/draft/archive/008-notificacoes-do-usuario.md`) — solicitação do usuário em 2026-10-05.

## Scope

- Modelo de dados: tabela `notificacoes` com campos `id`, `user_id`, `type`, `title`, `body`, `read_at`, `created_at`, `expires_at` (retenção de 30 dias); campo `target` para broadcast vs. usuário específico
- UI: ícone de notificações no header com badge de contagem de não lidas; painel overlay que abre ao clicar (sem mudança de rota)
- Real-time: badge atualiza instantaneamente via Supabase Realtime (subscription em `notificacoes` por `user_id`)
- Estados por notificação: não lida, lida (persiste após lida por até 30 dias, então expira)
- Tipos iniciais: `system_event` (sync, jobs), `admin_message` (broadcast ou por usuário), `health_alert` (limite diário), `app_update` (novidades do app)
- Envio pelo admin: via painel admin (FEAT-0012) — broadcast ou para usuário específico; autorização via RPC admin-only ou service_role
- Comportamento login-as: badge e feed exibem notificações do usuário assumido (operação sobre `usuarioAtivoId`)

## Out of Scope

- Conteúdo exato das notificações (triggers específicos, textos) — depende das decisões em aberto
- Push notifications / Web Push API — requer service worker (não implementado; dependência de [ENH-0001](../enhancements/ENH-0001-pwa-offline.md))
- Email ou SMS
- Notificações para usuários não autenticados
- Preferências de notificação por usuário (silenciar tipos específicos) — pode ser evolução futura

## Impacted Features

- [FEAT-0012](../../current/features/FEAT-0012-painel-administrativo.md) — se admin puder enviar notificações a usuários
- [FEAT-0013](../../current/features/FEAT-0013-background-jobs.md) — se background jobs gerarem notificações
- [FEAT-0017](../../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md) — se eventos de sync gerarem notificações

## Impacted Business Rules

N/A — nenhuma BR existente cobre notificações.

## Impacted Architecture

- Nova tabela `notificacoes` com RLS por `user_id`
- Nova dependência de mecanismo de entrega (Supabase Realtime ou polling)
- Possivelmente nova Edge Function (push notifications — fora do escopo imediato)
- Ver [`architecture/overview.md`](../../current/architecture/overview.md)

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** `Layout.tsx` (badge no header), novo componente de feed/painel, novo hook `useNotificacoes`, novo service `notificacoes.service.ts`
- **Backend:** N/A (alternativas A/B) · Edge Function nova (alternativa C)
- **Database:** nova tabela `notificacoes`; RPC de marcar lida/todas-lidas (opcional); migration
- **Security:** RLS `user_id = auth.uid()` (leitura); origem das escritas depende da alternativa — admin via service_role ou trigger
- **Tests:** testes de service, hook e RLS mínimos

## Dependencies

- [ENH-0001](../enhancements/ENH-0001-pwa-offline.md) — service worker (apenas para Alternativa C — push; não bloqueia A/B)

## Risks

- Complexidade pode não se justificar se os casos de uso forem poucos e raros — avaliar antes do investimento.
- Supabase Realtime (Alternativa B) adiciona conexão WebSocket permanente por aba aberta — impacto no limite de conexões do plano.
- Push notifications (Alternativa C) requerem permissão explícita do usuário no browser — taxa de opt-in historicamente baixa.
- Notificações geradas por admin exigem controle cuidadoso de autorização (service_role ou RPC admin-only) para evitar escalada de privilégios.

## Alternatives

- **A — In-app feed simples, fetch on-demand (sem real-time):** tabela `notificacoes` + busca ao abrir o feed / ao carregar o Layout. Polling periódico opcional. Badge atualiza somente no próximo fetch. Menor complexidade; sem conexão persistente.
- **B — In-app feed com Supabase Realtime ✓ (escolhida):** tabela + `supabase.channel(...).on('postgres_changes', ...)` para atualização instantânea do badge. Adiciona WebSocket permanente. Maior responsividade; complexidade moderada.
- **C — Push notifications (Web Push API):** notifica o usuário fora do app. Requer service worker (ENH-0001). Fora do escopo desta spec — pode ser evolução futura.
- **D — Somente toast/banner inline sem persistência:** sem feed, sem tabela. Não atende ao requisito de ponto central de consulta.

**Decision:** ACCEPTED — Approved by: Lucas Martins Menezes · Approved on: 2026-10-05. Alternativa B (in-app feed com Supabase Realtime). Decisões de implementação resolvidas: expiração por background job (processo adicional ao keepalive existente em FEAT-0013); health_alert via trigger no banco; admin UI como nova seção no painel admin existente (FEAT-0012).

## Open Questions

Todas as questões primárias foram respondidas via questionário em 2026-10-05. Questões residuais:

1. **UI do painel admin para envio de mensagens:** o envio de notificações pelo admin será feito diretamente no painel admin existente (FEAT-0012) ou requer uma sub-seção/modal novo? (decisão de design a tomar na implementação)
2. **Expiração automática:** a limpeza de notificações com mais de 30 dias será feita por trigger de banco, background job ou deletada no momento da leitura? (decisão técnica a tomar na implementação)
3. **`health_alert` (limite diário):** este tipo requer lógica de trigger no banco (comparar consumo do dia com `limite_diario_mg`)? Ou é gerado pelo frontend ao detectar o limite? (decisão de implementação)

_Respondidas (2026-10-05):_ tipos de notificação ✓ · real-time ✓ · ponto de acesso ✓ · push notifications ✓ · persistência ✓ · admin como emissor ✓ · login-as ✓

## Post-Deploy Steps

1. Aplicar migration em **produção**: `bash scripts/db/apply-supabase-migrations.sh --env production`
   — migration: `supabase/migrations/20261005000000_feat0018_central_notificacoes.sql`
   — cria tabela `notificacoes`, RLS, RPCs, trigger `fn_health_alert_notificacao` e habilita Realtime via `ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes`
2. Verificar no dashboard Supabase (prod) que `notificacoes` aparece na lista de Realtime.

Issue de rastreamento: #119 — milestone v1.20.0.

## Acceptance Criteria

- [ ] Badge no header exibe contagem de notificações não lidas; atualiza em tempo real via Supabase Realtime
- [ ] Clicar no ícone abre painel overlay sem mudar de rota
- [ ] Feed lista notificações com tipo, título, corpo e timestamp; distingue lidas de não lidas visualmente
- [ ] Marcar como lida persiste o estado; notificação permanece visível no feed por até 30 dias após criação
- [ ] Notificações com `expires_at` ≤ agora não aparecem no feed
- [ ] RLS garante que usuário acessa apenas notificações endereçadas a si (`user_id = auth.uid()`) ou broadcasts
- [ ] Admin pode enviar notificação para usuário específico ou broadcast via painel admin; autorização bloqueada para não-admin
- [ ] Durante login-as, badge e feed exibem notificações do usuário assumido (`usuarioAtivoId`)
- [ ] Tipos `system_event`, `admin_message`, `health_alert`, `app_update` funcionam sem erro
- [ ] Novos tipos podem ser adicionados sem alteração de schema (campo `type` é string livre)

## References

- Draft original: `proposed/draft/archive/008-notificacoes-do-usuario.md`
- [`frontend/overview.md`](../../current/frontend/overview.md) — arquitetura do frontend
- [`architecture/overview.md`](../../current/architecture/overview.md) — camadas e boundaries
- [`security/security-model.md`](../../current/security/security-model.md) — RLS e autorização
- [ENH-0001](../enhancements/ENH-0001-pwa-offline.md) — service worker (dependência para Alternativa C)
