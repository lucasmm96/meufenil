# Agente Wiki (wiki-documenter)

O `wiki-documenter` gera e atualiza a documentação pública do MeuFenil (pasta `wiki/`) a partir do Specification System e do código, de forma incremental.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Convenções de Tooling](Convencoes-Tooling)

---

## Quando invocar

- Gerar ou atualizar as páginas da wiki após mudanças no Specification System ou no código.
- Incorporar documentos antigos fornecidos pelo autor (validados contra as specs atuais).
- Geração completa: quando `wiki/.wiki-state.json` não existe ou fontes principais mudaram.
- Geração incremental (padrão): regenera apenas páginas cujas fontes mudaram (hash-based).

## Quando NÃO invocar

- Para fazer push do wiki para o GitHub — o agent gera os arquivos localmente; push é manual.
- Para alterar specs ou código — o agent é somente leitor/gerador de documentação.
- Para criar páginas de how-to sobre o próprio tooling — essas páginas são mantidas manualmente (como esta).

## Estratégia incremental (hash-based)

1. Lê `wiki/.wiki-state.json` (estado anterior, não versionado).
2. Para cada página, calcula o hash combinado dos arquivos fonte relevantes.
3. Se o hash não mudou, pula a geração (preserva edições manuais na página).
4. Se mudou, regenera completamente e atualiza o estado.
5. Salva o novo estado em `wiki/.wiki-state.json`.

O script `scripts/wiki-precheck.js` pode ser executado antes da invocação do agent para computar deterministicamente quais páginas precisam regeneração — o agent lê o relatório e salta direto para a geração de conteúdo.

## Páginas gerenciadas

| Página | Fontes principais |
|---|---|
| `Home.md` | system-map, domain/business-rules |
| `Guia-Usuario.md` | current/features/, current/product/, current/domain/ |
| `Guia-Desenvolvedor.md` | features, architecture, frontend, backend, database, testing |
| `Arquitetura.md` | current/architecture/, current/security/ |
| `Funcionalidades.md` | current/features/, proposed/features/ |
| `Referencias-Tecnicas.md` | current/database/, current/backend/ |
| `_Sidebar.md` | derivada da lista de páginas |
| `_Footer.md` | fixo — o agent não modifica |

As páginas de how-to sobre tooling de IA (como esta) não são gerenciadas pelo wiki-documenter — são mantidas manualmente.

## Especificações por página

Antes de gerar qualquer página, o agent lê `.claude/agents/references/wiki-page-specs.md` — contém as especificações detalhadas por página (estrutura de seções, fontes, regras de incorporação de documentos antigos).

## Fronteiras (absolutas)

- Nunca inventa informações — toda afirmação técnica deve ser respaldada por uma fonte.
- Não faz push automático.
- Não altera specs ou código.
- `wiki/.wiki-state.json` não é versionado (coberto pelo `.gitignore`).
- `[UNKNOWN]` é reportado ao usuário, nunca preenchido por conveniência.

## Stop conditions

PARE e reporte ao usuário quando:
- `UNKNOWN` afetar o conteúdo de uma página.
- Spec e código se contradizerem sem explicação.
- Documento antigo sem correspondência nas specs atuais (não descarta por conta própria).
- A estrutura de páginas precisar mudar (exige autorização).

## Exemplo de invocação

```
Execute o wiki-documenter para atualizar a documentação após a implementação da FEAT-0020.
```
