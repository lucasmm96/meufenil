# Archive — Propostas em Estado Terminal

**Regra (ADR-0012, 2026-08-16):** `../proposed/` contém SOMENTE propostas ativas (PROPOSED / ACCEPTED / IMPLEMENTATION). Quando uma proposta atinge estado terminal, o arquivo é movido para cá — UMA única vez, no MESMO commit da transição, com todos os links atualizados (`../proposed/index.md` preserva a linha com o novo caminho; nunca apagar linha).

## Estrutura

```
archive/
├── implemented/    ← IMPLEMENTED (Implemented Through preenchido)
│   ├── features/ · enhancements/ · refactors/ · technical-debt/ · security/ · testing/
├── rejected/       ← REJECTED (razão registrada na Spec)
│   └── (mesmas 6 subcategorias)
└── superseded/     ← SUPERSEDED (substituta indicada)
    └── (mesmas 6 subcategorias)
```

## Regras

- O histórico é preservado pelo git (o caminho antigo permanece no histórico) e pelo catálogo único `../proposed/index.md`.
- A Spec arquivada mantém todos os campos de ciclo de vida preenchidos (Decision, Implemented Through / Rejected on / Superseded by) e o campo `Issue: #N` da Issue canônica.
- Subdiretórios são criados no primeiro uso; este README é a definição canônica da estrutura.
- Os 5 IMPLEMENTED que ainda estão em `../proposed/` (DEBT-0001/0002/0003/0004, TEST-0001) serão movidos para cá no retrofit histórico (Fase 8 do ecossistema — ver Blueprint v1.1).
