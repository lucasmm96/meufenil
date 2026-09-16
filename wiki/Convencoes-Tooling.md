# Convenções de Tooling

Regras e convenções que governam o uso das ferramentas de IA no MeuFenil.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Como Contribuir com o Tooling](Como-Contribuir-Tooling)

---

## Evidências — nunca transforme UNKNOWN em CONFIRMED sem evidência

Toda afirmação em specs, agents, release notes ou documentação deve ter uma das quatro tags de evidência:

| Tag | Significado | Uso |
|---|---|---|
| `[CONFIRMED]` | Evidência direta, com fonte | Sempre cite a fonte |
| `[INFERRED]` | Derivada de evidências | Exige bloco `Basis:` com a cadeia de raciocínio |
| `[ASSUMED]` | Hipótese temporária | Nunca use como fato definitivo |
| `[UNKNOWN]` | Não determinado | Registre `Evidence Needed:` quando útil |

**Regra:** `UNKNOWN` não significa "escolha o que parece melhor". Se afeta a implementação: **STOP** e reporte a lacuna. Se não afeta: continue e registre.

---

## Fronteira humana — decisões que são sempre do humano

| Decisão | Código |
|---|---|
| Aceitar/rejeitar/encerrar Issues | D-12 |
| Aprovar PRs | D-12 |
| Aprovar/fechar specs (transições Decision) | D-12 |
| Decidir versão SEMVER de release | D-12 |
| Push para qualquer branch | D-13 |
| Criar tag git | D-13 |
| Publicar release no GitHub | D-13 |
| Fechar Issues que representem decisão de negócio | D-12 |
| Aplicar migrations em produção | D-13 |

**D-12** = fronteira do review humano (aceitação, aprovação, fechamento).  
**D-13** = fronteira de publicação/distribuição (push, tag, release pública).

O agent pode propor, preparar e recomendar — nunca decidir unilateralmente nessas fronteiras.

---

## Deduplicação de Issues

Issues canônicas (criadas pelo `github-manager` a partir de Specs) são deduplicadas via:
1. **Campo `Issue:` no frontmatter da Spec** — contém o número da Issue (`#N`).
2. **Label `spec:<ID>`** — label no GitHub que marca a Issue como canônica de uma Spec.
3. **Marker em comentários** — `<!-- sync:… -->` nos comentários de update.

Nunca crie uma Issue sem verificar se já existe por esses mecanismos.

---

## Sem IA em automação (ADR-0013)

GitHub Actions e scripts de CI/CD são **100% determinísticos**:
- Proibido: `ANTHROPIC_API_KEY` em Actions, Claude Code Action, `repository_dispatch` para IA.
- Issues externas recebem resposta estática (workflow W3 via `issue-responder.js`).
- Gate de release é computacional (workflow W7 via `release-gate.js`).

Toda invocação de IA é manual, interativa, local.

---

## Idempotência dos agents

Todos os agents devem ser idempotentes:
- Executar um agent duas vezes com o mesmo input não deve criar duplicatas, reescrever valores idênticos, ou produzir efeitos colaterais.
- Antes de criar um artefato (Issue, PR, spec, arquivo), o agent verifica se já existe.

---

## Um dono por artefato

| Artefato | Dono |
|---|---|
| Issues GitHub | `github-manager` |
| Pull Requests | `pr-manager` |
| GitHub Project | `project-manager` |
| Release lifecycle | `release-manager` |
| Release notes | `release-notes` |
| Specs (`.ai/specs/`) | `spec-manager` |
| Propostas (`proposed/`) | `spec-assistant` |
| Verificação / testes | `test-manager` |
| Wiki (`wiki/`) | `wiki-documenter` |

Agents não chamam outros agents. O Claude principal (sessão interativa) orquestra — invocando um agent de cada vez via ferramenta Agent.

---

## Stop conditions — quando parar e reportar

Os agents param e reportam ao humano quando:
- `UNKNOWN` afeta o comportamento ou a decisão.
- Código contradiz spec.
- Duas specs se contradizem.
- Schema, migration, RLS ou RPC seria alterado.
- Autorização ou segurança seria alterada.
- Nova decisão arquitetural necessária.
- Fronteira humana (D-12/D-13) atingida.

Ao parar, o agent explica: (1) o que foi encontrado; (2) por que é ambíguo; (3) alternativas; (4) qual decisão precisa ser tomada. Nunca implementa parcialmente "para resolver depois".
