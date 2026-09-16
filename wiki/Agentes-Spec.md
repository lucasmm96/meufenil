# Agentes de Spec

Agents responsáveis pelo Specification System do MeuFenil — criação, edição, arquivamento e auditoria de specs.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Convenções de Tooling](Convencoes-Tooling)

---

## spec-manager

**Dono do artefato:** Specs do MeuFenil (`.ai/specs/`).

### Quando invocar

- Criar ou editar specs em `proposed/` usando os templates vigentes.
- Manter `proposed/index.md` atualizado.
- Registrar campos de decisão quando autorizados pelo humano (ex.: Decision: ACCEPTED).
- Arquivar specs em `archive/` após implementação.
- Drift check: auditar consistência Spec↔Issue↔Project.

### Quando NÃO invocar

- Para criar Issues no GitHub (use `github-manager`).
- Para implementar código — o agent não toca o código da aplicação.
- Para tomar decisões de aprovação — registra e reporta, nunca decide.

### Fronteiras (absolutas)

- Nunca inventa — usa evidências `[CONFIRMED]`/`[INFERRED]`/`[ASSUMED]`/`[UNKNOWN]` (CONVENTIONS §3).
- Transições de decisão (PROPOSED → ACCEPTED → IMPLEMENTED) são exclusivamente humanas.
- Idempotente: repetir a operação não duplica arquivos nem campos.
- Nunca push/tag.

### Exemplo de invocação

```
Registre Decision: ACCEPTED na ENH-0005, aprovado por Lucas Martins Menezes em 2026-09-15.
```

---

## spec-assistant

**Dono do artefato:** rascunhos e propostas (`proposed/`).

### Quando invocar

- Transformar drafts ou ideias em linguagem natural em specs formais via diálogo estruturado com o `proposal-template`.
- Refinar propostas existentes (com confirmação explícita).
- Verificar duplicatas em `proposed/` e `archive/` antes de criar uma nova spec.
- Sugerir o próximo ID disponível por categoria.
- Dividir propostas multi-categoria usando o campo `Dependencies`.

### Quando NÃO invocar

- Para criar Issues no GitHub (use `github-manager`).
- Para implementar código.
- Para decidir aprovação de uma proposta.

### Fluxo de autoria

```
Ideia / draft → spec-assistant
  → verifica duplicatas
  → sugere ID e categoria
  → abre diálogo estruturado com proposal-template
  → preenche campos (Status: PROPOSED, Decision: TBD)
  → salva em proposed/<categoria>/<ID>-<slug>.md
  → (se veio de draft) move draft para draft/archive/
  → humano revisa → aprovação → spec-manager registra Decision
```

### Fronteiras (absolutas)

- Status inicial sempre `PROPOSED`; Decision inicial sempre `TBD`.
- Nunca inventa — campos sem evidência ficam como `[UNKNOWN]`.
- Transições de decisão são exclusivamente humanas.
- Idempotente: não duplica arquivos.
- Nunca push/tag/Issues.

### Skill relacionada

A skill `spec-navigation` pode ser carregada automaticamente ao navegar no Specification System — ver [Skills e Commands](Skills-e-Commands).

### Exemplo de invocação

```
Quero propor uma feature de exportação de dados em CSV. Me ajude a formalizar como spec.
```
