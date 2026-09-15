# Agentes de Release

Agents responsáveis pelo lifecycle de release do MeuFenil — da preparação até o pós-publicação.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Convenções de Tooling](Convencoes-Tooling)

---

## release-manager

**Dono do artefato:** lifecycle de release (branch, PR, notas, draft release).

### Quando invocar

- Preparar uma nova release: criar branch `release/vX.Y.Z`, gerar/revisar as notas, criar PR de release, preparar Release DRAFT no GitHub.
- Propor versão SEMVER com rationale (baseado no conteúdo das mudanças).
- Verificar rastreabilidade pós-publicação (W6): toda Spec → Issue → PR → Release.
- Fechar o milestone após publicação.

### Quando NÃO invocar

- Para criar a tag git ou publicar a release — isso é humano.
- Para fazer push em branch protegida — isso é humano.
- Para decidir a versão final — o agent propõe, o humano decide.

### Fluxo de release

```
release-manager invocado
  → release-notes analisa git + specs (invocado via orquestrador)
  → release-manager propõe versão SEMVER
  → humano decide versão
  → release-manager: branch release/vX.Y.Z + PR + Release DRAFT
  → humano: aprova PR + cria tag + publica release
  → release-manager: pós-publicação (fecha milestone, verifica rastreabilidade W6)
```

### Fronteiras (absolutas)

- Nunca cria tag nem publica release — prepara e propõe.
- Nunca push em branch protegida (`development`, `master`).
- Nunca decide a versão — propõe com rationale.
- Idempotente: reexecutar não duplica comentário nem DRAFT — verifica estado via API.
- `UNKNOWN` é reportado, nunca preenchido.

### Exemplo de invocação

```
Prepare a release v2.0.0 a partir do estado atual do development.
```

---

## release-notes

**Dono do artefato:** release notes (texto, tabela de rastreabilidade §23).

Este agent é **subordinado ao release-manager** — invocado pelo orquestrador ao preparar uma release. Pode ser invocado diretamente para análise de histórico.

### Quando invocar

- Reconstruir a história de mudanças entre duas tags a partir do git e das specs.
- Classificar mudanças (features, correções, infrastructure, breaking changes).
- Redigir release notes em pt-BR no padrão do projeto.

### Quando NÃO invocar

- Para executar ações de git — somente lê o histórico.
- Para decidir versão ou publicar release.
- Como ponto de entrada do lifecycle de release — use `release-manager`.

### Como encontra o padrão de estilo

Busca dinamicamente os últimos 4 arquivos de análise de release em `.ai/.temp/analyses/` com `ls .ai/.temp/analyses/ | grep -E '^[0-9]+-release' | sort | tail -4` — garante que usa sempre o padrão mais recente (arquivos de referência histórica: `15-publicacao-v1.6.1.md`, `32-release-v1.7.0.md`).

### Fronteiras (absolutas)

- `UNKNOWN` é reportado, nunca preenchido.
- Não executa ações de git.
- Não decide versão; não publica release.
