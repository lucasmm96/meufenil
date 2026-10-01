# Workflow — Implementar uma Proposta Existente

0. **Análise prévia (obrigatório — antes de qualquer código, branch ou alteração):** analisar a spec; avaliar viabilidade técnica e funcional; identificar incongruências, lacunas, dependências, riscos e impactos. Apresentar plano contendo: entendimento da spec · viabilidade · incongruências e pontos de atenção · estratégia de implementação · arquivos/componentes afetados · estratégia de testes · riscos e mitigação. **Aguardar aprovação explícita.**
1. Abrir a proposta; verificar Status, Decision, Open Questions, Acceptance Criteria e impactos.
2. Se houver Open Question relevante não resolvida ou Decision ausente: **STOP**.
3. Localizar a Issue canônica (`Issue: #N` no frontmatter ou busca por título `[SPEC-ID]`) e o item do Project.
4. Criar branch `spec/<id>` a partir de `development` → implementar → testar → atualizar Current Specs no mesmo commit.
5. **PUSH: STOP — solicitar autorização explícita** (resumo: branch, commits, testes, PR proposto) antes de qualquer push.
6. Após push: criar PR `spec/<id>` → `development` com o template (`.github/pull_request_template.md`), linkar `Part of #N`. Aguardar CI verde.
7. Aprovação humana → merge → deletar o branch (local: `git branch -d spec/<id>`; remota: `git push origin --delete spec/<id>`). O número deste PR vai na tabela §23 da release.
8. Housekeeping **somente após merge em `master`:** validar ACs → marcar proposta `IMPLEMENTED` com **Implemented Through** → mover para `archive/implemented/<categoria>/` → atualizar `proposed/index.md` → fechar a Issue (cadeia CONVENTIONS §18.6) → atualizar Project → validar documentação.
