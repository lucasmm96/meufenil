# Referência: Especificações de páginas da wiki — wiki-documenter

> Este arquivo é lido pelo agent wiki-documenter no início de cada geração de páginas.
> Contém regras por página e instruções de incorporação de documentos antigos.

---

## Regras por página

### Para `Home.md`

- Título: "MeuFenil - Controle da Fenilalanina"
- Parágrafo introdutório explicando o propósito.
- Links principais: "Guia do Usuário", "Guia do Desenvolvedor", "Arquitetura", "Funcionalidades", "Referências Técnicas".
- Seção "Sobre o projeto" com informações gerais (open source, licença, etc.).

### Para `Guia-Usuario.md`

- Título: "Guia do Usuário"
- Sumário (TOC).
- Seções baseadas nas features de `current/features/` que impactam diretamente o usuário final:
  - Autenticação e primeiro acesso
  - Registro diário de consumo
  - Acompanhamento do limite diário
  - Dashboard
  - Histórico de registros
  - Estatísticas
  - Referências alimentares
  - Exames PKU
  - Perfil do usuário
  - Delegação de acesso para nutricionistas
  - Consentimento LGPD
  - PWA (instalação, offline)
- Para cada seção, descrever o que o usuário pode fazer, com exemplos práticos e instruções passo a passo, sem termos técnicos.
- Incluir uma seção "Perguntas Frequentes" com base em gaps comuns.

### Para `Guia-Desenvolvedor.md`

- Título: "Guia do Desenvolvedor"
- Sumário (TOC).
- Seções:
  - **Requisitos** (Node/Bun, Supabase, Docker, etc.)
  - **Configuração do ambiente** (clonagem, instalação, variáveis de ambiente, link com Supabase)
  - **Estrutura do projeto** (visão geral dos diretórios principais)
  - **Fluxo de desenvolvimento spec-driven** (explicar como as specs são usadas, workflow de features, bugs, propostas)
  - **Padrões de código** (resumo ou link para a spec)
  - **Testes** (estratégia, como executar)
  - **Banco de dados** (migrations, RLS, RPC, CLI, Edge Functions – detalhes técnicos)
  - **Deploy** (ambientes, release)
  - **Como contribuir** (abrir issues, PRs, convenções)
- Incluir citações de fontes entre parênteses, ex: `(Fonte: FEAT-0003 - Registro Diário de Consumo)` e `(Verificado em: src/react-app/pages/Dashboard.tsx:45-67)`.

### Para `Arquitetura.md`

- Título: "Arquitetura do MeuFenil"
- Sumário (TOC).
- Diagrama Mermaid mostrando as camadas (Frontend (React/Vite) → Supabase (Postgres + Auth + Edge Functions) → Vercel (keepalive)).
- Explicação de cada camada, fluxos de dados (autenticação, consultas, RPCs, Edge Functions), autorização (RLS).
- Citações de fontes (especificamente de `architecture/overview.md`, `security/security-model.md`, etc.).

### Para `Funcionalidades.md`

- Título: "Funcionalidades do MeuFenil"
- Sumário (TOC).
- Lista de todas as features implementadas (extraídas de `current/features/`), com:
  - Nome e ID (ex: FEAT-0003 – Registro Diário de Consumo)
  - Descrição curta (2-3 linhas do que a feature faz)
  - Status (implementada)
  - Link para a spec (opcional, se o dev quiser aprofundar)
- Também incluir uma seção "Em breve" com as propostas ativas de `proposed/features/` (status PROPOSED), com indicação de que são planos futuros.

### Para `Referencias-Tecnicas.md`

- Título: "Referências Técnicas"
- Sumário (TOC).
- Detalhamento técnico de:
  - **Banco de Dados**: lista de tabelas, colunas principais, RLS (resumo das políticas), RPCs, triggers.
  - **Edge Functions**: lista de funções, propósito, como são deployadas (resumo do conteúdo de `backend/edge-function-*.md`).
  - **Background Jobs**: o que existe e como operam.
  - **CLI Interna**: comandos disponíveis, como usar.
  - **Migrations**: fluxo de criação e aplicação (inspirado no documento antigo, mas atualizado).
- Citações de fontes (specs, códigos, migrations).

### Para `_Sidebar.md`

- Título: "Índice"
- Lista com links para todas as páginas, em ordem lógica:
  - Home
  - Guia do Usuário
  - Guia do Desenvolvedor
  - Arquitetura
  - Funcionalidades
  - Referências Técnicas
- (Opcional) Separar em seções "Para usuários" e "Para desenvolvedores".

### Para `_Footer.md`

- Conteúdo fixo: "_MeuFenil - Documentação técnica, instruções e informações de funcionamento do sistema._"
- O agente **não deve modificar** este arquivo.

---

## Incorporação de documentos antigos

Os seguintes documentos foram fornecidos (ou estão disponíveis no histórico):
- `Supabase-‐-Ambientes-e-Migrations.md`
- `Supabase-‐-Edge-Functions.md`
- `CLI-Interna-Supabase-(RLS‐aware).md`
- `Padrões-de-Código.md`

Para cada um:
1. Ler o documento.
2. Comparar seu conteúdo com as specs atuais (em `current/database/`, `current/backend/`, `current/frontend/` etc.).
3. Se o conteúdo ainda for válido e não estiver obsoleto, incorporá‑lo nas páginas adequadas (ex: informações sobre migrations → `Referencias-Tecnicas.md` e `Guia-Desenvolvedor.md`; padrões de código → `Guia-Desenvolvedor.md`).
4. Se estiver parcialmente desatualizado, atualizar com base nas specs e código atuais (usando as fontes atuais como verdade).
5. Se estiver totalmente obsoleto ou sem correspondência, ignorar (não incorporar).
