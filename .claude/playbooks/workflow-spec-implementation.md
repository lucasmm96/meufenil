# Workflow — Implementar uma Proposta Existente

0. **Análise prévia (obrigatório — antes de qualquer código, branch ou alteração):** analisar a spec; avaliar viabilidade técnica e funcional; identificar incongruências, lacunas, dependências, riscos e impactos. Apresentar plano contendo: entendimento da spec · viabilidade · incongruências e pontos de atenção · estratégia de implementação · arquivos/componentes afetados · estratégia de testes · riscos e mitigação. **Aguardar aprovação explícita.**
1. Abrir a proposta; verificar Status, Decision, Open Questions, Acceptance Criteria e impactos.
2. Se houver Open Question relevante não resolvida ou Decision ausente: **STOP**.
3. Localizar a Issue canônica (`Issue: #N` no frontmatter ou busca por título `[SPEC-ID]`) e o item do Project.
4. Criar branch `spec/<id>` a partir de `development` → implementar → testar → atualizar Current Specs no mesmo commit.
5. **PUSH: STOP — solicitar autorização explícita** (resumo: branch, commits, testes) antes de qualquer push.
6. Após push: **verificar resultado do CI** (aguardar runs concluírem; verde = prosseguir, vermelho = investigar e reportar ao usuário antes de declarar concluído, distinguindo falhas causadas pela mudança de falhas pré-existentes).
7. Mergear `spec/<id>` em `development` (sem PR). Deletar o branch após o merge (local: `git branch -d spec/<id>`; remota: `git push origin --delete spec/<id>`).
8. Housekeeping **somente após merge em `master`:** validar ACs → marcar proposta `IMPLEMENTED` com **Implemented Through** → mover para `archive/implemented/<categoria>/` → atualizar `proposed/index.md` → fechar a Issue (cadeia CONVENTIONS §18.6) → atualizar Project → validar documentação.
