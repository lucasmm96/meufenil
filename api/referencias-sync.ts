import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { extractPowerBiReport } from "../src/shared/powerbi/extract.js";
import { validarExtracao, type ValidacaoExtracao } from "../src/shared/powerbi/validate.js";
import type { LinhaOrigem } from "../src/shared/powerbi/types.js";

/**
 * Rota da sincronização de referências com a origem ANVISA/Power BI
 * (FEAT-0017, M2 — estágios 1–5 do design §6.2: claim, extração, validação,
 * snapshot e backup; NADA de comparação/aplicação ainda — a sync registra a
 * extração validada e para; sem efeito em `referencias`/`registros`).
 *
 * - GET  = cron (Vercel): Bearer CRON_SECRET, comparação timing-safe; a
 *   plataforma envia o header automaticamente quando a env existe.
 * - POST = manual: Bearer com JWT de sessão válida; papel `admin` em
 *   `usuarios` (mesmo critério do painel); `requested_by` registrado.
 * - Alvo fixo `environment='prod'` (R4-1); sem lógica de ambiente dev.
 * - Single-flight (B10): segunda sync `running` viola o índice parcial
 *   único → 23505 → 409 sem registrar linha.
 *
 * Envs (dedicadas, sem fallback cruzado — DEBT-0006):
 * REFERENCIAS_SYNC_SUPABASE_URL, REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY,
 * CRON_SECRET (GET), POWERBI_RESOURCE_KEY.
 */

type SyncRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
};

type SyncResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

type SupabaseClient = ReturnType<typeof createClient>;

type SyncEventoTipo =
  | "sync_started"
  | "extraction"
  | "validation"
  | "snapshot_created"
  | "backup_created";

type DetalhesEvento = Record<string, unknown>;

const AMBIENTE_ALVO = "prod";
const STALE_APOS_MINUTOS = 25;
const STALE_MENSAGEM = "execução interrompida (timeout da plataforma)";

class ErroConfiguracao extends Error {}
class ErroCronNaoAutorizado extends Error {}
class ErroManualNaoAutorizado extends Error {}
class SyncEmAndamento extends Error {}

function exigirEnv(nome: string): string {
  const valor = process.env[nome];

  if (!valor) {
    throw new ErroConfiguracao(`Missing environment variable: ${nome}`);
  }

  return valor;
}

function criarClienteSupabase(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function sha256Hex(conteudo: string): string {
  return createHash("sha256").update(conteudo, "utf8").digest("hex");
}

function primeiroHeader(
  cabecalhos: Record<string, string | string[] | undefined>,
  nome: string
): string | null {
  const valor = cabecalhos[nome] ?? cabecalhos[nome.toLowerCase()];

  if (Array.isArray(valor)) {
    return valor[0] ?? null;
  }

  return valor ?? null;
}

function extrairBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  return match ? match[1] : null;
}

function segredosIguais(esperado: string, recebido: string): boolean {
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function responder(res: SyncResponse, statusCode: number, corpo: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

function metodoNaoPermitido(res: SyncResponse): void {
  res.setHeader("Allow", "GET, POST");
  responder(res, 405, { error: "Method not allowed" });
}

async function autorizarCron(req: SyncRequest): Promise<void> {
  const segredo = exigirEnv("CRON_SECRET");
  const token = extrairBearerToken(primeiroHeader(req.headers ?? {}, "authorization"));

  if (!token || !segredosIguais(segredo, token)) {
    throw new ErroCronNaoAutorizado();
  }
}

async function autorizarManual(
  supabase: SupabaseClient,
  req: SyncRequest
): Promise<string> {
  const token = extrairBearerToken(primeiroHeader(req.headers ?? {}, "authorization"));

  if (!token) {
    throw new ErroManualNaoAutorizado();
  }

  const { data: usuarioAutenticado, error: erroUsuario } = await supabase.auth.getUser(token);

  if (erroUsuario || !usuarioAutenticado?.user) {
    throw new ErroManualNaoAutorizado();
  }

  const { data: usuario, error: erroBusca } = await supabase
    .from("usuarios")
    .select("id, role")
    .eq("id", usuarioAutenticado.user.id)
    .maybeSingle();

  if (erroBusca) {
    throw erroBusca;
  }

  if (!usuario || usuario.role !== "admin") {
    throw new ErroManualNaoAutorizado();
  }

  return usuario.id;
}

async function registrarEvento(
  supabase: SupabaseClient,
  syncId: string,
  tipo: SyncEventoTipo,
  detalhes: DetalhesEvento
): Promise<void> {
  const { error } = await supabase.from("referencia_eventos").insert({
    sync_id: syncId,
    tipo,
    detalhes,
  });

  if (error) {
    throw error;
  }
}

async function recuperarStale(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from("referencia_syncs")
    .update({
      status: "failure",
      message: STALE_MENSAGEM,
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - STALE_APOS_MINUTOS * 60_000).toISOString());

  if (error) {
    throw error;
  }
}

async function reclamarSync(
  supabase: SupabaseClient,
  triggerSource: string,
  requestedBy: string | null
): Promise<string> {
  await recuperarStale(supabase);

  const { data, error } = await supabase
    .from("referencia_syncs")
    .insert({
      environment: AMBIENTE_ALVO,
      trigger_source: triggerSource,
      requested_by: requestedBy,
      status: "running",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new SyncEmAndamento();
    }

    throw error;
  }

  return data.id;
}

/**
 * Executa o estágio, cronometra, registra no `details.estagios` e grava o
 * evento de auditoria — ok com os detalhes produzidos pelo estágio, erro com
 * a mensagem (design §6.2). O registro do estágio acontece ANTES do rethrow
 * para o `details` final da sync carregar também os estágios que falharam.
 */
async function executarEstagio(
  supabase: SupabaseClient,
  syncId: string,
  nome: string,
  tipoEvento: SyncEventoTipo,
  acao: () => Promise<DetalhesEvento>,
  estagiosGravados: DetalhesEvento[]
): Promise<DetalhesEvento> {
  const inicio = Date.now();

  try {
    const detalhes = await acao();
    estagiosGravados.push({ estagio: nome, status: "ok", ...detalhes });
    await registrarEvento(supabase, syncId, tipoEvento, detalhes);

    return { ...detalhes, duration_ms: Date.now() - inicio };
  } catch (erro) {
    const message = erro instanceof Error ? erro.message : String(erro);
    estagiosGravados.push({ estagio: nome, status: "erro", erro: message });
    await registrarEvento(supabase, syncId, tipoEvento, {
      erro: message,
      duration_ms: Date.now() - inicio,
    });
    throw erro;
  }
}

async function concluirSync(
  supabase: SupabaseClient,
  syncId: string,
  status: "success" | "origin_invalid" | "failure",
  message: string,
  totalOrigem: number | null,
  detalhes: DetalhesEvento
): Promise<void> {
  const { error } = await supabase
    .from("referencia_syncs")
    .update({
      status,
      message,
      total_origem: totalOrigem,
      finished_at: new Date().toISOString(),
      details: detalhes,
    })
    .eq("id", syncId);

  if (error) {
    throw error;
  }
}

async function executarSync(
  supabase: SupabaseClient,
  req: SyncRequest,
  res: SyncResponse,
  triggerSource: string,
  requestedBy: string | null
): Promise<void> {
  // Configuração completa antes do claim: nenhuma sync registrada quando a
  // rota não pode executar (erro de configuração não polui a trilha).
  exigirEnv("POWERBI_RESOURCE_KEY");

  const inicioRun = Date.now();
  const detalhesEstagios: DetalhesEvento[] = [];
  const resourceKey = process.env.POWERBI_RESOURCE_KEY as string;
  let syncId: string | null = null;

  try {
    // Estágio 1 — claim: stale recovery (25 min) + INSERT running + evento.
    syncId = await reclamarSync(supabase, triggerSource, requestedBy);

    await registrarEvento(supabase, syncId, "sync_started", {
      trigger_source: triggerSource,
      environment: AMBIENTE_ALVO,
    });

    // Estágio 2 — extração (fetch + decode; fail-high D-1).
    let rows: LinhaOrigem[] = [];

    await executarEstagio(
      supabase,
      syncId,
      "extraction",
      "extraction",
      async () => {
        const extraida = await extractPowerBiReport({ resourceKey });
        rows = extraida.rows;

        return { contagem: extraida.contagem, patch_aplicado: extraida.patchAplicado };
      },
      detalhesEstagios
    );

    // Estágio 3 — validação (§6.3): abort imediato na 1ª anomalia; origem
    // inválida termina a sync SEM snapshot/backup (B9).
    let validacao: ValidacaoExtracao | null = null;

    await executarEstagio(
      supabase,
      syncId,
      "validation",
      "validation",
      async () => {
        validacao = validarExtracao(rows);

        return {
          valida: validacao.valida,
          motivo: validacao.motivo,
          colunas: validacao.colunas,
          quantidade: validacao.quantidade,
          contagem: validacao.contagem,
        };
      },
      detalhesEstagios
    );

    if (!validacao) {
      throw new Error("Validação não executada.");
    }

    if (!validacao.valida) {
      await concluirSync(
        supabase,
        syncId,
        "origin_invalid",
        `Origem inválida: ${validacao.motivo ?? "motivo desconhecido"}`,
        null,
        { estagios: detalhesEstagios }
      );

      responder(res, 200, { sync_id: syncId, status: "origin_invalid" });
      return;
    }

    // Estágio 4 — snapshot do payload decodificado exato da origem (B3).
    const payloadSnapshot = JSON.stringify(rows);
    const snapshotSha256 = sha256Hex(payloadSnapshot);
    const contagemOrigem = rows.length;

    await executarEstagio(
      supabase,
      syncId,
      "snapshot",
      "snapshot_created",
      async () => {
        const { error } = await supabase.from("referencia_snapshots").insert({
          sync_id: syncId,
          payload: payloadSnapshot,
          payload_sha256: snapshotSha256,
          contagem: contagemOrigem,
        });

        if (error) {
          throw error;
        }

        return { contagem: contagemOrigem, payload_sha256: snapshotSha256 };
      },
      detalhesEstagios
    );

    // Estágio 5 — backup das linhas completas de `referencias` (estado
    // pré-aplicação; M2 não aplica nada — registro para a trilha B3).
    await executarEstagio(
      supabase,
      syncId,
      "backup",
      "backup_created",
      async () => {
        const { data, error } = await supabase.from("referencias").select("*");

        if (error) {
          throw error;
        }

        const backupPayload = (data ?? []) as unknown[];
        const payloadBackup = JSON.stringify(backupPayload);
        const backupSha256 = sha256Hex(payloadBackup);
        const contagemBackup = backupPayload.length;

        const { error: erroBackup } = await supabase.from("referencia_backups").insert({
          sync_id: syncId,
          payload: payloadBackup,
          payload_sha256: backupSha256,
          contagem: contagemBackup,
        });

        if (erroBackup) {
          throw erroBackup;
        }

        return { contagem: contagemBackup, payload_sha256: backupSha256 };
      },
      detalhesEstagios
    );

    await concluirSync(
      supabase,
      syncId,
      "success",
      "Extração validada; snapshot e backup registrados. " +
        "(M2: comparação e aplicação ainda não executadas — estágios 6–8.)",
      contagemOrigem,
      { estagios: detalhesEstagios }
    );

    console.info(
      `[referencias-sync] ${triggerSource} sync ${syncId} ok em ` +
        `${Date.now() - inicioRun}ms (${contagemOrigem} linhas)`
    );

    responder(res, 200, { sync_id: syncId, status: "success" });
  } catch (erro) {
    const message = erro instanceof Error ? erro.message : String(erro);

    if (erro instanceof SyncEmAndamento) {
      responder(res, 409, { error: "Sync já em andamento para este ambiente." });
      return;
    }

    console.error(`[referencias-sync] ${triggerSource} sync ${syncId ?? "<sem-claim>"} falhou: ${message}`);

    // Falha antes do claim (ex.: erro de rede no INSERT) não tem sync a marcar.
    if (syncId) {
      try {
        await concluirSync(supabase, syncId, "failure", message, null, {
          estagios: detalhesEstagios,
        });
      } catch (erroMarcar) {
        console.error(
          `[referencias-sync] falha ao marcar ${syncId} como failure: ` +
            `${erroMarcar instanceof Error ? erroMarcar.message : String(erroMarcar)}`
        );
      }
    }

    responder(res, 500, {
      ...(syncId ? { sync_id: syncId } : {}),
      status: "failure",
      error: message,
    });
  }
}

export default async function handler(req: SyncRequest, res: SyncResponse) {
  try {
    if (req.method === "GET") {
      await autorizarCron(req);

      const url = exigirEnv("REFERENCIAS_SYNC_SUPABASE_URL");
      const serviceRoleKey = exigirEnv("REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY");

      await executarSync(criarClienteSupabase(url, serviceRoleKey), req, res, "cron", null);
      return;
    }

    if (req.method === "POST") {
      const url = exigirEnv("REFERENCIAS_SYNC_SUPABASE_URL");
      const serviceRoleKey = exigirEnv("REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY");
      const supabase = criarClienteSupabase(url, serviceRoleKey);

      const requestedBy = await autorizarManual(supabase, req);

      await executarSync(supabase, req, res, "manual", requestedBy);
      return;
    }

    metodoNaoPermitido(res);
  } catch (erro) {
    if (erro instanceof ErroCronNaoAutorizado) {
      responder(res, 401, { error: "Não autorizado." });
      return;
    }

    if (erro instanceof ErroManualNaoAutorizado) {
      responder(res, 403, { error: "Não autorizado." });
      return;
    }

    if (erro instanceof ErroConfiguracao) {
      responder(res, 500, { error: erro.message });
      return;
    }

    const message = erro instanceof Error ? erro.message : String(erro);

    console.error(`[referencias-sync] falha inesperada: ${message}`);

    responder(res, 500, { error: message });
  }
}
