# scripts/ai-workflows/

Biblioteca de scripts determinísticos para suporte aos workflows de IA do MeuFenil (ENH-0013).

## Propósito

A IA invoca estes scripts via Bash, lê o JSON de output e age sobre os resultados — sem gastar tokens refazendo dinamicamente processos de fluxo fixo.

## Convenção de invocação

```bash
node scripts/ai-workflows/<script>.js [args]
```

- **stdout:** JSON estruturado (sempre, mesmo em falha parcial)
- **stderr:** mensagens de erro legíveis (apenas quando há falha)
- **exit 0:** sucesso (ou "tudo ok" para scripts de status)
- **exit 1:** falha ou condição de bloqueio detectada

## Scripts disponíveis

| Script | Invocação | Propósito |
|---|---|---|
| `spec-index-check.js` | `node ... spec-index-check.js` | Próximo ID disponível por categoria + consistência do `proposed/index.md` |
| `release-context.js` | `node ... release-context.js [--since=vX.Y.Z]` | Contexto completo para preparar uma release (commits, specs, SEMVER proposto) |
| `wiki-staleness.js` | `node ... wiki-staleness.js` | Detecta páginas wiki com fontes alteradas (migrado de `wiki-precheck.js`) |
| `spec-impl-readiness.js` | `node ... spec-impl-readiness.js --spec <ID>` | Prontidão de uma spec para implementação (status, decision, issue, branch) |
| `spec-housekeeping-status.js` | `node ... spec-housekeeping-status.js --spec <ID>` | Estado do housekeeping pós-merge (arquivo, index, Implemented Through) |
| `test-summary.js` | `node ... test-summary.js [--coverage]` | Executa vitest com reporter JSON e retorna resumo estruturado |
| `spec-locate.js` | `node ... spec-locate.js <query>` | Localiza specs por identificador parcial (ex: `enh2`, `feat15`, `ref`) |

## Distinção frente a outros diretórios

| Diretório | Papel |
|---|---|
| `scripts/ai-workflows/` | Scripts locais invocados pela IA; output JSON; local-first, sem API externa |
| `scripts/spec-github/` | Automação GitHub (sync, gate, verify, reconcile); invocado pelo CI e pela IA |
| `scripts/db/` | CLI de banco e aplicação de migrations; ferramentas operacionais do desenvolvedor |
| `scripts/utils/` | Utilitários avulsos sem domínio definido |

## Regras de lifecycle

1. **Consistência:** quando um processo mudar, o script correspondente deve ser atualizado no mesmo commit.
2. **Local-first:** nenhum script faz chamadas à API do GitHub; campos que dependem de API ficam `null` no JSON.
3. **Sem efeitos colaterais:** scripts de leitura nunca escrevem arquivos; apenas `wiki-staleness.js` pode ser evoluído para gravar o state, mas nunca no estado atual.
4. **Testes obrigatórios:** todo script tem testes vitest com happy path (exit 0, JSON válido) + ao menos um error path (exit 1, stderr). Suite integrada ao CI (W1).
5. **Importações internas:** scripts podem importar de `scripts/spec-github/lib/` via ESM relativo (`../spec-github/lib/`).

## Schema de output — campos obrigatórios

Todo script inclui `generatedAt` (ISO 8601) no JSON de output, para rastreabilidade.
