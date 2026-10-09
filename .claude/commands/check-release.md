Verifique se o projeto MeuFenil está pronto para uma nova release:

**Passo 1 — Gate de specs e documentação:**
Execute `npm run spec:github:gate:dry` e interprete o resultado:

- **Verde (pode prosseguir):** liste o que foi verificado e confirme que a release pode ser preparada.
- **Vermelho (bloqueado):** liste cada item bloqueador com a razão, e o que precisa ser resolvido antes da release.

**Passo 2 — Gate de issues Post-Deploy:**
Identifique o milestone ativo (nome do próximo release, ex.: `v1.20.0`) e execute:

```
gh issue list --repo lucasmm96/meufenil --label "Post-Deploy" --milestone "<nome-do-milestone>" --state open --json number,title
```

- **Nenhum issue aberto:** ok, não bloqueia.
- **Issues abertos:** liste-os como bloqueadores. A release NÃO deve ser publicada sem que todos os issues `Post-Deploy` do milestone estejam fechados ou explicitamente adiados com justificativa registrada no issue.

**Resultado combinado:**
Só confirme "pronto para release" se **ambos** os gates passarem.

Após a verificação, indique o próximo passo:
- Se pronto: "Use o agent `release-manager` para preparar a release."
- Se bloqueado: liste os itens a resolver antes de tentar novamente.

Para executar o gate real (não dry-run), use `npm run spec:github:gate`.
