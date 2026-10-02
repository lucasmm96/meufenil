# Workflow — Bug

```
Reproduzir → CURRENT behavior → EXPECTED behavior → verificar spec → teste de regressão
→ corrigir → testes → validar → avaliar documentação
```

Se o comportamento atual contradiz a spec: **STOP** — determine se o código está errado, a spec está obsoleta ou o requisito mudou; se não for possível determinar, peça decisão humana. Não assuma automaticamente que a spec está errada.

**Scripts:** `node scripts/ai-workflows/spec-locate.js <id>` → localizar o arquivo de spec a verificar.
