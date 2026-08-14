# Template T2 — Spec de RPC

**Uso:** documentação de funções SQL em `current/database/rpc.md` — uma seção `## public.<funcao>` por função, usando o bloco abaixo.
**Regras:** classificação de evidência obrigatória (ver `CONVENTIONS.md`, seção 3). Autorização descrita como ESTÁ implementada — sem recomendações (recomendações vão para `proposed/`).

---

## public.<funcao>

**Última verificação:** YYYY-MM-DD (commit <sha>)
**Definição em:** <arquivo de migration> | NÃO VERSIONADA (origem: UNKNOWN)

- **Assinatura:** [Preencher — parâmetros, tipo de retorno, linguagem]
- **SECURITY DEFINER?** [Sim | Não] — `search_path`: [Preencher quando aplicável]
- **Autorização implementada:** [Preencher — quem pode chamar e o que a função verifica (ex.: dono, delegado, admin)]
- **Efeitos:** [Preencher — tabelas alteradas, valor retornado, side effects]
- **Erros e edge cases:** [Preencher — o que acontece em cada situação observada]
- **Chamadores no código:** [Preencher — evidência de grep, com caminhos de arquivo]
- **Testes:** [Preencher — links; ou "Nenhum teste identificado" (ausência = fato)]
- **Evidências:** [Preencher — E1, E2...]
