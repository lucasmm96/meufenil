# Revisão de Tooling AI do projeto MeuFenil

## Contexto

Este é um projeto spec-driven. O repositório concentra, além do código-fonte,
todo o material de governança em `.ai/` (specs, convenções, ADRs, análises) e o
tooling de AI em `.claude/` (agents, e possivelmente outros itens). Existe uma
wiki do projeto em `github.com/lucasmm96/meufenil/wiki` (`meufenil.wiki.git`) e o
próprio projeto já possui agentes/automações que lidam com ela — **descubra essas
convenções antes de agir, não invente**.

Sua missão é revisar, propor e executar melhorias no tooling de AI do projeto e,
**ao final**, documentar tudo na wiki existente.

## Objetivo

1. Inventariar tudo que existe hoje em termos de ferramentas Claude Code no
   projeto (agents, skills, slash commands — e qualquer outra primitiva que
   você encontrar ou julgar pertinente propor).
2. Avaliar qualidade, consistência, sobreposição e lacunas nos agents existentes.
3. Propor melhorias nos agents, novas skills, novos slash commands, e —
   se fizer sentido — outros itens (hooks, output styles, permissões em
   `settings.json`, servidores MCP, `CLAUDE.md` por subdiretório). Para cada
   sugestão fora do escopo conhecido do usuário, **explique o que é, para que
   serve e por que vale a pena antes de pedir decisão**.
4. Ao final, produzir documentação técnica completa na wiki, em PT-BR, voltada
   a humanos, em sub-páginas — refletindo **somente o que já for realidade**
   após as execuções aprovadas.

## Escopo de exploração

Explore o repositório inteiro. Priorize, nesta ordem:

- `.ai/` — toda a estrutura (specs, `CONVENTIONS.md`, `CLAUDE.md`, ADRs,
  análises, drafts, templates, index.md).
- `.claude/` — `agents/`, e o que mais existir (`skills/`, `commands/`,
  `hooks/`, `settings.json`, output styles).
- `CLAUDE.md` (raiz e subdiretórios), `.mcp.json`, `.gitignore`.
- `package.json`, `scripts/` e demais automações do ecossistema.
- Código-fonte — **apenas como contexto**, para validar hipóteses e detectar
  drift entre o que está documentado como tooling e o que o projeto realmente é.
  Se você identificar que uma construção concreta justifica um agent/skill de
  domínio, registre como sugestão e explique.

**Regra transversal:** antes de propor qualquer coisa, entenda o estado atual.
Leia os agents existentes por inteiro, entenda como se relacionam (quem invoca
quem, quem é dono de qual artefato, qual a fronteira humana), e descubra como a
wiki é atualizada hoje (existe agent/script para isso?). Não invente
convenções — siga as que já existem.

## Fases

### Fase 1 — Descoberta e inventário (sem escrever nada ainda)

Percorra o repositório e produza um **inventário factual**:

- Agents existentes: nome, propósito, tools, fronteira (o que faz / o que não faz).
- Skills existentes (se houver): nome, escopo, formato.
- Slash commands existentes (se houver).
- Outros itens de tooling que você encontrar.
- Como o projeto hoje lida com a wiki: qual agent/script/convenção, qual a
  estrutura de páginas atual, qual o fluxo de publicação.
- Convenções relevantes de `.ai/` que os agents devem seguir (evidências,
  lifecycle, sincronização, fronteiras humanas — D-12 etc.).

Marque tudo com as tags de evidência do projeto (`[CONFIRMED]` com fonte,
`[INFERRED]` com `Basis:`, `[ASSUMED]`, `[UNKNOWN]` com `Evidence Needed:`),
conforme as convenções já vigentes em `.ai/`.

### Fase 2 — Documento de plano (obrigatório antes de qualquer criação/edição)

Escreva um documento de plano em `.ai/.temp/analyses/` (siga a convenção de
nomes que já existir lá; se não houver, use algo como
`YYYY-MM-DD-tooling-ai-revisao.md`).

O plano deve conter:

1. Inventário (resumo da Fase 1).
2. **Oportunidades identificadas**, agrupadas por tema, cada uma com:
   - Achado (o que existe / o que falta) com evidência.
   - Proposta (melhorar agent X, criar skill Y, criar command Z, ou
     sugerir primitiva nova — hooks, output styles, permissões, MCP,
     `CLAUDE.md` por subdiretório).
   - Justificativa (por que vale a pena).
   - Impacto (o que muda no projeto se for feito).
   - Risco / custo.
   - Alternativas consideradas.
3. **Ordem de execução sugerida** (o que depende de quê).
4. **Rascunho da estrutura da wiki** (sub-páginas propostas, com títulos).

Apresente o plano e **aguarde decisão item a item**. Não execute nada antes
disso.

### Fase 3 — Decisão interativa (agrupada por tema)

Conduza o usuário pelas decisões em **blocos temáticos** (ex.: "bloco 1 —
melhorias em agents existentes"; "bloco 2 — novas skills"; "bloco 3 — slash
commands"; "bloco 4 — itens fora do escopo conhecido"). Para cada bloco:

- Apresente os itens do plano com contexto suficiente para decisão.
- Para itens fora do escopo conhecido do usuário (hooks, output styles,
  permissões, MCP, subdir `CLAUDE.md`), explique **o que é, para que serve e
  o trade-off** antes de perguntar.
- Registre a decisão (aprovar / rejeitar / adiar / modificar) no plano.

Não avance para a Fase 4 enquanto houver itens do bloco atual sem decisão.

### Fase 4 — Execução

Para cada item aprovado:

- **Editar agents existentes**: você pode editar diretamente após a confirmação
  do usuário na Fase 3. Mostre o diff proposto, espere confirmação explícita
  ("pode aplicar"), e então aplique.
- **Criar novas skills**: siga o formato vigente do Claude Code
  (`.claude/skills/<nome>/SKILL.md` + auxiliares em `references/`, `scripts/`,
  `assets/` se fizer sentido). Frontmatter com `name` e `description` claras
  (a `description` define quando o Claude carrega a skill — seja específico).
- **Criar slash commands**: siga o formato vigente (`.claude/commands/*.md`).
- **Outros itens** (hooks, output styles, permissões, MCP, subdir `CLAUDE.md`):
  siga o formato vigente, e informe o usuário sobre qualquer arquivo de
  configuração que precise ser tocado.
- **Após cada criação/edição**, atualize o plano com o estado atual.

Mantenha o padrão do projeto: idempotência, evidência, fronteira humana
explícita (nada de decisões de negócio/governança por conta própria), nunca
commit / nunca push.

### Fase 5 — Documentação na wiki (somente ao final, após tudo pronto e aprovado)

Só comece esta fase quando **todas as execuções da Fase 4 estiverem concluídas
e aprovadas**. A wiki reflete **somente o que já é realidade** — nada de
"proposto", nada de rascunho.

- **Público:** humanos.
- **Idioma:** PT-BR.
- **Formato:** sub-páginas na wiki existente
  (`github.com/lucasmm96/meufenil/wiki`, `meufenil.wiki.git`).
- **Como publicar:** descubra e reuse as convenções/automações que o projeto
  já tem para atualizar a wiki. Se houver agent/script dedicado, use-o. Se não
  houver, siga o fluxo git padrão do wiki (`meufenil.wiki.git`) e **peça
  confirmação antes de qualquer push**.

Estrutura sugerida (ajuste conforme o que a revisão revelar, e confirme com o
usuário antes de publicar):

- Página índice (hub do tooling de AI) linkando as sub-páginas.
- Sub-página por agent — propósito, quando é invocado, tools, fronteira,
  regras, stop conditions.
- Sub-página por skill — o que é, quando carrega, o que contém.
- Sub-página por slash command — o que faz, quando usar.
- Sub-página de convenções transversais (evidências, lifecycle, dedup,
  fronteira humana D-12) — o que todo agent segue.
- Sub-página de integrações (MCP, wiki, scripts de automação) — se aplicável.
- Sub-página de como contribuir/evoluir o tooling.

Cada sub-página deve ser **técnica e completa**, com exemplos concretos
extraídos do próprio repositório. Nada genérico, nada de "boilerplate de
documentação". Escreva como quem explica o projeto para outro engenheiro que
vai mexer nele.

## Restrições (absolutas)

- **Nunca** commit, nunca push, nunca criar branch ou PR sem confirmação
  explícita — e mesmo assim, apenas quando o usuário pedir.
- **Nunca** tocar em `current/` (só propor, se algo precisar mudar lá).
- **Nunca** criar Issues ou mexer no Project do GitHub — isso é de outros
  agents do projeto (siga a fronteira já estabelecida no repo).
- **Nunca** alterar `Status:` de specs nem campos de decisão humanos.
- **Nunca** inventar estado — verifique tudo via leitura de arquivos.
- **Nunca** avançar de fase sem fechar a anterior (exceto se o usuário pedir).
- **Nunca** aplicar mudanças em agents/skills/commands sem confirmação
  explícita, mesmo que já tenha sido aprovado no plano — mostre o diff e
  espere o "pode aplicar".

## Stop conditions

PARE e reporte quando:

- Encontrar incongruência entre o que os agents dizem fazer e o que o projeto
  realmente tem (não assuma qual está certo — pergunte).
- Uma sugestão depender de decisão humana de negócio/governança.
- Houver conflito entre convenções do `.ai/` e o que o Claude Code vigente
  permite (ex.: skills não suportadas na versão instalada — nesse caso, proponha
  o material como "pronto para quando for suportado" e sinalize).
- Qualquer edição exigir mudança fora do escopo aprovado.

Ao parar, explique sempre: (1) o achado; (2) por que é ambíguo; (3) as
alternativas; (4) qual decisão precisa ser tomada.

## Comece por

1. Ler `CLAUDE.md` (raiz), `.ai/CLAUDE.md`, `.ai/specs/CLAUDE.md` (se existirem)
   e as convenções relevantes de `.ai/`.
2. Listar `.claude/` inteiro e ler todos os agents por completo.
3. Descobrir como a wiki é atualizada hoje (agents/scripts dedicados).
4. Só então começar a Fase 1.