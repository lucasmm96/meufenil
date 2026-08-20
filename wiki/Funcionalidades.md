# Funcionalidades do MeuFenil

Catálogo de funcionalidades implementadas e planos futuros do MeuFenil. Cada item implementado corresponde a uma Feature Spec em `.ai/specs/current/features/` (IDs FEAT-0001 a FEAT-0014).

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
| FEAT-0006 | Histórico de registros | implementada | Lista de registros de consumo agrupados por dia, com filtros por período e exclusão individual. |
| FEAT-0007 | Estatísticas + exportação | implementada | Análise por período (semana/mês): total, média diária e maior consumo, com gráfico e exportação em CSV ou JSON. |
| FEAT-0008 | Referências alimentares | implementada | Catálogo de alimentos com fenilalanina por 100g: busca, filtros, ordenação, favoritos, criação/edição e desativação/reativação/remoção (globais × personalizadas). |
| FEAT-0009 | Exames PKU | implementada | Registro e acompanhamento de exames laboratoriais: resumo (último exame, variação, total), gráfico de histórico e lista com exclusão. |
| FEAT-0010 | Perfil do usuário + privacidade | implementada | Gestão de nome e limite diário; exportação de dados (JSON) e exclusão de conta com dupla confirmação. |
| FEAT-0011 | Delegação de acesso (login-as) | implementada | Concessão/revogação de acesso para outros usuários operarem em seu nome (ex.: nutricionistas e cuidadores), com aviso visual e retorno à própria conta. |
| FEAT-0012 | Painel administrativo | implementada | Visão administrativa (somente leitura) de usuários, uso do banco de dados e monitoramento de background jobs (filtros, paginação, detalhes). |
| FEAT-0013 | Background jobs (keepalive) | implementada | Infraestrutura server-side de rotinas em background com persistência centralizada; job atual: keepalive diário dos projetos Supabase. |
| FEAT-0014 | PWA / multi-dispositivo | implementada (parcial) | Instalação como aplicativo em dispositivos móveis/desktop (manifest, ícones, tema). Sem suporte offline (sem service worker). |

> Status "implementada" conforme as Feature Specs de `current/features/` (todas com status Implementada na última verificação). Para detalhes técnicos, veja as specs: `.ai/specs/current/features/`. (Fonte: `current/features/FEAT-0001` a `FEAT-0014`)

## Em breve (propostas ativas)

As propostas abaixo estão em `.ai/specs/proposed/` com status **PROPOSED** — são **planos futuros, ainda não implementados**. Nada aqui representa comportamento atual do sistema. (Fonte: `proposed/index.md`)

| ID | Tipo | Proposta | Status |
|---|---|---|---|
| FEAT-0016 | FEAT | Geração automática da documentação pública via agente wiki-documenter | IMPLEMENTATION (em implementação) |
| FEAT-0015 | FEAT | Fluxo de atribuição de papel admin | PROPOSED |
| FEAT-0002 | FEAT | Exportar o histórico de medições em CSV | PROPOSED |
| ENH-0001 | ENH | PWA offline / service worker | PROPOSED |
| ENH-0002 | ENH | Identidade de bot para PRs criados pelo Claude | PROPOSED |
| REF-0001 | REF | Consolidar modal de concessão duplicado | PROPOSED |
| REF-0002 | REF | Destino das RPCs órfãs de dashboard | PROPOSED |
| DEBT-0005 | DEBT | Pendências de lint em src/ (57 erros pré-existentes) | PROPOSED |
| SEC-0001 | SEC | Autorização das funções de consulta sem verificação interna | PROPOSED |
| TEST-0002 | TEST | Suítes de segurança para policies não cobertas | PROPOSED |
| TEST-0003 | TEST | Testes server-side (edge functions, triggers, CLI) | PROPOSED |
| TEST-0004 | TEST | Completar testes de services faltantes | PROPOSED |
| TEST-0005 | TEST | Determinismo dos testes de segurança | PROPOSED |

> Observação: existem duas propostas distintas com o ID "FEAT-0002" — a **implementada** (Consentimento LGPD, em `current/features/`) e a **proposta** "Exportar o histórico de medições em CSV" (em `proposed/features/`), que é um plano futuro. Elas não se referem à mesma coisa.
