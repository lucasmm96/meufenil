# MeuFenil — Gemini CLI

> Arquivo de configuração para o Gemini CLI. O contexto completo do projeto está em `AGENTS.md`.

## Configuração recomendada

Por padrão, o Gemini CLI usa `GEMINI.md` como arquivo de contexto e não lê `AGENTS.md` automaticamente. Para habilitá-lo, adicione ao `settings.json` do Gemini CLI:

```json
{
  "context": {
    "fileName": ["AGENTS.md", "GEMINI.md"]
  }
}
```

Com essa configuração, o Gemini CLI carregará ambos os arquivos, e `AGENTS.md` fornecerá o contexto completo do projeto.

## Contexto do projeto

Consulte `AGENTS.md` na raiz do repositório para:

- Descrição do projeto e stack.
- Localização e navegação do Specification System (`.ai/specs/`).
- Separação Current × Proposed.
- Carregamento progressivo de contexto (8 passos).
- Workflows, stop conditions e fronteira de decisão humana.
- Papéis dos 9 agentes especializados como comportamento neutro.
- Representação de skills e commands.
- Limitações por ferramenta.

## Limitações

O Gemini CLI não suporta subagentes autônomos nem slash commands — os papéis dos agentes descritos em `AGENTS.md` funcionam como contexto comportamental (instrução de sistema), não como execução isolada.

## Referências

- `AGENTS.md` — instrução universal (Agentic AI Foundation / Linux Foundation).
- `CLAUDE.md` — configuração nativa do Claude Code.
- `.ai/specs/CONVENTIONS.md` — governança completa do projeto.
