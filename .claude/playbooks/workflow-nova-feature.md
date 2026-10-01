# Workflow — Nova Feature

```
Pedido → verificar proposta existente → (não há?) criar Proposed Feature [proposal-template] + Issue canônica + item no Project
→ APROVAÇÃO HUMANA (Decision na Spec) → ACCEPTED → Feature Spec → work branch feature/<id>-<slug> → Implementation → Tests
→ Validation → Update Current Specs → Update Proposed status → System Map
→ PR (Part of #N) → aprovação humana → merge → housekeeping (ACs → IMPLEMENTED → archive/ → Issue fechada → Project)
→ validação da documentação
```

Nenhuma feature sem specification. Se a solicitação vier com especificação completa e autorização explícita, prossiga respeitando segurança/arquitetura/dados.

**Scripts:** `node scripts/ai-workflows/spec-index-check.js` → próximo ID disponível por categoria (invocar antes de criar a spec, para não reutilizar IDs).
