import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Carrega todas as variáveis de .env.development para o ambiente de teste.
// Necessário para testes de segurança que usam Supabase client com service_role.
const env = loadEnv('development', __dirname, '')

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    // Suítes REAL (Abordagem B) compartilham o MESMO dev DB com dados reais.
    // A RPC restaurar_referencias_de_backup (FEAT-0017 M5) reescreve o
    // catálogo global por design — com arquivos em paralelo ela corromperia
    // fixtures das suítes irmãs (M1–M4) a cada run. Execução serial dos
    // arquivos elimina o flake; o happy path do restore roda em transação PG
    // com rollback (zero persistência), ver rpc-referencias-sync-rollback.
    fileParallelism: false,
    // Passa variáveis de ambiente para os arquivos de teste.
    // process.env.SUPABASE_SERVICE_ROLE_KEY é necessário para Abordagem B.
    env: Object.fromEntries(
      Object.entries(env).filter(([key]) =>
        // Inclui apenas variáveis não-VITE_ que não seriam carregadas
        // automaticamente pelo Vite no modo 'test'
        !key.startsWith('VITE_')
      )
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@skeletons': path.resolve(__dirname, './src/react-app/skeletons'),
    },
  },
})
