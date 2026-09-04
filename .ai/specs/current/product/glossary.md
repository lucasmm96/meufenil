# Glossário — MeuFenil

**Última verificação:** 2026-09-04 (ENH-0004 — marca separada, identidade imutável, arquivamento sem perda de favoritos)

Termos como REALMENTE usados no sistema. Definições derivadas das fontes (código, banco, UI, README) — sem definições médicas externas além do que o próprio sistema afirma.

## Domínio clínico

| Termo | Definição no sistema | Contexto | Evidência | Relacionados |
|---|---|---|---|---|
| **PKU (Fenilcetonúria)** | condição tratada pelo produto; dieta restritiva de fenilalanina | identidade do produto | README; textos da Home/Sobre `[CONFIRMED: documentation, UI]` | Fenilalanina, Exame PKU |
| **Fenilalanina (fenil)** | aminoácido cujo consumo diário o sistema controla; medido em mg | campo `fenil_mg` em registros; `fenil_mg_por_100g` em referências | database `[CONFIRMED: database]` | Registro, Referência, Limite diário |
| **PHE (µmol/L)** | unidade alternativa do resultado do exame; a UI informa "Valor PHE ÷ 60,6 = PKU em mg/dL" — texto informativo, SEM conversão implementada em código | helper do modal de exame | `Exames.tsx:386-388` `[CONFIRMED: UI]` | Exame PKU |

## Usuários e papéis

| Termo | Definição no sistema | Contexto | Evidência | Relacionados |
|---|---|---|---|---|
| **Usuário** | pessoa autenticada (Supabase Auth) com perfil em `public.usuarios`; tem papel `user` (default) ou `admin`, limite diário, timezone e consentimento LGPD | criação automática no sign-up | database, trigger `[CONFIRMED: database, migration]` | Administrador, Usuário ativo |
| **Administrador (admin)** | usuário com `usuarios.role = 'admin'`; vê todos os perfis, gere referências globais, acessa o painel administrativo | verificado por `is_admin_user` | database, security `[CONFIRMED: database]` | Painel administrativo |
| **Usuário ativo** | usuário em cujo nome a aplicação está operando: o próprio usuário OU o perfil assumido via login-as (`usuarioAtivoId`) | todas as páginas operam sobre `usuarioAtivoId` | `AuthContext.tsx:104`, `useUsuarioAtivo` `[CONFIRMED: code]` | Delegação, Usuário real |
| **Usuário real** | identidade autenticada da sessão (`authUser`) — NÃO muda com o login-as; a autorização real é sempre a do usuário real | enforcement via RLS/RPCs | security-model `[CONFIRMED: code, database]` | Usuário ativo |
| **Concedente** | usuário dono do perfil que delega acesso (`delegacoes_acesso.concedente_id`) | gestão de delegações | database `[CONFIRMED: database]` | Delegado, Delegação |
| **Delegado** | usuário autorizado a operar em nome do concedente (`delegacoes_acesso.delegado_id`) | policies "dono ou delegado" | database `[CONFIRMED: database]` | Delegação, Login-as |
| **Delegação de acesso / login-as** | mecanismo em que um usuário concede a outro o direito de operar em seus dados; o delegado "assume" o perfil (estado de UI) e o banco autoriza via `delegacoes_acesso` | concessão/revogação/assunção | database, security, edge function `[CONFIRMED: code, database]` | Concedente, Delegado, Usuário ativo |

## Alimentação

| Termo | Definição no sistema | Contexto | Evidência | Relacionados |
|---|---|---|---|---|
| **Referência (alimentar)** | alimento com valor de fenilalanina por 100g (`fenil_mg_por_100g`); identidade = `(nome, marca, fenil_mg_por_100g)`, única entre referências ATIVAS (desde a ENH-0004, nome e marca são atributos separados — sem coluna `nome_normalizado`); sem marca/in natura = canônico `Produto In Natura` | tabela `referencias` | database `[CONFIRMED: database, migration 20260904000000]` | Referência global, customizada, favorita, Marca |
| **Marca** | atributo separado da referência (coluna `marca`, default `'Produto In Natura'`) — ENH-0004; apresentação combinada "Nome (Marca: X)" montada dinamicamente no frontend (`nomeComMarca`) | modal de referência, lista, busca (nome OU marca) | database, code `[CONFIRMED: database, code]` | Referência (alimentar) |
| **Referência global** | referência com `is_global = true` — dados ANVISA/admin, visível a todos (inclusive anon); identidade IMUTÁVEL (edição = arquivar + criar nova); somente admin pode remover — e a remoção é SEMPRE arquivamento (nunca exclusão física pela aplicação, desde a ENH-0004) | badge "Global" na UI | database, UI, code `[CONFIRMED: database, UI, code]` | Referência customizada |
| **Referência customizada/pessoal** | referência criada pelo usuário (`criado_por`, `is_global = false`); badge "Customizada" | `usuario cria referencia` | database, UI `[CONFIRMED: database, UI]` | Referência global |
| **Referência ativa / inativa** | estado `is_ativa` (default `true`); inativa (arquivada) não pode ser usada em novos registros; exibida riscada com "(Inativa)"; pode ser reativada; o arquivamento PRESERVA favoritos (desde a ENH-0004) e arquivadas podem coexistir com ativas de mesma identidade | soft delete/arquivamento via RPC | database, UI `[CONFIRMED: database, UI, migration 20260904000000]` | Registro, Favorito |
| **Referência favorita** | marcação pessoal do usuário em `referencias_favoritas` (1 por par usuário/referência); favoritas aparecem primeiro na lista do modal | estrela na UI | database, UI `[CONFIRMED: database, UI]` | Referência |
| **Registro (de consumo)** | consumo diário: data, alimento (referência), peso em gramas e fenilalanina em mg; sem edição (só criar/excluir) | tabela `registros` | database `[CONFIRMED: database]` | Referência, Limite diário |
| **Limite diário** | teto pessoal de fenilalanina em mg/dia (`usuarios.limite_diario_mg`); default 500 para novos usuários (default da coluna; trigger não define — DEBT-0002); editável no Perfil | indicadores do Dashboard | database, migration, UI `[CONFIRMED: database, migration, UI]` | Fenilalanina, Percentual de consumo |

## Saúde

| Termo | Definição no sistema | Contexto | Evidência | Relacionados |
|---|---|---|---|---|
| **Exame PKU** | resultado laboratorial com data e valor em mg/dL (`exames_pku`) | página Exames | database, UI `[CONFIRMED: database, UI]` | PHE, Tendência |
| **Tendência / Variação** | diferença entre o último e o penúltimo exame (mg/dL); verde se ≤ 0, laranja se > 0 | card "Variação" | `Exames.tsx:89-97` `[CONFIRMED: UI]` | Exame PKU |

## Privacidade / LGPD

| Termo | Definição no sistema | Contexto | Evidência | Relacionados |
|---|---|---|---|---|
| **Consentimento LGPD** | aceite obrigatório exibido no Dashboard enquanto `usuarios.consentimento_lgpd_em` for nulo; grava a data do aceite | modal "Aceitar e Continuar" | UI, database `[CONFIRMED: UI, database]` | Exportação, Exclusão de conta |
| **Exportação de dados** | downloads implementados: estatísticas (CSV/JSON do período) e dados do perfil (JSON `{usuario, registros, exportado_em, versao: "1.0"}`) | botões CSV/JSON e "Exportar meus dados" | UI, code `[CONFIRMED: UI, code]` | Consentimento LGPD |
| **Exclusão de conta** | fluxo do Perfil com dupla confirmação (`confirm` + digitar "EXCLUIR") → edge function `delete-account` (registros → usuarios → auth) | "Excluir minha conta" | UI, code `[CONFIRMED: UI, code]` | Consentimento LGPD |

## Infraestrutura

| Termo | Definição no sistema | Contexto | Evidência | Relacionados |
|---|---|---|---|---|
| **Background job** | rotina server-side registrada em `background_job_executions`; único job implementado: `keepalive` | monitoramento no Admin | database, code `[CONFIRMED: database, code]` | Keepalive, run_id |
| **Keepalive** | job diário (Vercel Cron `0 12 * * *` UTC) que faz leitura mínima em `usuarios` do banco do ambiente atual para evitar pausa do Supabase gratuito | label `meufenil`/`meufenil-dev` | `api/keepalive.ts`, vercel.json `[CONFIRMED: code, configuration]` | Background job |
| **run_id** | UUID que agrupa os eventos da mesma execução de job | coluna `run_id` | database `[CONFIRMED: database]` | Background job |
| **job_key** | identificador do job (ex.: `keepalive`) | coluna `job_key` | database `[CONFIRMED: database]` | Background job |
| **environment (jobs)** | rótulo do ambiente da execução: `prod` ou `dev` | coluna `environment` | database, code `[CONFIRMED: database, code]` | Background job |
| **Retenção (365 dias)** | regra do trigger de jobs: a cada INSERT, execuções com mais de 365 dias são removidas — aplica-se SOMENTE a `background_job_executions` | retenção da tabela de jobs | migration `[CONFIRMED: migration]` | Background job |
| **Timezone** | fuso do usuário (`usuarios.timezone`, default America/Sao_Paulo) usado em datas (dia corrente, gráficos); timezone do browser usado como fallback no contexto | datas do domínio | database, code `[CONFIRMED: database, code]` | Registro, Exame |

## Conceitos derivados

| Termo | Definição no sistema | Contexto | Evidência | Relacionados |
|---|---|---|---|---|
| **Percentual de consumo** | `(total do dia / limite) × 100`, exibido com barra de progresso; estado "ultrapassou" quando `total > limite` | card "Percentual" do Dashboard | `Dashboard.tsx:47-48` `[CONFIRMED: UI]` | Limite diário |
| **Soft delete / arquivamento (desativação)** | padrão de `referencias` desde a ENH-0004: marcar `is_ativa = false` — pessoais quando há registros vinculados; GLOBAIS sempre (nunca exclusão física pela aplicação); sem perda de favoritos | RPC `remover_ou_desativar_referencia` e UI | database, UI, migration `[CONFIRMED: database, UI, migration 20260904000000]` | Referência ativa/inativa |

## Evidências

- E1 — Termos e textos: páginas da Fase 5 e README `[CONFIRMED: UI, documentation]`
- E2 — Campos e tabelas: catálogo (Fase 2) `[CONFIRMED: database]`
- E3 — Migrations e funções: `supabase/migrations/*` `[CONFIRMED: migration]`

## Veja também

- [overview.md](overview.md), [../domain/domain-model.md](../domain/domain-model.md), [../domain/business-rules.md](../domain/business-rules.md)
