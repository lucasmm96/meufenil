/**
 * Test helpers para testes de segurança com autenticação real do Supabase.
 *
 * Abordagem B: Supabase JS client com JWTs reais.
 *
 * Variáveis de ambiente necessárias:
 *   VITE_SUPABASE_URL      — carregada automaticamente pelo Vite
 *   VITE_SUPABASE_ANON_KEY — carregada automaticamente pelo Vite
 *   SUPABASE_SERVICE_ROLE_KEY — carregada via vitest.setup.ts
 *
 * Nenhuma credencial é exposta em logs ou saída de testes.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Carregamento de variáveis de ambiente (fallback robusto)
// ---------------------------------------------------------------------------

/**
 * Carrega .env.development SOBRESCREVENDO valores carregados previamente.
 *
 * MOTIVO: O Vite/vitest carrega .env.local (criado pelo Vercel CLI) em
 * todos os modos. O .env.local contém VITE_SUPABASE_URL apontando para
 * um projeto Supabase diferente do usado em desenvolvimento.
 *
 * O .env.development contém as credenciais corretas para o ambiente
 * de desenvolvimento. Precisamos garantir que elas tenham precedência
 * sobre .env.local no contexto de testes.
 *
 * A ordem de precedência do Vite é: .env.[mode] > .env.local > .env.
 * Mas o vitest usa mode='test' e NÃO carrega .env.development.
 * Portanto, fazemos isso manualmente aqui.
 */
function loadEnvDevelopmentWithOverride(): void {
  const envFile = path.resolve(process.cwd(), ".env.development");
  if (!fs.existsSync(envFile)) return;

  const content = fs.readFileSync(envFile, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Sobrescreve sempre — .env.development tem precedência sobre .env.local
    process.env[key] = value;
  }
}

// Carrega no momento da importação, sobrescrevendo qualquer valor anterior
loadEnvDevelopmentWithOverride();

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

let _anonClient: SupabaseClient | null = null;
let _adminClient: SupabaseClient | null = null;

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 10) {
    throw new Error(
      `${name} não está definida ou parece inválida no ambiente de teste. ` +
      `Verifique se .env.development existe na raiz do projeto e contém ${name}.`
    );
  }
  return value;
}

export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    const url = requireEnvVar("VITE_SUPABASE_URL");
    const key = requireEnvVar("VITE_SUPABASE_ANON_KEY");
    _anonClient = createClient(url, key);
  }
  return _anonClient;
}

export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    const url = requireEnvVar("VITE_SUPABASE_URL");
    const key = requireEnvVar("SUPABASE_SERVICE_ROLE_KEY");
    _adminClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _adminClient;
}

// ---------------------------------------------------------------------------
// Usuários de teste
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: "user" | "admin";
}

let testUserCounter = 0;

function uniqueTestEmail(role: string): string {
  testUserCounter += 1;
  const ts = Date.now();
  return `test.security.${role}.${ts}.${testUserCounter}@meufenil-test.local`;
}

/**
 * Cria um usuário de teste via Admin API (service_role).
 * O trigger handle_new_user cria automaticamente o registro em public.usuarios.
 */
export async function createTestUser(
  role: "user" | "admin" = "user"
): Promise<TestUser> {
  const admin = getAdminClient();
  const email = uniqueTestEmail(role);
  const password = `test-${crypto.randomUUID()}`;

  const { data: authUser, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${role}` },
  });

  if (error || !authUser.user) {
    const details = error
      ? `status=${error.status} message=${error.message} name=${error.name}`
      : "authUser.user is null";
    throw new Error(`Falha ao criar usuário de teste: ${details}`);
  }

  // Se for admin, atualizar a role em public.usuarios
  if (role === "admin") {
    await admin
      .from("usuarios")
      .update({ role: "admin" })
      .eq("id", authUser.user.id);
  }

  return {
    id: authUser.user.id,
    email,
    password,
    role,
  };
}

/**
 * Autentica como um usuário de teste e retorna um cliente Supabase
 * com o token JWT real do usuário.
 */
export async function signInAsTestUser(
  user: TestUser
): Promise<SupabaseClient> {
  const anon = getAnonClient();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY necessários");
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error || !data.session) {
    throw new Error(`Falha ao autenticar usuário de teste: ${error?.message}`);
  }

  // Criar um novo cliente com o token JWT do usuário
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Limpeza
// ---------------------------------------------------------------------------

const createdUserIds: string[] = [];

/**
 * Registra um usuário para limpeza no teardown.
 */
export function trackForCleanup(userId: string): void {
  createdUserIds.push(userId);
}

/**
 * Remove todos os usuários de teste criados durante a execução.
 * A deleção em auth.users faz CASCADE para public.usuarios.
 * Dados relacionados (registros, referências) precisam ser limpos antes.
 */
export async function cleanupAllTestUsers(): Promise<void> {
  if (createdUserIds.length === 0) return;

  const admin = getAdminClient();

  // Primeiro, deleta dados relacionados que não têm CASCADE
  for (const userId of createdUserIds) {
    try {
      await admin.from("registros").delete().eq("usuario_id", userId);
    } catch { /* ignora */ }
    try {
      await admin.from("referencias_favoritas").delete().eq("usuario_id", userId);
    } catch { /* ignora */ }
    try {
      await admin.from("referencias").delete().eq("criado_por", userId);
    } catch { /* ignora */ }
    try {
      await admin.from("exames_pku").delete().eq("usuario_id", userId);
    } catch { /* ignora */ }
    try {
      await admin.from("delegacoes_acesso").delete().eq("concedente_id", userId);
    } catch { /* ignora */ }
    try {
      await admin.from("delegacoes_acesso").delete().eq("delegado_id", userId);
    } catch { /* ignora */ }
  }

  // Depois, deleta os auth users (CASCADE para usuarios)
  for (const userId of createdUserIds) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch { /* ignora */ }
  }

  createdUserIds.length = 0;
}

// ---------------------------------------------------------------------------
// Dados de teste: referências
// ---------------------------------------------------------------------------

export interface TestReference {
  id: string;
  nome: string;
  fenil_mg_por_100g: number;
  criado_por: string;
  is_global: boolean;
  is_ativa: boolean;
}

/**
 * Cria uma referência de teste como um usuário específico.
 * Usa o admin client para evitar restrições de RLS.
 */
export async function createTestReference(
  ownerId: string,
  overrides: Partial<Pick<TestReference, "is_global" | "is_ativa" | "nome">> = {}
): Promise<TestReference> {
  const admin = getAdminClient();
  const suffix = `${Date.now()}.${testUserCounter}`;
  const nome = overrides.nome ?? `_test_ref_${suffix}`;

  const { data, error } = await admin
    .from("referencias")
    .insert({
      nome,
      fenil_mg_por_100g: 10.0,
      criado_por: ownerId,
      is_global: overrides.is_global ?? false,
      is_ativa: overrides.is_ativa ?? true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar referência de teste: ${error?.message}`);
  }

  return {
    id: data.id,
    nome: data.nome,
    fenil_mg_por_100g: data.fenil_mg_por_100g,
    criado_por: data.criado_por,
    is_global: data.is_global,
    is_ativa: data.is_ativa,
  };
}

// ---------------------------------------------------------------------------
// Dados de teste: delegações
// ---------------------------------------------------------------------------

/**
 * Cria uma delegação de acesso: concedente → delegado.
 */
export async function createTestDelegation(
  concedenteId: string,
  delegadoId: string
): Promise<string> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("delegacoes_acesso")
    .insert({
      concedente_id: concedenteId,
      delegado_id: delegadoId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar delegação de teste: ${error?.message}`);
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// Verificação do estado da migration
// ---------------------------------------------------------------------------

/**
 * Retorna true se a migration de correção de segurança foi aplicada
 * no banco de dados.
 *
 * Estratégia: detecção comportamental — cria um usuário de teste e
 * verifica se ele consegue ver múltiplos registros em usuarios.
 *
 * - Antes da migration (debug_allow_all): usuário vê TODOS os registros
 * - Após a migration (admin_can_select_all_usuarios): usuário vê APENAS 1
 *
 * O usuário de teste é criado e removido dentro desta função.
 * Em caso de falha, retorna false (safe default).
 *
 * Também verifica via pg_policies como fallback determinístico se
 * SUPABASE_DATABASE_URL estiver disponível.
 */
export async function isSecurityMigrationApplied(): Promise<boolean> {
  // Estratégia 1: Verificar via pg_policies (conexão direta PostgreSQL)
  const databaseUrl =
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL;

  if (databaseUrl) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pgModule: any = await import("pg");
      const client = new pgModule.Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
      });

      try {
        await client.connect();
        const { rows } = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'usuarios'
              AND policyname = 'admin_can_select_all_usuarios'
          ) AS applied
        `);
        const result = (rows[0] as Record<string, unknown>).applied === true;
        await client.end();
        return result;
      } catch {
        try { await client.end(); } catch { /* ok */ }
        // Fall through to strategy 2
      }
    } catch {
      // pg module not available, fall through to strategy 2
    }
  }

  // Estratégia 2: Detecção comportamental via Supabase client
  // Cria um usuário temporário e verifica quantos registros ele vê
  try {
    const admin = getAdminClient();
    const anon = getAnonClient();

    // Criar usuário temporário
    const email = `test.detect.${Date.now()}@meufenil-test.local`;
    const password = `detect-${Date.now()}`;
    const { data: authUser, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError || !authUser.user) return false;
    const tempUserId = authUser.user.id;

    try {
      // Autenticar como o usuário temporário
      const { data: sessionData, error: signInError } =
        await anon.auth.signInWithPassword({ email, password });

      if (signInError || !sessionData.session) return false;

      // Criar cliente autenticado
      const url = process.env.VITE_SUPABASE_URL!;
      const key = process.env.VITE_SUPABASE_ANON_KEY!;
      const userClient = createClient(url, key, {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        },
      });

      // Verificar quantos registros o usuário vê
      const { count, error: selectError } = await userClient
        .from("usuarios")
        .select("id", { count: "exact", head: true });

      if (selectError) return false;

      // Se vê apenas 1 registro → migration aplicada
      // Se vê mais de 1 → debug_allow_all ainda existe
      return count === 1;
    } finally {
      // Cleanup: remover usuário temporário
      try {
        await admin.from("registros").delete().eq("usuario_id", tempUserId);
      } catch { /* ok */ }
      try {
        await admin.auth.admin.deleteUser(tempUserId);
      } catch { /* ok */ }
    }
  } catch {
    return false;
  }
}

/**
 * Detecta se a migration ENH-0004 (20260904000000 — coluna `marca` + modelo
 * canônico) está aplicada no banco de desenvolvimento. Sem efeitos colaterais:
 * um SELECT pela coluna `marca` falha (PGRST204) no schema antigo e sucede no
 * novo. Requer service role (getAdminClient) — sem credenciais, false.
 */
export async function isEnh0004MigrationApplied(): Promise<boolean> {
  try {
    const admin = getAdminClient();
    const { error } = await admin
      .from("referencias")
      .select("id, marca")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}
