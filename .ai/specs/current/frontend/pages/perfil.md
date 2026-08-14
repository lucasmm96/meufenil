# Página Perfil

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/perfil` — `src/react-app/App.tsx:25`

## Propósito

Gestão do perfil do usuário ativo: nome e limite diário, delegações de acesso (concedidas/recebidas), exportação JSON dos dados e exclusão de conta. Em modo delegado, vira página somente-leitura.

## Acesso

- Skeleton se `!ready || loading`; `perfil` de `usePerfil(usuarioAtivoId)` `[CONFIRMED: code — Perfil.tsx:32-34]`.
- **Modo delegado:** `isReadOnly = isDelegado` — campos disabled, botão salvar oculto, cards de delegação read-only, seção "Privacidade e Dados" OCULTA (sem export/delete para delegado) `[CONFIRMED: code — Perfil.tsx:36,239-298]`.

## Estado e dados

- `useAuth()` → `{ authUser, ready, usuarioAtivoId, isDelegado, concedidos, recebidos, carregarDelegacoes, conceder, revogar, assumir }`; `usePerfil(usuarioAtivoId)` → `{ perfil, loading, saving, salvar }` `[CONFIRMED: code]`.
- Estado local: `nome`, `limiteDiario` (bootstrap a partir de `perfil`), `modalOpen` `[CONFIRMED: code — Perfil.tsx:39-51]`.
- `usuarios.service`: `getUsuarioPerfil`, `atualizarUsuarioPerfil`, `getPerfilUsuarioTimezone` `[CONFIRMED: code]`.

## UI

1. **Header:** "Perfil" + subtítulo condicional ("Visualização de perfil via acesso delegado" × "Gerencie suas informações pessoais").
2. **Aviso delegado** (condicional): box âmbar "Você está acessando esta conta por meio de um acesso delegado. As informações estão disponíveis apenas para consulta." `[CONFIRMED: code]`.
3. **Card "Informações Pessoais"** (`User` indigo): form com "Nome" (`required`, disabled se readOnly), "E-mail" (sempre `disabled`, `bg-gray-100`), "Limite diário de fenilalanina (mg)" (`type=number step=0.01`, `required`, disabled se readOnly); botão "Salvar alterações" (indigo, `disabled={saving}`, "Salvando...") visível só se `!isReadOnly` `[CONFIRMED: code]`.
4. **`AcessosConcedidosCard`** — conceder (abre `ModalConcederAcesso`) e revogar; read-only no modo delegado `[CONFIRMED: code]`.
5. **`AcessosRecebidosCard`** — "assumir" perfil; read-only no modo delegado `[CONFIRMED: code]`.
6. **Card "Privacidade e Dados"** (só `!isReadOnly`): botões "Exportar meus dados" e "Excluir minha conta" (borda vermelha) `[CONFIRMED: code]`.

## Fluxos de interação

- **Salvar:** `salvar({nome, limite_diario_mg: Number(limiteDiario)})` → `alert("Perfil atualizado com sucesso!")` `[CONFIRMED: code — Perfil.tsx:60-70]`.
- **Exportar meus dados:** consulta DIRETA ao supabase na página (fora de service — fato): `usuarios.*` + `registros (id, data, peso_g, fenil_mg, created_at, referencias(nome))` → JSON `{ usuario, registros, exportado_em, versao: "1.0" }` → download `meufenil-dados-{YYYY-MM-DD}.json` (Blob + anchor); erro → `alert("Erro ao exportar dados")` `[CONFIRMED: code — Perfil.tsx:72-124]`.
- **Excluir minha conta:** `confirm("Deseja realmente excluir sua conta?")` → `prompt('Digite "EXCLUIR" para confirmar:')` (exige texto exato) → POST fetch `${VITE_SUPABASE_URL}/functions/v1/delete-account` com Bearer → sucesso: `signOut()` + `navigate("/", { replace: true })`; falha: `alert("Erro ao excluir conta")` `[CONFIRMED: code — Perfil.tsx:127-160; edge-function-delete-account.md]`.
- **Delegações:** via AuthContext → edge function (ver [edge-function-delegar-acesso](../../backend/edge-function-delegar-acesso.md)); `carregarDelegacoes()` no mount `[CONFIRMED: code]`.

## Estados de UI

- **Loading:** `LayoutSkeleton` + `PerfilSkeleton` `[CONFIRMED: code]`.
- **Error:** hook loga; sem UI de erro; `perfil` nulo → `return null` `[CONFIRMED: code × ausência]`.
- **Saving:** "Salvando..." + disabled `[CONFIRMED: code]`.
- **Empty (delegações):** textos próprios dos cards ("Você ainda não concedeu acesso a ninguém." / "Nenhum acesso recebido.") `[CONFIRMED: code]`.

## Responsividade

Layout `max-w-3xl mx-auto`; botões `w-full`; cards `p-6` `[CONFIRMED: code]`.

## Acessibilidade

Labels visíveis; sem `aria-*` `[CONFIRMED: ausência]`.

## Testes

`usePerfil.test.ts`, `useLayoutPerfil.test.ts`, `usuarios.service.test.ts`. Página sem teste próprio `[CONFIRMED: test, ausência]`.

## Evidências

- E1 — `src/react-app/pages/Perfil.tsx` completo `[CONFIRMED: code]`
- E2 — `usePerfil.ts`, `usuarios.service.ts` `[CONFIRMED: code]`
- E3 — Fluxo delete-account: `../backend/edge-function-delete-account.md` `[CONFIRMED: code]`

## Veja também

- [login-as](../components/login-as.md) (cards de delegação), [edge-function-delete-account](../../backend/edge-function-delete-account.md), [usuarios](../../database/usuarios.md)
