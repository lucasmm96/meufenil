# Template — Business Rule (BR)

**Uso:** regras de negócio CONFIRMADAS em `current/domain/business-rules.md` (agrupadas por categoria). Uma BR expressa a REGRA — implementação e testes são citados por links, nunca copiados.
**Regras:** somente criar BR quando o comportamento puder ser confirmado (Evidence Model — `CONVENTIONS.md`). Status de cobertura é factual: `Confirmed + tested` · `Confirmed + partially tested` · `Confirmed + untested` · `Inferred` · `Unknown` — regras sem confirmação NÃO entram como fato.

---

### BR-NNN — <Nome>

- **Tipo:** cálculo | validação | autorização | ownership | delegação | lifecycle | limite | exportação | exclusão | retenção | UI behavior | integração
- **Given:** [Preencher — pré-condição da regra]
- **When:** [Preencher — gatilho]
- **Then:** [Preencher — comportamento resultante]
- **Evidence:** `[CONFIRMED: fonte — arquivo:linha]`
- **Implementation:** [Preencher — links para as specs de camada que implementam]
- **Tests:** [Preencher — arquivos de teste reais; "Sem teste" (ausência = fato)]
- **Related Features:** [Preencher — links para FEATs; N/A]
- **Related Specs:** [Preencher — links]
- **Unknowns:** [Preencher — "Nenhum" quando não houver]
- **Status:** Confirmed + tested | Confirmed + partially tested | Confirmed + untested | Inferred | Unknown

---

### Compatibilidade com BRs existentes

As 33 BRs existentes (Fases 7) seguem este formato; novos campos (Applies To) são cobertos por **Related Features**. A matriz BR × Implementation × Spec × Test consolidada vive em [`current/domain/traceability.md`](../current/domain/traceability.md) — não duplicar nas BRs.
