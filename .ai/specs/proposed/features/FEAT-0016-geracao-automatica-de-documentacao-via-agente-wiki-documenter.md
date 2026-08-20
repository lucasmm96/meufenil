# FEAT-0016 — Geração automática da documentação pública via agente wiki-documenter

**Type:** FEAT
**Status:** PROPOSED
**Issue:** #36
**Title:** Geração automática da documentação pública via agente wiki-documenter
**Created on:** 2026-08-20

## Problem

A documentação pública do MeuFenil (wiki) está parcialmente desatualizada e não reflete todo o conhecimento capturado no Specification System (`current/`). Manter a wiki manualmente é trabalhoso e sujeito a erros, especialmente quando novas features são implementadas ou o código evolui. Além disso, a wiki atual contém documentos antigos que podem estar desatualizados ou duplicados em relação às specs.

## Current State

- Existe uma wiki pública em `https://github.com/lucasmm96/meufenil/wiki` com algumas páginas (Home, Padrões de Código, Supabase Ambientes e Migrations, Edge Functions, CLI Interna).
- Essas páginas foram escritas manualmente e podem não refletir o estado atual do projeto.
- O repositório possui um Specification System completo (`current/` e `archive/`) com toda a verdade sobre a aplicação (features, regras de negócio, arquitetura, banco, frontend, backend, segurança, testes).
- Recentemente implementamos um workflow de sincronização unidirecional (repo → wiki) que copia arquivos `.md` da pasta `wiki/` para o repositório da wiki, mas o conteúdo precisa ser gerado.

## Proposed State

Criar um agente especializado no Claude Code (`wiki-documenter`) que, sob demanda (comando manual), analisa todo o repositório (specs, código, commits, documentos antigos) e gera/atualiza a documentação pública na pasta `wiki/` de forma incremental, respeitando:
- Atualização apenas das páginas cujas fontes mudaram (hash-based).
- Estrutura definida (Guia do Usuário, Guia do Desenvolvedor, Arquitetura, Funcionalidades, Referências Técnicas, etc.).
- Sumário automático em páginas longas.
- Citações de fontes apenas na documentação para devs.
- Incorporação de documentos antigos (revalidados) e descarte de obsoletos.
- Menção a propostas futuras (proposed/) em seção de roadmap, com indicação de não implementado.

## Motivation

- **FACTUAL:** a documentação pública atual não cobre todas as features do sistema; os guias de usuário e dev estão incompletos.
- **ASSUMPTION:** ter uma documentação pública atualizada aumenta a transparência do projeto open source, facilita onboarding de novos colaboradores e melhora a experiência dos usuários finais.
- **ASSUMPTION:** automatizar a geração reduz o custo de manutenção e garante consistência com o estado real do sistema.

## Evidence

- Especificações completas em `.ai/specs/current/` (features, frontend, backend, database, security, testing, domain, architecture).
- Documentos antigos na wiki (enviados pelo autor) e no repositório (ex: `docs/`).
- Sincronização já implementada via GitHub Actions (`sync-wiki.yml`).

## Scope

- Criação do agente `.claude/agents/wiki-documenter.md` com prompt detalhado.
- Geração/atualização dos seguintes arquivos na pasta `wiki/`:
  - `Home.md`
  - `Guia-Usuario.md`
  - `Guia-Desenvolvedor.md`
  - `Arquitetura.md` (com diagramas Mermaid)
  - `Funcionalidades.md`
  - `Referencias-Tecnicas.md`
  - `_Sidebar.md` (índice)
  - `_Footer.md` (fixo)
- O agente deve usar estratégia incremental: armazenar hashes dos arquivos fonte (specs, código, etc.) e regenerar apenas páginas impactadas.
- O agente deve ser invocado manualmente via comando no Claude Code.

## Out of Scope

- Automação via GitHub Actions (a geração permanece manual).
- Tradução para outros idiomas (inicialmente apenas pt-BR).
- Geração de diagramas interativos ou imagens (apenas Mermaid).
- Sincronização bidirecional (wiki → repo) – mantida apenas unidirecional.

## Impacted Features

- Nenhuma feature existente é alterada; apenas documentação gerada.

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend: N/A
- Backend: N/A
- Database: N/A
- Security: N/A
- Tests: N/A

## Dependencies

- Claude Code com acesso ao repositório.
- Agente `wiki-documenter` criado.

## Risks

- Geração incorreta se o agente não interpretar corretamente as specs ou o código.
- Páginas muito grandes podem ficar verbosas; o sumário ajuda, mas é necessário garantir concisão.
- O agente pode consumir muitos tokens se a lógica de diff não for eficiente; o hash incremental mitigará.

## Alternatives

- **A.** Manter documentação manual (status quo) – alto custo de manutenção.
- **B.** Gerar tudo do zero a cada execução – maior consumo de tokens e perda de edições manuais.
- **C.** Agente incremental (proposta) – equilibra custo e precisão.

**Decision:** TBD – a escolha é humana; na aprovação registrar **Approved by:** e **Approved on:**.

## Open Questions

- Como o agente deve lidar com edições manuais feitas diretamente na pasta `wiki/`? Serão preservadas se as fontes não mudarem.
- Qual o formato do arquivo de estado (hashes)? Sugestão: `wiki/.wiki-state.json` (não versionado ou versionado? Melhor não versionar, pois é local; mas pode ser versionado para rastrear mudanças? Decisão: não versionar, gerado localmente pelo agente).

## Acceptance Criteria

- [ ] Agente `wiki-documenter` existe e é invocável via `/agent wiki-documenter` no Claude Code.
- [ ] Ao executar, ele analisa as specs e código, e gera/atualiza as páginas conforme estrutura definida.
- [ ] Páginas geradas incluem sumário automático (TOC) no topo (quando aplicável).
- [ ] Citações de fontes aparecem apenas em `Guia-Desenvolvedor.md`, `Arquitetura.md` e `Referencias-Tecnicas.md`.
- [ ] Documentos antigos fornecidos são incorporados quando válidos; os obsoletos são descartados.
- [ ] Propostas futuras (proposed/) são mencionadas em seção de roadmap, com status PROPOSED.
- [ ] Execuções subsequentes regeneram apenas páginas afetadas por mudanças nas fontes (comprovado por logs).
- [ ] A pasta `wiki/` ao final contém todos os arquivos esperados e a wiki pública sincronizada via workflow existente.

## References

- `.ai/specs/current/`
- `.ai/specs/archive/`
- Documentos antigos: `Supabase-*-.md`, `CLI-Interna-*.md`, `Padrões-de-Código.md`
- `CLAUDE.md` (seção de agentes)
- `CONVENTIONS.md` (seções 8, 10, 18)