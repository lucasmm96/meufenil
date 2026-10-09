# Funcionalidades do MeuFenil

Catálogo de funcionalidades implementadas e planos futuros do MeuFenil. Cada item implementado corresponde a uma Feature Spec em `.ai/specs/current/features/` (IDs FEAT-0001 a FEAT-0014, FEAT-0015, FEAT-0017 e FEAT-0018).

## Sumário

- [Funcionalidades implementadas](#funcionalidades-implementadas)
- [Em breve (propostas ativas)](#em-breve-propostas-ativas)

## Funcionalidades implementadas

| ID | Funcionalidade | Status | Descrição |
|---|---|---|---|
| FEAT-0001 | Autenticação (Google OAuth + sessão) | implementada | Entrada com conta Google e manutenção de sessão; perfil criado automaticamente no primeiro acesso com limite diário de 500 mg. |
| FEAT-0002 | Consentimento LGPD | implementada | Aceite obrigatório para coleta e processamento de dados antes do uso, com registro da data do consentimento. |
| FEAT-0003 | Registro diário de consumo | implementada | Registro de consumo (alimento + peso) com cálculo automático de fenilalanina; exclusão de registros. Base do dashboard, histórico e estatísticas. |
| FEAT-0004 | Limite diário personalizado | implementada | Teto pessoal de fenilalanina por dia (padrão 500 mg), com indicadores de total, percentual, restante e alerta de ultrapassagem. |
| FEAT-0005 | Dashboard diário | implementada | Visão do dia: consumo total vs. limite, percentual com barra de progresso, restante, gráfico dos últimos 7 dias e alerta de ultrapassagem. |
| FEAT-0006 | Histórico de registros + exportação | implementada | Lista de registros de consumo agrupados por dia, com filtros por período, exclusão individual e exportação do histórico filtrado em CSV, JSON ou PDF. O arquivo exportado inclui identificação do paciente e período. (Exportação implementada via FEAT-0002 arquivada.) |
| FEAT-0007 | Estatísticas + exportação | implementada | Análise por período (semana/mês): total, média diária e maior consumo, com gráfico e exportação em CSV ou JSON. |
| FEAT-0008 | Referências alimentares | implementada | Catálogo de alimentos com fenilalanina por 100g: busca (por nome ou marca), filtros, ordenação, favoritos e criação/edição com nome + marca opcional. Desde a ENH-0004, a identidade de referências globais é imutável: editar uma global = arquivar e criar a nova; globais nunca são excluídas fisicamente (arquivamento sempre, por admin) e reativação de global é exclusiva de admin. Desde a ENH-0008, nome e marca são exibidos em Title Case na UI independentemente da caixa armazenada no banco (o banco permanece verbatim, fiel à origem ANVISA). |
| FEAT-0009 | Exames PKU | implementada | Registro e acompanhamento de exames laboratoriais: resumo (último exame, variação, total), gráfico de histórico e lista com exclusão. |
| FEAT-0010 | Perfil do usuário + privacidade | implementada | Gestão de nome e limite diário; exportação de dados (JSON) e exclusão de conta com dupla confirmação. |
| FEAT-0011 | Delegação de acesso (login-as) | implementada | Concessão/revogação de acesso para outros usuários operarem em seu nome (ex.: nutricionistas e cuidadores), com aviso visual e retorno à própria conta. |
| FEAT-0012 | Painel administrativo | implementada | Visão administrativa (somente leitura) de usuários, uso do banco de dados e monitoramento de background jobs (filtros, paginação, detalhes). Desde o FEAT-0017 (M6), inclui seções de sincronização de referências, curadoria de pendências (aprovação/rejeição individual e em lote, botão "Aprovar tudo") e recuperação (rollback/restauração). Desde o FEAT-0015, inclui seção de gestão de papéis de usuário (badge Admin/Usuário, botões "Tornar admin" / "Remover admin") com enforcement via RPC. |
| FEAT-0013 | Background jobs (keepalive) | implementada | Infraestrutura server-side de rotinas em background com persistência centralizada; job atual: keepalive diário dos dois projetos Supabase (prod e dev). O cron semanal de sincronização de referências (FEAT-0017) usa a mesma plataforma Vercel Cron com tabela própria. |
| FEAT-0014 | PWA / multi-dispositivo | implementada (parcial) | Instalação como aplicativo em dispositivos móveis/desktop (manifest, ícones, tema). Sem suporte offline (sem service worker). |
| FEAT-0015 | Gestão de papéis de usuário (admin) | implementada | Seção "Gestão de Papéis" no painel administrativo: badge de papel (Admin/Usuário) e botões "Tornar admin" / "Remover admin" para cada usuário; botão desabilitado na própria linha do admin logado. Alterações de papel executadas exclusivamente via RPC SECURITY DEFINER `toggle_role_usuario` — único caminho de escrita para `usuarios.role`. Column-level REVOKE em `authenticated` bloqueia UPDATE direto via API. |
| FEAT-0017 | Sincronização de referências (ANVISA/Power BI) | implementada | Mecanismo recorrente, controlado e auditável de sincronização do conjunto global de referências com a origem (relatório Power BI associado à ANVISA): extração, validação (com rejeição de duplicidades conflitantes por par inteiro — BR-044), snapshot/backup por execução, aplicação automática de mudanças seguras (cron semanal Vercel) e curadoria humana de divergências no painel admin (individual e em lote, com "Aprovar tudo"), com rollback seletivo e restauração excepcional auditados. Valores de fenilalanina exibidos com precisão de 2 casas decimais em toda a UI. |
| FEAT-0018 | Central de Notificações ao Usuário | implementada | Canal estruturado de comunicação assíncrona app → usuário. Badge no header com contagem de não lidas, atualizada em tempo real via Supabase Realtime (subscription em `notificacoes` por `user_id`). Painel overlay que abre ao clicar no sino sem mudar de rota. Tipos suportados: `system_event`, `admin_message`, `health_alert`, `app_update`; campo `type` é string livre — extensível sem alteração de schema. Admin pode enviar notificações broadcast ou para usuário específico via painel administrativo. Durante login-as, badge e feed exibem notificações do usuário assumido. Alerta de saúde (`health_alert`) gerado automaticamente por trigger ao atingir o limite diário. Notificações persistem por até 30 dias; limpeza via Vercel Cron diário (`api/notificacoes-cleanup.ts`, `0 4 * * *`). Requer a aplicação da migration em produção (Issue #119) para estar operacional. |

> Status "implementada" conforme as Feature Specs de `current/features/` (todas com status Implementada na última verificação). Para detalhes técnicos, veja as specs: `.ai/specs/current/features/`. (Fonte: `current/features/FEAT-0001` a `FEAT-0014`, `FEAT-0015`, `FEAT-0017` e `FEAT-0018`)
>
> Nota (v1.20.0 / ENH-0014): o footer passou a exibir a versão do app em linha única — `© {ano} MeuFenil · v{versão} · Todos os direitos reservados.` — e a página Sobre exibe um badge de versão. A versão é injetada em build-time via `define` em `vite.config.ts` (lendo `package.json`), sem overhead de runtime. (Issue #115, PR #117)
>
> Observação histórica: a FEAT-0016 (geração automática desta documentação via agente wiki-documenter) foi implementada e arquivada como IMPLEMENTED — esta wiki é o seu resultado (Fonte: `proposed/index.md` — linha FEAT-0016).

## Em breve (propostas ativas)

As propostas abaixo estão em `.ai/specs/proposed/` com status **PROPOSED** — são **planos futuros, ainda não implementados**. Nada aqui representa comportamento atual do sistema. (Fonte: `proposed/index.md` — 3 propostas ativas)

| ID | Tipo | Proposta | Status |
|---|---|---|---|
| ENH-0001 | ENH | PWA offline / service worker | PROPOSED |
| SEC-0001 | SEC | Autorização das funções de consulta sem verificação interna | PROPOSED |
| DEBT-0007 | DEBT | Gate de validação não cobre rotas Vercel em modo Node.js ESM | PROPOSED |

> Observação: o ID "FEAT-0002" foi usado para duas features distintas — a spec atual (Consentimento LGPD, `current/features/FEAT-0002-consentimento-lgpd.md`) e a spec arquivada (Exportar histórico, `archive/implemented/features/FEAT-0002-exportar-historico.md`). A exportação foi implementada via PR #107 (2026-10-02) e aparece incorporada na descrição da FEAT-0006 acima.
>
> Observação: DEBT-0005 (pendências de lint), DEBT-0006 (restauração do keepalive dev), ENH-0003 (seletor de page size no Admin), ENH-0004 (modelo canônico de referências) e REF-0004 (automação do gate de release) foram implementados e saíram do catálogo ativo (arquivados como IMPLEMENTED — Fonte: `proposed/index.md`).
