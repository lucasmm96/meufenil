Verifique se o projeto MeuFenil está pronto para uma nova release:

Execute `npm run spec:github:gate:dry` e interprete o resultado:

- **Verde (pode prosseguir):** liste o que foi verificado e confirme que a release pode ser preparada.
- **Vermelho (bloqueado):** liste cada item bloqueador com a razão, e o que precisa ser resolvido antes da release.

Após a verificação, indique o próximo passo:
- Se pronto: "Use o agent `release-manager` para preparar a release."
- Se bloqueado: liste os itens a resolver antes de tentar novamente.

Para executar o gate real (não dry-run), use `npm run spec:github:gate`.
