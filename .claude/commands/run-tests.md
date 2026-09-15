Execute as suítes de verificação do projeto MeuFenil e reporte o resultado:

1. `npm run test:run` — suíte completa (vitest run)
2. `npm run lint` — eslint
3. `npm run build` — tsc -b && vite build

Para cada suíte, informe: comando executado · resultado (passou/falhou) · contagem de testes/erros quando disponível · falhas detalhadas se houver.

Se a suíte de segurança for pulada (describeOrSkip sem SUPABASE_SERVICE_ROLE_KEY), registre como SKIP (não como falha).

Ao final, apresente um resumo consolidado: ✓ passou / ✗ falhou / — skip, por suíte.

Para validação de ACs de uma Spec específica, use o agent `test-manager` via ferramenta Agent.
