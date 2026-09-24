# Business Rules — MeuFenil

**Última verificação:** 2026-09-24 (ENH-0009 — BR-037/039/040/043/045/046/047 revisadas; BR-043 revogada; migration 20260923000000; FEAT-0017 M1–M6 — seção Sincronização BR-038–047; ressalvas BR-023/024/026/027; migrations 20260905*/20260906*/20260907000000 aplicadas em dev)

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
- **Then:** `required` + guard `if (!nome || !fenil) return` (marca é opcional — omissa permanece em branco `''`, BR-035); valor não numérico: Dashboard retorna silenciosamente, Referencias mostra alert "Informe um valor numérico válido para fenilalanina."
- **Evidence:** `[CONFIRMED: code — ModalReferencia.tsx:48; Dashboard.tsx:55-58; Referencias.tsx:132-135]`
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

### BR-018 — Remoção de referência pessoal: RPC decide soft/hard pelo vínculo
- **Tipo:** lifecycle
- **Given:** referência PESSOAL (`is_global = false`) e remoção via RPC `remover_ou_desativar_referencia` (única via da aplicação — service `deleteOrDeactivateReferencia`)
- **When:** usuário remove na UI
- **Then:** com ≥ 1 registro vinculado → soft delete (`is_ativa = false`, retorna `'deactivated'`); sem registros → DELETE físico (retorna `'deleted'`). A policy DELETE bloqueia remoção direta quando há vínculo; o fallback de erro FK 23503 na UI foi ELIMINADO na ENH-0004 (o service passou a tratar o retorno do RPC). Globais: sempre arquivam — BR-037
- **Evidence:** `[CONFIRMED: migration — 20260904000000 linhas 96-164; code — referencias.service.ts:323-338; Referencias.tsx:96-127]`
- **Tests:** T3.3, T3.7 `[CONFIRMED: test]`
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
- **Then:** `podeEditarOuRemover(ref) = ref.criado_por === usuarioAtivoId || (isAdmin && ref.is_global)`; botões desabilitados caso contrário (enforcement real no banco). PESSOAL: edição abre o modal e faz UPDATE. GLOBAL: a guarda do service (`assertReferenciaEditavel`) impede UPDATE substantivo — `AppError REFERENCIA_GLOBAL_IMUTAVEL` (BR-034); a UI oferece confirmar o arquivamento da atual e abrir o modal pré-preenchido para criar a nova (arquivar + criar). Sincronização com a origem aplica a MESMA fronteira no banco (curadoria via RPC `decidir_pendencia_referencia`): mudança substantiva de global só por arquivar + criar, nunca UPDATE in-place — BR-040; criações automáticas usam o ator Sistema (BR-047)
- **Evidence:** `[CONFIRMED: code — Referencias.tsx:54-58 (podeEditarOuRemover), 66-94 (edição de global: arquivar+criar), 96-127 (remoção); referencias.service.ts:242-261 (guarda)]`
- **Tests:** service testado (guarda de global); sem teste de página
- **Status:** Confirmed + partially tested

## Lifecycle

### BR-024 — Lifecycle da referência: criada → ativa ↔ arquivada
- **Tipo:** lifecycle
- **Given:** referência
- **When:** criação / desativação / reativação
- **Then:** criada com `is_ativa = true` (default) e identidade única entre ATIVAS (índice único parcial — BR-034/BR-035); desativada (arquivada, `is_ativa = false`) via RPC quando pessoal com vínculo OU sempre que global (BR-037); reativada via RPC `ativar_referencia` (pessoal pelo dono/delegado; global por admin); arquivadas coexistem livremente com ativas de mesma identidade; desativação NÃO remove favoritos (trigger eliminado na ENH-0004 — BR-036). RESSALVA FEAT-0017: a sincronização com a origem arquiva globais via RPC própria (aplicar, ator Sistema — BR-038/BR-047), mas NUNCA reativa: reaparição na origem de global arquivada-pela-origem = criação de referência NOVA; inativa por bloqueio manual = silêncio (BR-042); as ÚNICAS reativações fora de `ativar_referencia` são rollback/restauração de sync, com evento auditado `rollback`/`restore` (BR-046/BR-047)
- **Evidence:** `[CONFIRMED: database, migration — referencias.md, triggers.md, rpc.md; migrations 20260904000000, 20260905020000 (R4-3 — guarda de global no ativar_referencia); FEAT-0017 — 20260905000000/20260906000000/20260906010000/20260907000000]`
- **Tests:** T2.2/T2.3/T2.4, T2.6–T2.10 (global), T3.3, T3.7 (RPCs); suítes REAL do sync (nunca reativa; reaparição; flips de rollback não viram `is_ativa_manual`)
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
- **Then:** DELETE registros (FK sem CASCADE exige ordem) → DELETE usuarios → `auth.admin.deleteUser`; cascatas removem exames, referências pessoais, favoritos e delegações; falha em passo intermediário não desfaz os anteriores (não transacional). RESSALVA FEAT-0017: a rotina não alcança a infraestrutura de sync — não apaga `referencia_syncs`/`referencia_snapshots`/`referencia_backups` (histórico) e as FKs de `referencia_eventos` para o usuário/`referencias` usam SET NULL, preservando a trilha de auditoria quando a conta ou a referência é excluída (BR-047); o ator Sistema (`sistema@meufenil.local`, BR-047) não é conta de usuário comum — não é alvo da rotina
- **Evidence:** `[CONFIRMED: code — delete-account/index.ts; database — FKs; FEAT-0017 — migration 20260905000000 (FKs SET NULL de referencia_eventos, sem FK CASCADE para syncs/backups)]`
- **Tests:** sem teste
- **Status:** Confirmed + untested

## Limite e retenção

### BR-027 — Retenção de 365 dias (somente background_job_executions)
- **Tipo:** retenção
- **Given:** tabela `background_job_executions`
- **When:** cada INSERT
- **Then:** trigger `trg_trim_background_job_executions` (AFTER INSERT, FOR EACH STATEMENT) executa `DELETE ... WHERE created_at < now() - interval '365 days'` — NÃO se aplica a outras tabelas. RESSALVA FEAT-0017: `referencia_backups` é a única exceção — tem trigger de trim PRÓPRIO fixado em 12 meses (`trg_trim_referencia_backups`, BR-046); demais tabelas de sync (eventos/pendências/snapshots) não têm trim
- **Evidence:** `[CONFIRMED: migration — 20260807000000_background_job_executions.sql:35-54; FEAT-0017 — 20260905000000:260-279]`

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
- **Evidence:** `[CONFIRMED: code — useReferencias.ts:132-179]`
- **Tests:** hook testado (estado inicial, busca, erro, criar) — reordenação/rollback SEM teste direto
- **Status:** Confirmed + partially tested

### BR-032 — Filtros de referências aplicados no servidor
- **Tipo:** UI behavior
- **Given:** página Referencias
- **When:** busca/filtros (inativas, favoritas, customizadas) mudam
- **Then:** nova consulta com os filtros (servidor); página volta à primeira página da paginação client-side
- **Evidence:** `[CONFIRMED: code — useReferencias.ts:28-56 (load), 182-194 (search nome/marca); Referencias.tsx (filtros/paginação)]`
- **Status:** Confirmed + partially tested

### BR-033 — Janela do gráfico do dashboard: 7 dias incluindo hoje
- **Tipo:** cálculo
- **Given:** dashboard
- **When:** carrega
- **Then:** gráfico "Últimos 7 dias" usa registros de `data >= hoje−6` (no timezone do usuário), agregados por dia no cliente
- **Evidence:** `[CONFIRMED: code — dashboard.service.ts:34-43,55]`
- **Tests:** `dashboard.service.test.ts` `[CONFIRMED: test]`
- **Status:** Confirmed + tested

## Identidade e arquivamento de referências (ENH-0004 — 2026-09-04)

> Regras novas implementadas pelo ENH-0004 (modelo canônico e identidade imutável — spec arquivada como IMPLEMENTED em `archive/implemented/enhancements/`), numeradas BR-034–BR-037 na sequência das seções "Novas propostas" da proposta. `[CONFIRMED: implementação ENH-0004 — migrations 20260904000000/20260904010000, merge PR #55 (82bd0f3, 2026-09-04); premissa: numeração sequencial derivada — renumeração é decisão humana se houver conflito com numeração futura]`

### BR-034 — Identidade substantiva de globais é imutável
- **Tipo:** lifecycle (identidade)
- **Given:** referência global (`is_global = true`) já criada
- **When:** tentativa de edição da identidade substantiva `(nome, marca, fenil_mg_por_100g)` por UPDATE
- **Then:** a guarda do service (`assertReferenciaEditavel`) lança `AppError REFERENCIA_GLOBAL_IMUTAVEL`; a UI oferece o fluxo de arquivar a atual e criar a nova (cópia pré-preenchida no modal) — nenhum fluxo da aplicação edita a identidade de global por UPDATE
- **Evidence:** `[CONFIRMED: code — referencias.service.ts:242-261; Referencias.tsx:66-94]`
- **Tests:** `referencias.service.test.ts` cobre a guarda; fluxo arquivar+criar da página sem teste `[CONFIRMED: test]`
- **Status:** Confirmed + partially tested

### BR-035 — Marca é atributo separado; em branco = marca NÃO declarada
- **Tipo:** modelo de dados
- **Given:** criação ou edição de referência
- **When:** usuário informa a marca ou a omite
- **Then:** `marca` gravada em coluna própria (`NOT NULL` default `''` desde a migration 20260904030000) — omissão/em branco permanece EM BRANCO (marca não declarada); **revogada em 2026-09-04 (usuário)** a regra "Em branco = Produto In Natura": `'Produto In Natura'` é marca DECLARADA pela fonte (planilha ANVISA) e entra no banco apenas onde a fonte a declara (97 linhas em dev); o `nome` não carrega o sufixo `(Marca: X)`; a apresentação combinada `"Nome (Marca: X)"` é montada dinamicamente no frontend (`nomeComMarca`) apenas quando há marca declarada; a busca de referências consulta nome OU marca (server-side)
- **Evidence:** `[CONFIRMED: migrations 20260904000000/20260904030000 (coluna + backfill + canônico revisto); code — lib/referencias.ts (normalizarMarca, extrairMarcaDoNome, nomeComMarca), ModalReferencia.tsx:90-107, referencias.service.ts:74-86; decisão 2026-09-04 registrada no header da 030000]`
- **Tests:** `src/react-app/lib/referencias.test.ts` (20 testes) + `referencias.service.test.ts` (busca nome+marca; create/update com marca em branco) `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-036 — Desativação preserva favoritos
- **Tipo:** lifecycle
- **Given:** referência favoritada por um usuário
- **When:** desativação/arquivamento em qualquer fluxo (pessoal com vínculo via RPC; global por admin)
- **Then:** favoritos NÃO são removidos — o trigger `trg_remover_favoritos_referencia_inativa` foi eliminado (migration 20260904000000); a linha permanece em `referencias_favoritas`; a referência arquivada é exibida como inativa/indisponível, não pode ser usada em novos registros e pode ser desfavoritada normalmente; reativação restaura o uso
- **Evidence:** `[CONFIRMED: migration 20260904000000 (DROPs, linhas 87-88); database — referencias_favoritas.md, triggers.md]`
- **Tests:** sem teste dedicado `[CONFIRMED: ausência]`
- **Status:** Confirmed + untested

### BR-037 — Globais só são excluídas fisicamente pelo processo de sync; remoção manual sempre arquiva
- **Tipo:** lifecycle
- **Given:** referência global (`is_global = true`)
- **When:** remoção via RPC `remover_ou_desativar_referencia` (única via da aplicação) **OU** sync detecta ausência na origem
- **Then:** via `remover_ou_desativar_referencia` → SEMPRE arquivamento (`is_ativa = false`) — nunca DELETE físico; via sync (`aplicar_sync_referencias`) → global ausente SEM `registros` e SEM `referencias_favoritas` → DELETE físico (`referencia_deletada`); ausente COM qualquer relacionamento → `is_ativa = false`; o ENH-0009 (migration 20260923000000) criou a exceção de sync: a RPC `remover_ou_desativar_referencia` ainda nunca deleta fisicamente; reativação de global apenas por admin
- **Evidence:** `[CONFIRMED: migration 20260904000000 (linhas 96-164); migration 20260905020000 (guarda de reativação global); migration 20260923000000 (aplicar_sync_referencias — deleção física + race condition degradation); code — referencias.service.ts:323-338]`
- **Tests:** T3.7 de `src/shared/security/rpc-remover-referencia.test.ts`; T2.6–T2.8 de `rpc-ativar-referencia.test.ts`; suíte REAL `rpc-referencias-sync.test.ts` (ENH-0009) `[CONFIRMED: test]`
- **Status:** Confirmed + partially tested

## Sincronização de referências com a origem (FEAT-0017 — 2026-09-06/07)

> Regras implementadas pela FEAT-0017 (sincronização do conjunto global com a origem ANVISA/Power BI — migrations 20260905000000/20260905010000/20260905020000/20260906000000/20260906010000/20260907000000, rota `api/referencias-sync.ts`, motor `src/shared/referencias-sync/`, UI do Admin M6). A proposta previa numeração "BR-034+"; ENH-0004 (2026-09-04) ocupou BR-034–BR-037 — o sync herda BR-038 em diante (premissa de numeração sequencial do ENH-0004, mantida aqui). `[CONFIRMED: implementação — merges PRs #57–#62 em development; premissa: derivação sequencial — renumeração é decisão humana se houver conflito]`

### BR-038 — Sincronização controla apenas referências globais
- **Tipo:** escopo
- **Given:** sincronização (sync) com a origem
- **When:** qualquer estágio (comparação, aplicação, restauração)
- **Then:** somente o conjunto `is_global = true` é avaliado/alterado; referências pessoais (`is_global = false`) nunca são criadas, arquivadas, reativadas, deletadas ou tocadas pela infraestrutura de sync — restauração de backup explicita "pessoais nunca tocadas"
- **Evidence:** `[CONFIRMED: code — src/shared/referencias-sync/engine.ts, compare.ts ("nunca toca is_global = false"); migration 20260906010000 (restaurar filtra is_global = true no payload); migration 20260923000000 (ENH-0009: deleção física e sweep só em is_global = true)]`
- **Tests:** suítes do motor + REAL ENH-0009 `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-039 — Sync com extração/validação inválida aborta sem efeito; proteção pré-sync por backup
- **Tipo:** lifecycle (segurança da aplicação)
- **Given:** execução de sync
- **When:** a extração/validação falhou (origem inválida/não confiável) OU a sync ainda não foi validada no ambiente (primeira sync)
- **Then:** sync com falha de extração/validação aborta antes de qualquer efeito (validação B9: estrutura inesperada ou nenhuma linha válida restante; duplicidade conflitante rejeita o par inteiro — BR-044); ENH-0009 removeu a distinção bootstrap/pos_bootstrap (`derivarModoSync` removido — columna `bootstrap` dropada) — toda sync confiável aplica automaticamente; proteção da 1ª sync: backup completo é criado ANTES de `aplicar_sync_referencias` (integridade garantida por sha256), possibilitando restauração se o resultado for indesejado
- **Evidence:** `[CONFIRMED: code — src/shared/powerbi/validate.ts (checks 1/2 abortam; check 3 rejeita linha a linha; check 4 rejeita grupos conflitantes inteiros); migration 20260923000000 (ENH-0009: DROP COLUMN bootstrap; ausência de derivarModoSync no motor)]`
- **Tests:** `engine.test.ts` (falha em cada estágio — nada aplicado), `validate.test.ts`, REAL ENH-0009 `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-040 — Mudança substantiva na origem = arquivar + criar, auto-aplicada (ENH-0009)
- **Tipo:** lifecycle
- **Given:** divergência substantiva (`fenil_mg_por_100g` diferente, mesma identidade `nome+marca`) entre a origem e uma global ativa
- **When:** sincronização detecta a mudança
- **Then:** a alteração NUNCA é aplicada por UPDATE in-place — convertida automaticamente em dois passos: archive (fenil antigo, `detalhes.motivo='substituicao'`) + create (fenil atualizado, ator Sistema); a origem é sempre fonte da verdade para `fenil_mg_por_100g`; sem revisão humana (ENH-0009 revogou curadoria — BR-043 removida); guardas de estado abortam com ROLLBACK total se a linha mudou entre comparação e aplicação (23505/estado → exceção)
- **Evidence:** `[CONFIRMED: code — src/shared/referencias-sync/compare.ts (substitution → archive+create), engine.ts (construirPlanoSync); migration 20260923000000 (ENH-0009: auto-aplicação de substitutions; motivo nos eventos)]`
- **Tests:** `compare.test.ts` (4 substituição); `engine.test.ts` (construirPlanoSync); suíte REAL `rpc-referencias-sync.test.ts` (ENH-0009) `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-041 — Matching determinístico decide identidade; similaridade só auxilia
- **Tipo:** matching
- **Given:** comparação origem × catálogo
- **When:** identidade precisa ser decidida
- **Then:** chave canônica `(nome, marca, fenil_mg_por_100g)` normalizada de forma determinística (mesma do índice único de identidade ativa da ENH-0004); similaridade/heurística e IA/LLM nunca decidem identidade
- **Evidence:** `[CONFIRMED: code — src/shared/referencias-sync/canonical.ts (chaveRef), compare.ts; ausência — sem IA/similaridade no motor]`
- **Tests:** `canonical.test.ts` `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-042 — Arquivada não reativa; reaparição = nova; bloqueio manual é preservado
- **Tipo:** lifecycle (B8 — derivação por eventos)
- **Given:** global inativa (`is_global = true, is_ativa = false`) e presença na origem
- **When:** sincronização compara
- **Then:** arquivada-pela-origem (evento `referencia_arquivada`) reaparecendo → tratada como referência NOVA (recriação com id novo, mesmo fluxo de inclusão); bloqueada-manual (global inativa com evento `is_ativa_manual`/`pre_sync_inativa` ou sem evento de arquivamento por sync) → presença na origem é silenciosa, nunca auto-reativa; a distinção é derivada dos eventos de auditoria (B8 — sem coluna nova em `referencias`); ENH-0009 removeu o seed de `pre_sync_inativa` (`derivarModoSync` e coluna `bootstrap` dropados — globais legadas sem evento agora entram como candidatas ao sweep retroativo); reativações por restauração são a EXCEÇÃO auditada (evento `restore`, nunca tipo `ativar`/`is_ativa_manual` — GUC `app.audit_origin`)
- **Evidence:** `[CONFIRMED: code — compare.ts:30-33 (reaparição de bloqueio manual → silêncio), src/shared/referencias-sync/compare.ts; migration 20260907000000 (seed pre_sync_inativa, actor NULL, só em bootstrap); migration 20260906010000 (reativações auditadas com evento rollback/restore)]`
- **Tests:** `compare.test.ts` (reaparição origem×manual, com e sem seed); suíte REAL `rpc-referencias-sync-seed.test.ts` (6 testes) `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-043 — ~~Curadoria~~ REVOGADO pelo ENH-0009 (2026-09-24)
- **Tipo:** curadoria (REVOGADA)
- **Revogação:** ENH-0009 (migration 20260923000000) removeu integralmente o mecanismo de curadoria: `referencia_sync_pendencias`, `decidir_pendencia_referencia` e a lógica de pendências foram dropados. Substitutions agora são auto-aplicadas (BR-040). Regra sem implementação ativa — mantida no histórico para rastreabilidade.
- **Evidence:** `[CONFIRMED: migration 20260923000000 — DROP TABLE referencia_sync_pendencias CASCADE; DROP FUNCTION decidir_pendencia_referencia]`
- **Status:** Revoked (ENH-0009)

### BR-044 — Duplicidade conflitante na origem rejeita o par inteiro
- **Tipo:** validação
- **Given:** extração com duas ou mais linhas de mesma identidade de nome+marca e valores substantivos divergentes (fenil diferente)
- **When:** validação da extração (estágio 3)
- **Then:** TODAS as linhas do grupo conflitante são rejeitadas individualmente — **par inteiro, nenhum valor arbitrário vence**; o produto fica fora do catálogo até a origem estabilizar. **Revisão 2026-09-14 da decisão D-10** (que invalidava a sync inteira): com a origem real, pares conflitantes existem e o abort permanente tornou-se inviável (origin_invalid a cada execução); a sync agora NÃO é invalidada pelo conflito — segue com as demais linhas e só aborta se não restar nenhuma válida. Cada rejeição reporta o grupo completo (`{linha, nome, motivo}` com os valores e linhas do par). Duplicidades exatas (idênticas) são apenas contadas e deduplicadas na comparação. A checagem roda sobre as linhas VÁLIDAS (linhas rejeitadas individualmente não participam)
- **Evidence:** `[CONFIRMED: code — src/shared/powerbi/validate.ts (check 4 — grupos com fenil divergente rejeitam todas as linhas do grupo)]`
- **Tests:** `validate.test.ts` (par conflitante rejeitado inteiro com sync seguindo; conflito aponta linhas originais; marca nula × vazia; tripla) `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-045 — Sync é unidade com ID único; single-flight
- **Tipo:** lifecycle (concorrência)
- **Given:** execução de sincronização
- **When:** qualquer escrita de sync
- **Then:** cada sync é linha própria (`referencia_syncs`) com ID único rastreando eventos, snapshots e backups; no máximo UMA sync `running` por environment (índice único parcial — segunda simultânea viola 23505 e a rota responde 409 sem registrar linha); ENH-0009 removeu pendências e rollback seletivo — restauração (`restaurar_referencias_de_backup`) não cancela pendências (`pendencias_canceladas = 0` sempre)
- **Evidence:** `[CONFIRMED: migration 20260905000000 (tabelas; single-flight linhas 90-92); migration 20260923000000 (ENH-0009: pendências removidas; restaurar retorna pendencias_canceladas=0)]`
- **Tests:** REAL M1.1–M1.5 (RLS/single-flight); suíte REAL `rpc-referencias-sync-rollback.test.ts` (restaurar) `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-046 — Backup pré-aplicação com retenção própria de 12 meses; restauração excepcional como única via de rollback
- **Tipo:** retenção/recuperação
- **Given:** sync com extração válida (backup criado no estágio 5, antes de aplicar) / incidente que exige reverter o catálogo
- **When:** backup/restauração
- **Then:** backup completo de `referencias` (payload + sha256, contagem) é gravado por sync com retenção FIXADA de 12 meses (trigger próprio — fora do trim 365d da BR-027, que continua valendo só para `background_job_executions`); ENH-0009 (migration 20260923000000) removeu `reverter_sync_referencias` (rollback seletivo) — recuperação feita EXCLUSIVAMENTE via `restaurar_referencias_de_backup`; restauração verifica o sha256 do payload antes de qualquer efeito (digest via `extensions.digest`), devolve o conjunto global a refletir o backup, não cancela pendências (removidas pelo ENH-0009 — `pendencias_canceladas = 0`), não cria linha de sync (evento único `restore` com ids) e nunca apaga histórico; referências fisicamente deletadas que existem no backup são recriadas por INSERT com UUID original
- **Evidence:** `[CONFIRMED: migration 20260905000000 (backup trigger linhas 260-279); migration 20260906010000 (restaurar — integridade sha256); migration 20260923000000 (ENH-0009: DROP FUNCTION reverter_sync_referencias; restaurar reescrita — pendencias_canceladas=0)]`
- **Tests:** suíte REAL `rpc-referencias-sync-rollback.test.ts` (6 testes — restaurar) `[CONFIRMED: test]`
- **Status:** Confirmed + tested

### BR-047 — Auditoria de sync/curadoria e de alteração manual de is_ativa; fronteira OQ4 preservada
- **Tipo:** auditoria
- **Given:** eventos de sincronização/curadoria ou UPDATE de `is_ativa` por admin
- **When:** escrita ocorre
- **Then:** tabela única `referencia_eventos` (RLS admin-only, escritas via service_role/RPCs SECURITY DEFINER) registra o catálogo mínimo (sync iniciada, extração, validação, snapshot/backup, referência criada/arquivada/deletada, mudança aprovada/rejeitada + motivo, restauração); ENH-0009 adicionou `referencia_deletada` ao enum e removeu `pendencia_cancelada` e `rollback` como tipos gerados ativamente (permanecem no enum como histórico); alteração manual de `is_ativa` por admin é sempre auditada (`trg_auditar_is_ativa_manual` — evento `is_ativa_manual`, GUC `app.audit_origin` suprime o trigger quando a RPC já registra evento específico); escritas de sync usam o ator Sistema (`sistema@meufenil.local` — resolvido por email, ausente → fail-high) nas criações; operações manuais fora do sync (RPCs de remoção/ativação, criação/edição admin) NÃO ganham nova infra de auditoria (fronteira OQ4)
- **Evidence:** `[CONFIRMED: migration 20260905000000 (tabela eventos linhas 131-155; RLS linhas 198-252); migration 20260905010000 (trigger/GUC); migration 20260906000000 (actor Sistema — resolução por email linhas 75-93, 343-352)]`
- **Tests:** suítes REAL M1–M6 verificam eventos e GUC (ex.: `rpc-referencias-sync-rollback.test.ts:423` — flips não viraram `is_ativa_manual`) `[CONFIRMED: test]`
- **Status:** Confirmed + tested

## Evidências (documento)

- E1 — Todas as regras derivadas de código/banco/UI/migrations/testes citados em cada BR; nenhuma regra foi criada sem evidência `[CONFIRMED: processo]`
- E2 — Matriz completa Rule × Implementation × Spec × Test: `.ai/.temp/analyses/23-documentacao-product-domain.md`

## Veja também

- [domain-model.md](domain-model.md), [../product/glossary.md](../product/glossary.md), [../security/security-model.md](../security/security-model.md), [../database/](../database/)
