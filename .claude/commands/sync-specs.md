Sincronize as Specs do MeuFenil com os Issues do GitHub:

1. Execute `npm run spec:github:sync:dry` e apresente o output completo (o que seria criado/atualizado).
2. Pergunte: "Confirma a execução do sync real? (sim/não)"
3. Somente após confirmação explícita execute `npm run spec:github:sync`.
4. Informe o resultado: Issues criadas, atualizadas, ignoradas.

Notas:
- O sync nunca fecha Issues (fechamento segue D-12 do CONVENTIONS §18.6 — decisão humana).
- Se houver erro de credenciais ou API, reporte o erro e pare.
- Para sincronizar o Project (Status derivado), use `npm run spec:project:sync:dry` / `spec:project:sync` separadamente.
