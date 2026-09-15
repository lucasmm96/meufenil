# Agentes de Gestão de Projeto

Agents responsáveis por manter a camada operacional do projeto no GitHub (Issues, Project, PRs) em sincronia com as Specs.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Convenções de Tooling](Convencoes-Tooling)

---

## github-manager

**Dono do artefato:** Issues do GitHub.

### Quando invocar

- Criar uma Issue canônica a partir de uma Spec aprovada.
- Atualizar o bloco `SPEC-PROJECTION` quando a Spec muda.
- Adicionar comentário com marker de dedup (`<!-- sync:… -->`).
- Detectar divergências entre Spec e Issue (CASO 3 do CONVENTIONS §18.6).
- Triar Issues externas (abertas por terceiros).

### Quando NÃO invocar

- Para editar specs (use `spec-manager`).
- Para criar PRs (use `pr-manager`).
- Para fechar Issues que representem decisão de negócio — isso é humano (D-12).

### Fronteiras (absolutas)

- Nunca decide aceitar, rejeitar ou encerrar uma Issue por conta própria.
- Nunca inventa estado do GitHub — verifica via API antes de qualquer ação.
- Idempotente: verifica se a Issue já existe (por `Issue:` no frontmatter ou label `spec:<ID>`) antes de criar.
- Deduplicação via campo `Issue:` no frontmatter da Spec ou label `spec:<ID>`; comentários com marker `<!-- sync:… -->`.

### Exemplo de invocação

```
Crie a Issue canônica para a FEAT-0020.
```

---

## pr-manager

**Dono do artefato:** Pull Requests.

### Quando invocar

- Criar um PR a partir de uma work branch, com o template `.github/pull_request_template.md`.
- Linkar o PR à Issue canônica via `Part of #N` (nunca `Closes`).
- Verificar se um PR já existe para a branch antes de criar outro.

### Quando NÃO invocar

- Para merge sem aprovação humana explícita.
- Para aprovar o próprio PR.
- Para criar Issues (use `github-manager`).

### Fronteiras (absolutas)

- Nunca faz merge sem aprovação humana explícita.
- Nunca aprova o próprio PR.
- Idempotente: verifica PR existente por branch antes de criar.

### Exemplo de invocação

```
Crie o PR para a branch feature/feat-0020-slug com base no template.
```

---

## project-manager

**Dono do artefato:** GitHub Project (dashboard do backlog).

### Quando invocar

- Sincronizar Status dos items do Project com o estado atual das Specs (Status derivado, §10.2 do CONVENTIONS).
- Ajustar Priority sob instrução explícita.
- Marcar/limpar "Bloqueado" (com razão em comentário do Issue).
- Gerar relatório de backlog.
- Verificar cobertura (toda Spec ativa tem item no Project?).

### Quando NÃO invocar

- Para criar Issues (use `github-manager`).
- Para editar specs (use `spec-manager`).
- Para decidir priorização por conta própria.

### Fronteiras (absolutas)

- **Status NUNCA transiciona por conta própria** — Project é derivado das Specs; a transição segue a Spec.
- Idempotente: sync duas vezes não duplica items nem regrava valores idênticos.

### Exemplo de invocação

```
Sincronize o status do Project com o estado atual das Specs.
```
