# Agente de Verificação (test-manager)

O `test-manager` é o dono da verificação do MeuFenil — executa suítes e valida Acceptance Criteria com evidência rastreável.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Convenções de Tooling](Convencoes-Tooling)

---

## Quando invocar

- Executar as suítes de verificação (`npm run test:run`, `npm run lint`, `npm run build`) e reportar com evidência.
- Validar Acceptance Criteria de uma Spec específica — correlacionando cada AC com testes e resultado.
- Detectar regressões ou flakiness (testes que passam/falham intermitentemente).
- Produzir relatório de validação para o PR ou para decisão de release.

## Quando NÃO invocar

- Para executar as suítes apenas para ver o resultado rápido — use o slash command `/run-tests` (mais leve, sem overhead de agent).
- Para escrever testes de implementação — responsabilidade do Claude principal, não do test-manager.
- Para fazer commit ou merge de resultados.

## O que valida

- **Testes unitários/integração:** `npm run test:run` (vitest run — suíte completa).
- **Lint:** `npm run lint` (eslint).
- **Build:** `npm run build` (tsc -b && vite build).
- **Testes de segurança:** quando `SUPABASE_SERVICE_ROLE_KEY` está disponível, testes de segurança são executados com auth real.
- **ACs:** cada critério de aceitação de uma Feature Spec é verificado com evidência (teste específico que o cobre, output real, linha de código).

## O que NÃO valida (fronteiras)

- **Suíte vermelha:** reporta com output completo — nunca mascara falhas. Se um teste falhar, o relatório inclui o output completo do vitest.
- **Regressão:** se um teste existente quebrar, reporta imediatamente antes de continuar.
- **SKIP legítimo:** `describeOrSkip` sem `SUPABASE_SERVICE_ROLE_KEY` é registrado como SKIP (não como falha).

## Fronteiras (absolutas)

- Nunca altera testes existentes para "passar".
- Nunca faz commit nem merge.
- Idempotente: repetir a validação produz o mesmo relatório (com data e contagens).
- Suíte vermelha é reportada com output completo — nunca mascarada.

## Relação com `/run-tests`

O slash command `/run-tests` é uma alternativa leve para execução rotineira das três suítes. Quando você precisa apenas saber se os testes passam (sem correlação com ACs), use `/run-tests`. Quando precisa validar que uma feature específica cumpre seus ACs, use o `test-manager`.

## Exemplo de invocação

```
Valide os ACs da FEAT-0020 com evidência, executando as suítes relevantes.
```
