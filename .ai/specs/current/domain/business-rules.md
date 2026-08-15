# Business Rules — MeuFenil

**Última verificação:** 2026-08-15 (DEBT-0002)

Regras de negócio CONFIRMADAS a partir do sistema atual. Cada regra segue o formato: Given / When / Then + Evidence + Implementation + Tests + Related Specs + Status. Status: `Confirmed + tested` · `Confirmed + partially tested` · `Confirmed + untested` · `Inferred` · `Unknown`. Regras em que a evidência não permite confirmação NÃO são listadas como fatos.

## Cálculo

### BR-001 — Cálculo de fenilalanina do registro
- **Tipo:** cálculo
- **Given:** uma referência com `fenil_mg_por_100g` e um peso em gramas
- **When:** o usuário informa o peso no modal de registro
- **Then:** `fenil_mg = (fenil_mg_por_100g × peso_g) / 100`, exibido ao vivo ("Fenilalanina calculada") e gravado no INSERT
- **Evidence:** `[CONFIRMED: code — AdicionarRegistro.tsx:94-95,148-151]`
- **Implementation:** [../frontend/components/adicionar-registro.md](../frontend/components/adicionar-registro.md)
- **Tests:** cálculo no componente SEM teste próprio; `useCreateRegistro.test.tsx` cobre o hook (recebe fenil_mg pronto) `[CONFIRMED: test]`
- **Status:** Confirmed + partially tested

### BR-002 — Percentual de consumo do dia
- **Tipo:** cálculo
- **Given:** total do dia e limite diário
- **When:** dashboard é renderizado
- **Then:** `percentual = (total / limite) × 100`; barra de progresso com largura `min(percentual, 100)%`
- **Evidence:** `[CONFIRMED: code — Dashboard.tsx:47,159]`
- **Tests:** página sem teste
- **Status:** Confirmed + untested

### BR-003 — Restante disponível
- **Tipo:** cálculo
- **Given:** limite e total do dia
- **When:** dashboard é renderizado
- **Then:** `restante = max(0, limite − total)` exibido como "disponível hoje"
- **Evidence:** `[CONFIRMED: code — Dashboard.tsx:173]`
- **Status:** Confirmed + untested

### BR-004 — Alerta de limite ultrapassado
- **Tipo:** UI behavior
- **Given:** `total > limite`
- **When:** dashboard é renderizado
- **Then:** card Percentual fica vermelho (`ring-red-500`, ícone AlertCircle) e box "Limite ultrapassado" é exibido com o excesso em mg
- **Evidence:** `[CONFIRMED: code — Dashboard.tsx:48,141-162,220-233]`
- **Status:** Confirmed + untested

### BR-005 — Total por dia no histórico
- **Tipo:** cálculo
- **Given:** registros do usuário (filtrados)
- **When:** histórico é renderizado
- **Then:** registros agrupados por `data` (decrescente) e `total do dia = soma(fenil_mg)` exibido com 1 decimal
- **Evidence:** `[CONFIRMED: code — Historico.tsx:46-52,137-172]`
- **Status:** Confirmed + untested

### BR-006 — Estatísticas do período (semana/mês)
- **Tipo:** cálculo
- **Given:** período (`semana` = últimos 7 dias incluindo hoje; `mes` = 30) e registros do usuário
- **When:** página Estatísticas carrega
- **Then:** agregação client-side por dia; `totalConsumo = Σ totais diários`; `mediaConsumo = totalConsumo / nº de dias COM registros` (0 se nenhum); `maiorConsumo = max dos totais diários`
- **Evidence:** `[CONFIRMED: code — estatisticas.service.ts:31-73]`
- **Tests:** `estatisticas.service.test.ts` (3), `useEstatisticas.test.ts` `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-007 — Tendência de exames
- **Tipo:** cálculo
- **Given:** exames ordenados por `data_exame` (asc)
- **When:** ≥ 2 exames
- **Then:** `tendência = último − penúltimo` (mg/dL); verde/ícone TrendingDown se ≤ 0, laranja/TrendingUp se > 0; exibida com sinal "+" quando positiva
- **Evidence:** `[CONFIRMED: code — Exames.tsx:82-97,137-163]`
- **Status:** Confirmed + untested

### BR-008 — Conversão PHE (informativa)
- **Tipo:** UI behavior
- **Given:** modal e box informativo de exames
- **When:** exibidos
- **Then:** textos fixos: "O valor em mg/dL é calculado dividindo o valor PHE (µmol/L) por 60,6" e "Valor PHE ÷ 60,6 = PKU em mg/dL" — SEM conversão implementada em código (o usuário informa mg/dL diretamente)
- **Evidence:** `[CONFIRMED: code — Exames.tsx:334-336,386-388]`
- **Status:** Confirmed + untested

### BR-009 — Percentual de armazenamento (admin)
- **Tipo:** cálculo
- **Given:** `tamanho_db_mb` do RPC `get_estatisticas_admin` e `LIMITE_MB = 500`
- **When:** painel admin carrega estatísticas
- **Then:** `percentual_usado = min((tamanho / 500) × 100, 100)`
- **Evidence:** `[CONFIRMED: code — admin.service.ts:16,86]`
- **Tests:** `admin.service.test.ts` ("calcula percentual corretamente") `[CONFIRMED: test]`
- **Status:** Confirmed + tested

## Validação

### BR-010 — Registro exige referência, peso e data
- **Tipo:** validação
- **Given:** modal AdicionarRegistro
- **When:** submit
- **Then:** guard rejeita se faltar usuário ativo, referência selecionada, peso ou data/timezone; botão Salvar fica `disabled` sem referência/peso
- **Evidence:** `[CONFIRMED: code — AdicionarRegistro.tsx:92,318-327]`
- **Status:** Confirmed + untested

### BR-011 — Referência exige nome e fenil numérico
- **Tipo:** validação
- **Given:** modal de referência
- **When:** submit
- **Then:** `required` + guard `if (!nome || !fenil) return`; valor não numérico: Dashboard retorna silenciosamente, Referencias mostra alert "Informe um valor numérico válido para fenilalanina."
- **Evidence:** `[CONFIRMED: code — ModalReferencia.tsx:31-39; Dashboard.tsx:58; Referencias.tsx:106-109]`
- **Status:** Confirmed + partially tested (services; componentes sem teste)

### BR-012 — Exame exige data e resultado numérico
- **Tipo:** validação
- **Given:** modal de exame
- **When:** submit
- **Then:** guards rejeitam campos vazios e resultado não numérico (sem mensagem ao usuário); data é convertida para UTC com o timezone do usuário (`zonedTimeToUtc`)
- **Evidence:** `[CONFIRMED: code — Exames.tsx:44-56]`
- **Status:** Confirmed + untested

### BR-013 — Auto-concessão de delegação é bloqueada
- **Tipo:** validação
- **Given:** ação `conceder` da edge function
- **When:** email do alvo é o do próprio usuário
- **Then:** 400 "Acesso a si mesmo não é permitido" (edge function) e `delegado_id <> auth.uid()` na policy INSERT
- **Evidence:** `[CONFIRMED: code, database — delegar-acesso/index.ts:141-146; policy]`
- **Status:** Confirmed + untested

## Autorização / Ownership / Delegação

### BR-014 — Dono = criador/usuário do recurso
- **Tipo:** ownership
- **Given:** recurso (registro, exame, referência, favorito, perfil)
- **When:** operação RLS/RPC
- **Then:** acesso concedido quando `auth.uid()` = coluna de dono (`usuario_id`/`criado_por`/`id`)
- **Evidence:** `[CONFIRMED: database — security-model.md, seções Ownership/Matriz]`
- **Tests:** T1.x, T2.x, T3.x (parcialmente — registros/exames/favoritos sem suíte) `[CONFIRMED: test]`
- **Status:** Confirmed + partially tested

### BR-015 — Delegado ativo opera como dono
- **Tipo:** delegação
- **Given:** delegação com `revoked_at IS NULL` do dono do recurso
- **When:** delegado opera (registros, exames, referências, favoritos de referências do concedente)
- **Then:** 15 políticas "dono ou delegado" e 2 RPCs autorizam
- **Evidence:** `[CONFIRMED: database, migration — security-model.md seção 9]`
- **Tests:** T2.3, T3.4 `[CONFIRMED: test]`
- **Status:** Confirmed + partially tested

### BR-016 — Admin = `usuarios.role = 'admin'`
- **Tipo:** autorização
- **Given:** usuário com role admin
- **When:** policies/RPCs verificam
- **Then:** `is_admin_user()` (ou claim JWT `role=admin` em 2 policies de referencias) autoriza
- **Evidence:** `[CONFIRMED: database, migration]`
- **Tests:** T1.0b/T1.3/T1.4, T2.4, T3.5/T3.7 `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-017 — Referência global: remoção exclusiva de admin
- **Tipo:** autorização
- **Given:** referência com `is_global = true`
- **When:** remoção
- **Then:** não-admin recebe "Permissão negada: apenas administradores podem remover referências globais" (RPC) e a policy DELETE bloqueia
- **Evidence:** `[CONFIRMED: migration, database]`
- **Tests:** T3.6, T3.7 `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-018 — Referência com registros vinculados não é excluída hard
- **Tipo:** lifecycle
- **Given:** referência usada em ≥ 1 registro
- **When:** remoção (RPC) ou DELETE direto
- **Then:** RPC faz soft delete (`is_ativa = false`, retorna `'deactivated'`); a policy DELETE bloqueia; na UI, erro FK 23503 dispara fallback de desativação com alert "Esta referência possui registros associados..."
- **Evidence:** `[CONFIRMED: migration, database, code — Referencias.tsx:92-95]`
- **Tests:** T3.3 `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-019 — Registro exige referência ativa
- **Tipo:** validação (banco)
- **Given:** INSERT em `registros`
- **When:** policy aplicada
- **Then:** WITH CHECK exige `referencias.is_ativa = true`
- **Evidence:** `[CONFIRMED: database — policy "Inserir registro apenas com referencia ativa"]`
- **Tests:** sem teste
- **Status:** Confirmed + untested

### BR-020 — Uma delegação ativa por par
- **Tipo:** delegação
- **Given:** par (concedente, delegado)
- **When:** concessão
- **Then:** índice único parcial `(concedente_id, delegado_id) WHERE revoked_at IS NULL` impede segunda delegação ativa (erro no banco; edge function responde 500 genérico)
- **Evidence:** `[CONFIRMED: database — delegacoes_acesso.md; code]`
- **Tests:** sem teste
- **Status:** Confirmed + untested

### BR-021 — Revogação de delegação é UPDATE, sem DELETE
- **Tipo:** delegação
- **Given:** delegação ativa
- **When:** revogação (edge function `revogar`)
- **Then:** `revoked_at = now()` onde `id` e `concedente_id` batem; efeito imediato em todas as checagens (`revoked_at IS NULL`); resposta `{success}` mesmo sem linhas afetadas
- **Evidence:** `[CONFIRMED: code, database]`
- **Tests:** sem teste
- **Status:** Confirmed + untested

### BR-022 — Assumir perfil exige delegação ativa e não muda o token
- **Tipo:** delegação
- **Given:** ação `assumir`
- **When:** delegado assume
- **Then:** exige `delegado_id = auth.uid() AND revoked_at IS NULL` (senão 403); retorna `usuario_assumido_id` + owner; a UI grava em sessionStorage e a identidade real permanece a do delegado
- **Evidence:** `[CONFIRMED: code — delegar-acesso/index.ts:187-231, AuthContext.tsx:134-149; security-model.md]`
- **Tests:** sem teste
- **Status:** Confirmed + untested

### BR-023 — Edição/remoção na UI: dono OU (admin E global)
- **Tipo:** UI behavior
- **Given:** página Referencias
- **When:** ações por linha
- **Then:** `podeEditarOuRemover(ref) = ref.criado_por === usuarioAtivoId || (isAdmin && ref.is_global)`; botões desabilitados caso contrário (enforcement real no banco)
- **Evidence:** `[CONFIRMED: code — Referencias.tsx:44-48]`
- **Tests:** sem teste de página
- **Status:** Confirmed + untested

## Lifecycle

### BR-024 — Lifecycle da referência: criada → ativa ↔ inativa
- **Tipo:** lifecycle
- **Given:** referência
- **When:** criação / desativação / reativação
- **Then:** criada com `is_ativa = true` (default); desativada via RPC quando há vínculo; reativada via RPC `ativar_referencia` (dono/delegado/admin); desativação remove favoritos (trigger `trg_remover_favoritos_referencia_inativa`)
- **Evidence:** `[CONFIRMED: database, migration — referencias.md, triggers.md, rpc.md]`
- **Tests:** T2.2/T2.3/T2.4, T3.3 (RPCs); trigger sem teste
- **Status:** Confirmed + partially tested

### BR-025 — Novo usuário recebe limite 500 e timezone São Paulo
- **Tipo:** lifecycle
- **Given:** sign-up (INSERT em auth.users)
- **When:** trigger `on_auth_user_created`
- **Then:** perfil criado com `limite_diario_mg = 500` (default da coluna — o trigger não define), `role = 'user'`, `timezone = 'America/Sao_Paulo'`, nome = full_name ou email
- **Evidence:** `[CONFIRMED: migration — 20260815000000 (DEBT-0002, decisão B); baseline linhas 206 e 120-148; database]`
- **Tests:** exercitado indiretamente pelas suítes de segurança (criação de usuários de teste); sem teste direto do trigger
- **Status:** Confirmed + partially tested

### BR-026 — Exclusão de conta: registros → perfil → auth
- **Tipo:** exclusão
- **Given:** usuário autenticado confirma (confirm + digitar "EXCLUIR")
- **When:** edge function `delete-account`
- **Then:** DELETE registros (FK sem CASCADE exige ordem) → DELETE usuarios → `auth.admin.deleteUser`; cascatas removem exames, referências pessoais, favoritos e delegações; falha em passo intermediário não desfaz os anteriores (não transacional)
- **Evidence:** `[CONFIRMED: code — delete-account/index.ts; database — FKs]`
- **Tests:** sem teste
- **Status:** Confirmed + untested

## Limite e retenção

### BR-027 — Retenção de 365 dias (somente background_job_executions)
- **Tipo:** retenção
- **Given:** tabela `background_job_executions`
- **When:** cada INSERT
- **Then:** trigger `trg_trim_background_job_executions` (AFTER INSERT, FOR EACH STATEMENT) executa `DELETE ... WHERE created_at < now() - interval '365 days'` — NÃO se aplica a outras tabelas
- **Evidence:** `[CONFIRMED: migration — 20260807000000_background_job_executions.sql:35-54]`
- **Tests:** sem teste do trigger
- **Status:** Confirmed + untested

## LGPD (comportamento do software — sem análise jurídica)

### BR-028 — Consentimento obrigatório até aceite
- **Tipo:** UI behavior
- **Given:** usuário sem `consentimento_lgpd_em`
- **When:** acessa o Dashboard
- **Then:** modal ConsentimentoLGPD é exibido (listas de dados coletados/finalidade/direitos); "Aceitar e Continuar" grava a data via `updateConsentimentoLGPD` e o modal não reaparece
- **Evidence:** `[CONFIRMED: UI, code — Dashboard.tsx:75, ConsentimentoLGPD.tsx, dashboard.service.ts]`
- **Tests:** service testado; componente sem teste
- **Status:** Confirmed + partially tested

### BR-029 — Direitos de dados implementados: exportar e excluir
- **Tipo:** exportação/exclusão
- **Given:** página Perfil (usuário próprio, não delegado)
- **When:** ações de privacidade
- **Then:** "Exportar meus dados" gera JSON `{usuario, registros, exportado_em, versao: "1.0"}`; "Excluir minha conta" segue BR-026; delegação de perfil (read-only) OCULTA essas ações
- **Evidence:** `[CONFIRMED: code — Perfil.tsx:72-160,239-298]`
- **Tests:** sem teste de página
- **Status:** Confirmed + untested

## UI / experiência

### BR-030 — Busca de referências com debounce de 300ms
- **Tipo:** UI behavior
- **Given:** modal AdicionarRegistro
- **When:** usuário digita
- **Then:** busca disparada 300ms após a última tecla (cancelada por nova digitação); dropdown fecha por click fora ou ESC
- **Evidence:** `[CONFIRMED: code — AdicionarRegistro.tsx:53-84]`
- **Status:** Confirmed + untested

### BR-031 — Favoritos primeiro (ordenação client-side com rollback)
- **Tipo:** UI behavior
- **Given:** toggle de favorito
- **When:** usuário favorita/desfavorita
- **Then:** lista reordenada imediatamente com favoritas primeiro; em erro no banco, a lista anterior é restaurada e o AppError é relançado
- **Evidence:** `[CONFIRMED: code — useReferencias.ts:126-168]`
- **Tests:** hook testado (estado inicial, busca, erro, criar) — reordenação/rollback SEM teste direto
- **Status:** Confirmed + partially tested

### BR-032 — Filtros de referências aplicados no servidor
- **Tipo:** UI behavior
- **Given:** página Referencias
- **When:** busca/filtros (inativas, favoritas, customizadas) mudam
- **Then:** nova consulta com os filtros (servidor); página volta à primeira página da paginação client-side
- **Evidence:** `[CONFIRMED: code — useReferencias.ts:35-42,59-61; Referencias.tsx:160-162]`
- **Status:** Confirmed + partially tested

### BR-033 — Janela do gráfico do dashboard: 7 dias incluindo hoje
- **Tipo:** cálculo
- **Given:** dashboard
- **When:** carrega
- **Then:** gráfico "Últimos 7 dias" usa registros de `data >= hoje−6` (no timezone do usuário), agregados por dia no cliente
- **Evidence:** `[CONFIRMED: code — dashboard.service.ts:34-43,55]`
- **Tests:** `dashboard.service.test.ts` `[CONFIRMED: test]`
- **Status:** Confirmed + tested

## Evidências (documento)

- E1 — Todas as regras derivadas de código/banco/UI/migrations/testes citados em cada BR; nenhuma regra foi criada sem evidência `[CONFIRMED: processo]`
- E2 — Matriz completa Rule × Implementation × Spec × Test: `.ai/.temp/analyses/23-documentacao-product-domain.md`

## Veja também

- [domain-model.md](domain-model.md), [../product/glossary.md](../product/glossary.md), [../security/security-model.md](../security/security-model.md), [../database/](../database/)
