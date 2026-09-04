# Product Overview — MeuFenil

**Última verificação:** 2026-09-04 (ENH-0004 — contagem do seed ANVISA corrigida para 2.959)

## Propósito do produto

MeuFenil é uma aplicação open source (MIT, sem fins lucrativos) para **controle pessoal da ingestão diária de fenilalanina**, com foco em apoio a pessoas com Fenilcetonúria (PKU) e seus cuidadores. **Não substitui acompanhamento médico ou nutricional** (aviso explícito no README) `[CONFIRMED: documentation — README.md]`.

## Problema que resolve

A dieta de PKU é extremamente restritiva; o produto oferece organização, clareza e autonomia no controle diário do consumo de fenilalanina, incluindo dados iniciais de alimentos baseados em tabelas públicas da ANVISA e cadastro de alimentos próprios `[CONFIRMED: documentation — README.md; database — seed ANVISA com 2.959 INSERTs em referencias (contagem conferida em 2026-09-04; as specs que citavam 2.958 estavam incorretas)]`.

## Usuários (observados, não personas inventadas)

| Tipo | Evidência |
|---|---|
| Paciente PKU (usuário final) | fluxos de consumo, exames, perfil `[CONFIRMED: UI]` |
| Cuidador (via delegação de acesso) | mecanismo login-as permite operar em nome de outro usuário `[CONFIRMED: database, UI — delegacoes_acesso]` |
| Administrador (role admin em `usuarios`) | painel administrativo com usuários, estatísticas e jobs `[CONFIRMED: database, UI — Admin.tsx]` |
| Desenvolvedor/operador | CLI e script de migrations `[CONFIRMED: code]` |

## Principais capacidades (implementadas)

1. Autenticação via Google OAuth (Supabase Auth) `[CONFIRMED: code]`.
2. Registro diário de consumo com cálculo automático de fenilalanina `[CONFIRMED: code, UI]`.
3. Limite diário personalizado com indicadores (total, percentual, restante, alerta de ultrapassagem) `[CONFIRMED: UI — Dashboard]`.
4. Referências alimentares (globais ANVISA e personalizadas) com busca, filtros, favoritos, ordenação e gestão (criar/editar/desativar/reativar/remover) `[CONFIRMED: UI — Referencias]`.
5. Histórico agrupado por dia com filtros por período e exclusão `[CONFIRMED: UI — Historico]`.
6. Estatísticas por período (semana/mês) com gráfico e exportação CSV/JSON `[CONFIRMED: UI, code — Estatisticas]`.
7. Exames de PKU com tendência, histórico e gráfico `[CONFIRMED: UI — Exames]`.
8. Delegação de acesso (login-as) entre usuários `[CONFIRMED: database, UI]`.
9. Painel administrativo (usuários, uso do banco, monitoramento de jobs) `[CONFIRMED: UI — Admin]`.
10. Exportação de dados do perfil (JSON) e exclusão de conta `[CONFIRMED: UI, code — Perfil]`.
11. PWA instalável (manifest; sem service worker/offline) `[CONFIRMED: configuration — ../frontend/overview.md]`.
12. Infraestrutura de background jobs (keepalive diário com persistência e retenção) `[CONFIRMED: code — ../backend/]`.

## Principais entidades

Usuário · Referência · Registro de consumo · Exame PKU · Delegação de acesso · Favorito · Execução de background job — detalhe em [../domain/domain-model.md](../domain/domain-model.md).

## Principais fluxos do produto

1. Primeiro acesso e login (Google OAuth → perfil criado automaticamente com limite 500 mg)
2. Consentimento LGPD (modal obrigatório até aceite)
3. Registrar consumo (busca alimento → peso → cálculo → registro)
4. Acompanhar o dia (dashboard com limite)
5. Revisar histórico e estatísticas (com exportação)
6. Gerenciar referências (globais × próprias)
7. Registrar e acompanhar exames
8. Delegar/assumir acesso e retornar à própria conta
9. Administrar usuários e jobs
10. Exportar dados e excluir conta

Detalhe em [../domain/business-rules.md](../domain/business-rules.md) e no relatório da fase (`.ai/.temp/analyses/23-documentacao-product-domain.md`).

## Áreas da aplicação

9 páginas (`/`, `/dashboard`, `/referencias`, `/historico`, `/estatisticas`, `/perfil`, `/exames`, `/sobre`, `/admin`) — ver [../frontend/overview.md](../frontend/overview.md).

## Limites observáveis do produto

- Sem suporte offline (sem service worker) `[CONFIRMED: ausência — filesystem]`.
- Registros não podem ser editados — apenas criados e excluídos (sem política UPDATE) `[CONFIRMED: database]`.
- Não substitui acompanhamento médico (aviso do produto) `[CONFIRMED: documentation]`.
- Gratuito; planos gratuitos de Supabase/Vercel com limites exibidos no painel admin (500 MB banco, 1 GB storage, ~50.000 usuários ativos/mês — texto fixo na UI) `[CONFIRMED: UI — Admin.tsx:296-314]`.
- Exportação abrange dados do perfil (usuário + registros) e estatísticas agregadas — não outros dados (exames, referências) `[CONFIRMED: code — Perfil.tsx:76-104]`.

## Integrações (o que existe de fato)

| Integração | Uso | Evidência |
|---|---|---|
| Supabase (Auth, Postgres/RLS/RPC, Edge Functions) | autenticação, banco, 2 funções edge | Fases 2–4 |
| Google OAuth | login | `useUser.ts` |
| Vercel (serverless + cron) | keepalive diário | `vercel.json`, `api/keepalive.ts` |
| ANVISA (dados iniciais) | seed de referências globais (2.959 INSERTs) | `migrations/dados.sql` |
| GitHub | apenas repositório (sem CI/CD versionado) | filesystem |

## Plataforma

SPA web (React 19 + Vite) com suporte multi-dispositivo via PWA instalável; hospedagem Vercel; sem servidor de aplicação próprio `[CONFIRMED: configuration, code — ../frontend/overview.md, ../backend/overview.md]`.

## Evidências

- E1 — README.md (propósito, avisos, stack) `[CONFIRMED: documentation]`
- E2 — UI: textos e fluxos das 9 páginas (Fase 5) `[CONFIRMED: UI]`
- E3 — Banco: 7 tabelas, políticas, seed ANVISA (Fase 2) `[CONFIRMED: database]`
- E4 — Backend: keepalive/edge functions/CLI (Fase 4) `[CONFIRMED: code]`

## Veja também

- [glossary.md](glossary.md), [../domain/domain-model.md](../domain/domain-model.md), [../domain/business-rules.md](../domain/business-rules.md)
- [../system-map.md](../system-map.md)
