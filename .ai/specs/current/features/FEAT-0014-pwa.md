# Feature Spec: PWA / multi-dispositivo

**ID:** FEAT-0014
**Tipo:** Current
**Status:** Implementada (instalação + offline somente-leitura Fase 1; Fase 2 pendente — ENH-0001)
**Última verificação:** 2026-10-12 (PR #122 — ENH-0001 Fase 1)

## Purpose

Permitir instalação da aplicação como PWA em dispositivos móveis/desktop, com identidade visual de app (ícones, cor de tema, orientação) e suporte offline somente-leitura (Fase 1).

## Actors

- Usuário (instalação, uso offline)

## Preconditions

- Navegador compatível com PWA (exceto iOS Safari para modo offline — ver AC15/AC16 ENH-0001)

## Main Flow

1. Servidor serve `manifest.json` (`display: standalone`, `orientation: portrait-primary`, tema `#6366f1`, ícones 192/512/maskable, `lang: pt-BR`) `[CONFIRMED: configuration — public/manifest.json]`.
2. `index.html` referencia o manifest, theme-color, apple-touch-icon e metas OG/Twitter `[CONFIRMED: code — index.html]`.
3. Service worker gerado via `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`, `filename: 'sw.js'`) — precaching do app shell `[CONFIRMED: code — vite.config.ts, PR #122]`.
4. `vercel.json` serve `/sw.js` com `Cache-Control: no-cache, no-store, must-revalidate` e header `Service-Worker-Allowed: /` `[CONFIRMED: configuration — vercel.json, PR #122]`.
5. `useOnlineStatus` hook detecta estado online/offline via `navigator.onLine` + eventos `online`/`offline` + 2 pings HEAD a `/favicon.ico` (proteção captive portal) + detecção iOS `[CONFIRMED: code — useOnlineStatus.ts, PR #122]`.
6. `OfflineContext` provê `isOnline`, `isSyncing`, `syncError`, `isIos` para todos os componentes `[CONFIRMED: code — OfflineContext.tsx, PR #122]`.
7. `offlineStorage.service.ts` gerencia IndexedDB (`meufenil-offline` v1) com stores: `favoritos`, `customizadas`, `historico`, `perfil`; chaves prefixadas por `userId` `[CONFIRMED: code — offlineStorage.service.ts, PR #122]`.
8. `OfflineBanner` exibido em todas as páginas quando offline (4 estados: offline, sincronizando, erro de sync, iOS offline) `[CONFIRMED: code — OfflineBanner.tsx, PR #122]`.
9. `UpdateBanner` exibido quando há novo SW aguardando atualização `[CONFIRMED: code — UpdateBanner.tsx, PR #122]`.

## Alternative Flows

- **iOS offline:** `useOnlineStatus` detecta iOS via user agent; ao perder conexão, `OfflineBanner` exibe mensagem específica de iOS; dados cacheados não exibidos no iOS.
- **Primeiro acesso offline:** sem dados locais → mensagem específica na tela de login.
- **Sessão expirada offline:** ao retornar online com sessão inválida → dados locais limpos → redirect para login com aviso.

## Error Flows

- **Falha de sync:** `OfflineBanner` exibe estado de erro; retry automático ao restabelecer conexão.

## Business Rules

- NOT APPLICABLE para instalação (capability de plataforma)
- Offline: dados cacheados são somente-leitura (escritas bloqueadas na Fase 1); avisos contextuais por tela obrigatórios.
- Isolamento por usuário: stores IndexedDB prefixadas por `userId`.
- Limpeza no logout: `clearOfflineUser(userId)` chamado em logout explícito, saída de delegado e expiração de sessão via `onAuthStateChange`.

## Frontend

- [overview](../frontend/overview.md) (seção PWA); assets em `public/` (manifest, ícones, `sw.js` gerado)
- Novo hook: `useOnlineStatus.ts`
- Novo serviço: `offlineStorage.service.ts`
- Novo contexto: `OfflineContext.tsx` + `OfflineProviderWithAuth` em `main.tsx`
- Novos componentes: `OfflineBanner.tsx`, `UpdateBanner.tsx`
- Telas adaptadas: Home, Dashboard, Historico, Estatisticas, Referencias, Perfil, Exames, Admin

## Backend

- N/A (Fase 1 — offline somente-leitura; Fase 2 requererá RPC `fn_upsert_consumo_offline`)

## Database

- IndexedDB local (cliente): `meufenil-offline` v1, stores: `favoritos`, `customizadas`, `historico`, `perfil`

## Security

- N/A (dados locais no dispositivo do usuário; isolamento por `userId`; limpeza no logout)

## Tests

- `useOnlineStatus.test.ts` — 12 testes `[CONFIRMED: code — PR #122]`
- `offlineStorage.service.test.ts` — 15 testes via `fake-indexeddb` `[CONFIRMED: code — PR #122]`
- `OfflineBanner.test.tsx` — 6 testes `[CONFIRMED: code — PR #122]`
- **Coverage status:** Fase 1 coberta por testes unitários; validação manual necessária para AC1, AC14, AC15, AC16

## Dependencies

- `vite-plugin-pwa@0.21.1` (dev dependency) `[CONFIRMED: package.json — PR #122]`
- Workbox (transitiva via plugin)
- `fake-indexeddb` (dev dependency — testes IndexedDB) `[CONFIRMED: package.json — PR #122]`
- Hospedagem Vercel (serving dos assets + header `/sw.js`)

## Related Features

- ENH-0001 Fase 1 (implementada) / Fase 2 (pendente)

## Evidence

- E1 — `public/manifest.json`, `index.html`, `public/icons/` `[CONFIRMED: configuration, filesystem]`
- E2 — Service worker via `vite-plugin-pwa` + Workbox: `vite.config.ts`, `sw.js` (build output) `[CONFIRMED: code — PR #122]`
- E3 — `vercel.json` com headers `/sw.js`: `no-cache` + `Service-Worker-Allowed: /` `[CONFIRMED: configuration — PR #122]`
- E4 — IndexedDB service: `src/react-app/services/offlineStorage.service.ts` `[CONFIRMED: code — PR #122]`
- E5 — Online status: `src/react-app/hooks/useOnlineStatus.ts` `[CONFIRMED: code — PR #122]`
- E6 — Context: `src/react-app/context/OfflineContext.tsx` `[CONFIRMED: code — PR #122]`
- E7 — Componentes: `src/react-app/components/OfflineBanner.tsx`, `UpdateBanner.tsx` `[CONFIRMED: code — PR #122]`
- E8 — Testes: `useOnlineStatus.test.ts` (12), `offlineStorage.service.test.ts` (15), `OfflineBanner.test.tsx` (6) `[CONFIRMED: code — PR #122]`

## Unknowns

- AC15/AC16 (iOS): comportamento iOS Safari só verificável em dispositivo físico — gap aceito `[ASSUMED — ENH-0001 GAP aceito]`
- Fase 2 (offline com escrita): pendente decisão humana — schema/migration/RPC são HIGH RISK (ENH-0001)
