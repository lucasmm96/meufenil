# Página Exames

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/exames` — `src/react-app/App.tsx:22`

## Propósito

Controle de exames de PKU: cards de resumo (último exame, variação vs. anterior, total), gráfico de histórico (≥2 exames), tabela/cards de histórico com exclusão e modal de registro.

## Acesso

Sem checagem de papel; opera sobre `usuarioAtivoId` `[CONFIRMED: code — Exames.tsx:13-23]`.

## Estado e dados

- `useAuth()` + `useUsuarioAtivo()` + `useExames(usuarioAtivoId)` → `{ exames, timezone, loading, criar, remover }` `[CONFIRMED: code]`.
- Estado local: `showModal`, `dataExame`, `resultadoMgDl`, `submitting` `[CONFIRMED: code]`.
- `exames.service`: `getExamesPKU`, `createExamePKU`, `deleteExamePKU` (erros: `EXAMES_FETCH/CREATE/DELETE_ERROR`) `[CONFIRMED: code]`.
- Cálculos client-side: ordenação por `data_exame`, tendência = último − penúltimo `[CONFIRMED: code — Exames.tsx:82-97]`.

## UI

1. **Header:** título "Exames PKU" + subtítulo + botão "+ Registrar Exame" (gradiente).
2. **Cards de resumo** (condicionais a `exames.length > 0`):
   - "Último Exame" (`Activity` indigo): `{ultimoExame.resultado_mg_dl.toFixed(1)} mg/dL` + data dd/MM/yyyy.
   - "Variação" (se penúltimo existe): `TrendingDown` verde (tendência ≤ 0) × `TrendingUp` laranja (> 0); valor com prefixo "+" quando positivo; "vs exame anterior".
   - "Total de Exames" (`Activity` roxo): `{exames.length}` "registrados".
3. **Gráfico "Histórico de Resultados"** (≥2 exames): Recharts `LineChart` (`resultado_mg_dl`), linha `#6366f1` sólida, tooltip formatter "{valor} mg/dL"/"PKU" `[CONFIRMED: code — Exames.tsx:186-225]`.
4. **Histórico de Exames** — desktop `hidden md:block` tabela: colunas **Data do Exame | Resultado (mg/dL) | Registrado em | Ações** (`Trash2`); resultado em `text-indigo-600`; criado_em formatado "dd/MM/yyyy 'às' HH:mm". Mobile `md:hidden`: cards com os mesmos dados `[CONFIRMED: code]`.
5. **Box informativo** "Sobre o exame PKU" (azul): explica conversão "O valor em mg/dL é calculado dividindo o valor PHE (µmol/L) por 60,6." `[CONFIRMED: code — Exames.tsx:328-340]`.
6. **Modal "Registrar Exame"** (embutido na página): campos "Data do Exame" (`type=date`, default hoje no fuso do usuário via `formatInTimeZone`, `required`) e "Resultado PKU (mg/dL)" (`type=number step=0.1`, placeholder "Ex: 2.5", helper "Valor PHE ÷ 60,6 = PKU em mg/dL", `required`); botões "Cancelar" e "Salvar" (gradiente, `disabled={submitting}`, "Salvando...") `[CONFIRMED: code — Exames.tsx:343-411]`.

## Estados de UI

- **Loading:** `!ready || loading` → `LayoutSkeleton` + `ExamesSkeleton` `[CONFIRMED: code]`.
- **Empty:** `Activity` cinza + "Nenhum exame registrado ainda" + botão "Registrar primeiro exame" `[CONFIRMED: code — Exames.tsx:234-244]`.
- **Error:** hook loga; sem UI de erro `[CONFIRMED: ausência]`.
- **Submitting:** "Salvando..." + disabled `[CONFIRMED: code]`.
- **Validação:** guards `if (!dataExame || !resultadoMgDl) return` e `Number.isNaN(valor)` (sem mensagem de erro ao usuário) `[CONFIRMED: code — Exames.tsx:44-47]`.

## Fluxos de interação

- Criar: converte data local → UTC com `zonedTimeToUtc(..., timezone)` e envia `dataISO`; sucesso fecha modal e limpa resultado `[CONFIRMED: code]`.
- Excluir: `confirm("Tem certeza que deseja excluir este exame?")` → `remover(id)` `[CONFIRMED: code]`.

## Responsividade

Tabela desktop × cards mobile (`hidden md:block` / `md:hidden`); cards de resumo `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`; modal bottom-sheet × central `[CONFIRMED: code]`.

## Acessibilidade

Labels visíveis, `required`; SEM `aria-*`; modal sem focus trap/ESC `[CONFIRMED: code × ausência]`.

## Testes

`useExames.test.ts`, `exames.service.test.ts`. Página sem teste próprio `[CONFIRMED: test, ausência]`.

## Evidências

- E1 — `src/react-app/pages/Exames.tsx` completo `[CONFIRMED: code]`
- E2 — `useExames.ts`, `exames.service.ts` `[CONFIRMED: code]`

## Veja também

- [../database/exames_pku.md](../../database/exames_pku.md), [estatisticas.md](estatisticas.md) (padrão de gráfico)
