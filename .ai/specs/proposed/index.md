# Proposed — Catálogo de Evoluções Possíveis

**Última verificação:** 2026-08-15 (DEBT-0003)

> ⚠️ Este diretório contém POSSIBILIDADES FUTURAS. NADA aqui é comportamento atual, decisão tomada ou plano comprometido. Status inicial de toda proposta: **PROPOSED**. O estado atual do sistema está documentado exclusivamente em `../current/`.

## Catálogo

| ID | Type | Title | Status | Source |
|---|---|---|---|---|
| [FEAT-0001](features/FEAT-0001-atribuicao-papel-admin.md) | FEAT | Fluxo de atribuição de papel admin | PROPOSED | U-7.2; R-003 (análise 23) |
| [ENH-0001](enhancements/ENH-0001-pwa-offline.md) | ENH | PWA offline / service worker | PROPOSED | FEAT-0014; U-5.2 |
| [REF-0001](refactors/REF-0001-modal-concessao-duplicado.md) | REF | Consolidar modal de concessão duplicado | PROPOSED | Divergência Fase 5 |
| [REF-0002](refactors/REF-0002-rpcs-orfas-dashboard.md) | REF | Destino das RPCs órfãs de dashboard | PROPOSED | Fase 4; O-003 (análise 25) |
| [DEBT-0001](technical-debt/DEBT-0001-ddl-nao-versionado.md) | DEBT | Versionar objetos sem DDL | IMPLEMENTED | Fase 2; O-002 (análise 25) — migration 20260814000000 (dev e prod) |
| [DEBT-0002](technical-debt/DEBT-0002-limite-diario-default-duplicado.md) | DEBT | Limite diário default duplicado (500 × 150) | IMPLEMENTED | R-002 (análise 23); BR-025 — migration 20260815000000 (dev e prod) |
| [DEBT-0003](technical-debt/DEBT-0003-atualizar-readme.md) | DEBT | Atualizar README (documentation drift) | IMPLEMENTED | Drift Fases 4 e 7 — README.md corrigido (2026-08-15) |
| [DEBT-0004](technical-debt/DEBT-0004-reconciliar-templates.md) | DEBT | Reconciliar templates e convenções do Specification System | IMPLEMENTED | O-001/R-004/R-001 (análises 23–25) — Fase 12 |
| [SEC-0001](security/SEC-0001-autorizacao-funcoes-consulta.md) | SEC | Autorização das funções de consulta sem verificação interna | PROPOSED | Fatos Fase 3 |
| [TEST-0001](testing/TEST-0001-testes-paginas-componentes.md) | TEST | Cobertura de testes de páginas e componentes | IMPLEMENTED | GAP-001/002/003/010 — testes de Perfil, Referencias, Dashboard, AdicionarRegistro e ConsentimentoLGPD (2026-08-15) |
| [TEST-0002](testing/TEST-0002-suites-seguranca-policies.md) | TEST | Suítes de segurança para policies não cobertas | PROPOSED | GAP-007/012 |
| [TEST-0003](testing/TEST-0003-testes-server-side.md) | TEST | Testes server-side (edge functions, triggers, CLI) | PROPOSED | GAP-005/006/008 |
| [TEST-0004](testing/TEST-0004-testes-services-faltantes.md) | TEST | Completar testes de services faltantes | PROPOSED | GAP-004/009 |
| [TEST-0005](testing/TEST-0005-determinismo-testes-seguranca.md) | TEST | Determinismo dos testes de segurança | PROPOSED | GAP-011 + O-004 |

## Como usar este catálogo

- Cada proposta descreve o estado ATUAL (com link para `../current/`) e o estado PROPOSTO — nunca confunda os dois.
- Nenhuma proposta é aprovada/priorizada por estar aqui. Fluxo de aprovação: revisão humana → possível conversão em feature spec (promoção segue o checklist de `../CONVENTIONS.md` seção 10) → implementação.
- Propostas agrupam múltiplas evidências (ex.: TEST-0001 consolida GAP-001/002/003/010). Mapeamento completo no relatório `.ai/.temp/analyses/26-catalogo-propostas.md`.
- Novas categorias SEC e TEST adicionadas nesta fase (extensão registrada — ver DEBT-0004).
