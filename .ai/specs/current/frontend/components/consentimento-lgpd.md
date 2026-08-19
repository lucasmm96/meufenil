# Componente ConsentimentoLGPD

**Última verificação:** 2026-08-15 (commit 0eb2e9b)
**Código:** `src/react-app/components/ConsentimentoLGPD.tsx`

## Propósito e uso

Modal de consentimento LGPD exibido antes do uso da aplicação (no Dashboard) enquanto o usuário não tiver `consentimento_lgpd_em` preenchido. `[CONFIRMED: code — Dashboard.tsx:75: exibido se !usuario.consentimento_lgpd_em]`.

## Props

`{ onAccept: () => void }` — chamado ao aceitar; o PAI persiste (`updateConsentimentoLGPD`) e recarrega `[CONFIRMED: code]`.

## Estado e dados

`isOpen = true` local; `handleAccept` → `onAccept()` + `setIsOpen(false)`; fechado → `return null` `[CONFIRMED: code — ConsentimentoLGPD.tsx:8-17]`.

## UI

- Overlay modal padrão; painel `max-w-2xl max-h-[92vh] overflow-y-auto` `[CONFIRMED: code]`.
- Cabeçalho: ícone `Shield` em caixa verde + título "Consentimento LGPD" `[CONFIRMED: code]`.
- Texto de introdução: "Bem-vindo ao MeuFenil! Para continuar, precisamos do seu consentimento para coletar e processar seus dados conforme a Lei Geral de Proteção de Dados (LGPD)." `[CONFIRMED: code]`.
- Boxes `bg-gray-50` com listas: "Dados coletados:" (Nome e e-mail via Google; Registros de consumo; Referências de alimentos (globais e pessoais); Configurações de perfil (limite diário, timezone)); "Finalidade:" (funcionalidades de controle; estatísticas e relatórios; melhorar a experiência); "Seus direitos:" (acessar todos os dados a qualquer momento; exportar em CSV ou JSON; solicitar exclusão completa; revogar consentimento a qualquer momento) + nota "Seus dados são armazenados de forma segura e nunca serão compartilhados com terceiros sem o seu consentimento explícito. Você pode gerenciar suas preferências na página de Perfil." `[CONFIRMED: code — ConsentimentoLGPD.tsx:34-80]`.
- Botão de aceite: **"Aceitar e Continuar"** (gradiente indigo→purple, `w-full sm:w-auto`) `[CONFIRMED: code — ConsentimentoLGPD.tsx:82-90]`.

## Estados de UI

- **Aberto:** montado apenas quando exibido (Dashboard condiciona a renderização) `[CONFIRMED: code]`.
- **Fechado:** `null` após aceite `[CONFIRMED: code]`.
- **Error:** aceite falho é responsabilidade do PAI (sem UI de erro no componente) `[CONFIRMED: ausência]`.

## Acessibilidade / Responsividade

Modal padrão (bottom-sheet × central); sem `aria-*`/focus trap `[CONFIRMED: ausência]`.

## Testes

Componente: `ConsentimentoLGPD.test.tsx` (2 testes — renderização das seções e aceite fechando o modal) `[CONFIRMED: test]`. Persistência coberta por `dashboard.service.test.ts` (updateConsentimentoLGPD) `[CONFIRMED: test]`.

## Evidências

- E1 — `src/react-app/components/ConsentimentoLGPD.tsx` `[CONFIRMED: code]`
- E2 — Consumidor: `Dashboard.tsx:75` `[CONFIRMED: code]`
- E3 — Persistência: `dashboard.service.updateConsentimentoLGPD` → `usuarios.consentimento_lgpd_em` `[CONFIRMED: code, database — ../database/usuarios.md]`

## Veja também

- [../pages/dashboard.md](../pages/dashboard.md), [../database/usuarios.md](../../database/usuarios.md)
