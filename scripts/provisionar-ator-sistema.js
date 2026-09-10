#!/usr/bin/env node
/**
 * Runbook — FEAT-0017: provisiona o ator Sistema (B5/design §12) no ambiente
 * de DESENVOLVIMENTO.
 *
 * O ator Sistema é a conta que assina (`criado_por`) as referências globais
 * criadas pelo motor de sincronização: sob service_role `auth.uid()` é null e
 * a coluna é NOT NULL — o id do Sistema é resolvido por email fixo dentro das
 * RPCs de aplicação/curadoria (M4) e falha rápido se ausente (fail-high).
 *
 * Fluxo (idempotente — repetir não tem efeito):
 *   1. lê credenciais de .env.development (VITE_SUPABASE_URL +
 *      SUPABASE_SERVICE_ROLE_KEY) — NUNCA para produção (pré-ENH-0004 e as
 *      envs da rota nem existem; o runbook é operação de dev);
 *   2. se a conta `sistema@meufenil.local` já existe em `usuarios`: garante o
 *      banimento na Auth e encerra;
 *   3. senão: cria a conta via Admin API (senha aleatória descartada, email
 *      confirmado, user_metadata.system=true) — o trigger on_auth_user_created
 *      cria o perfil `usuarios` (role 'user', irrelevante — escritas são via
 *      service_role) — e bane em seguida (sem login possível);
 *   4. confere o estado final e imprime só o id (nenhum segredo é exposto).
 *
 * Uso:  node scripts/provisionar-ator-sistema.js
 * Saída: exit 0 com o id do Sistema; exit != 0 com mensagem clara em falha.
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFileIfPresent } from "./cli/env.js";

const EMAIL_SISTEMA = "sistema@meufenil.local";
const BAN_DURATION = "876000h"; // 100 anos — sem login possível, nunca expira na prática

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name} (definida em .env.development)`);
  }
  return value;
}

function mascararUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "<url inválida>";
  }
}

async function garantirBanido(authAdmin, id) {
  const { data, error } = await authAdmin.updateUserById(id, { ban_duration: BAN_DURATION });
  if (error) {
    throw new Error(`Falha ao banir a conta ${id}: ${error.message}`);
  }
  return data.user;
}

async function main() {
  loadEnvFileIfPresent(".env.development");

  const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  console.log(`Alvo: ${mascararUrl(supabaseUrl)} (desenvolvimento)`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Já existe um perfil com o email do Sistema?
  const { data: perfil, error: erroPerfil } = await supabase
    .from("usuarios")
    .select("id, email, role")
    .eq("email", EMAIL_SISTEMA)
    .maybeSingle();

  if (erroPerfil) {
    throw new Error(`Falha ao consultar usuarios por email: ${erroPerfil.message}`);
  }

  if (perfil) {
    // Já provisionado: garante o banimento (idempotente) e encerra.
    const usuario = await garantirBanido(supabase.auth.admin, perfil.id);
    console.log(`Ator Sistema já existia — banimento garantido.`);
    console.log(`Sistema id: ${perfil.id}`);
    console.log(`Banido até: ${usuario.banned_until ?? "(não banido — revisar)"}`);
    return;
  }

  // 2. Cria a conta (senha aleatória descartada — nunca impressa) + ban imediato.
  const senhaDescartada = crypto.randomBytes(24).toString("base64url");
  const { data: criado, error: erroCriar } = await supabase.auth.admin.createUser({
    email: EMAIL_SISTEMA,
    password: senhaDescartada,
    email_confirm: true,
    user_metadata: { system: true },
  });

  if (erroCriar) {
    throw new Error(`Falha ao criar a conta do Sistema: ${erroCriar.message}`);
  }

  const sistemaId = criado.user.id;
  await garantirBanido(supabase.auth.admin, sistemaId);

  // 3. Confere o perfil criado pelo trigger on_auth_user_created.
  const { data: perfilCriado, error: erroConfirmar } = await supabase
    .from("usuarios")
    .select("id, email, role")
    .eq("id", sistemaId)
    .maybeSingle();

  if (erroConfirmar) {
    throw new Error(`Falha ao confirmar o perfil em usuarios: ${erroConfirmar.message}`);
  }
  if (!perfilCriado) {
    throw new Error(
      `Perfil do Sistema não foi criado em usuarios pelo trigger on_auth_user_created — revisar a trigger antes de prosseguir.`
    );
  }

  console.log(`Ator Sistema provisionado (conta banida — sem login possível).`);
  console.log(`Sistema id: ${sistemaId}`);
}

main().catch((erro) => {
  console.error(`ERRO: ${erro.message}`);
  process.exit(1);
});
