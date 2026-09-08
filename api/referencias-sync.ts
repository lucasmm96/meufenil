import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { extractPowerBiReport } from "../src/shared/powerbi/extract.js";
import { validarExtracao, type ValidacaoExtracao } from "../src/shared/powerbi/validate.js";
import type { LinhaOrigem } from "../src/shared/powerbi/types.js";
import { derivarModoSync } from "../src/shared/referencias-sync/compare.js";
import { construirPlanoSync } from "../src/shared/referencias-sync/engine.js";
import type {
  ArquivadaGlobal,
  DecisaoPendencia,
  GlobalAtiva,
  IdentidadeReferencia,
  ModoSync,
  PendenciaAberta,
  PlanoSync,
} from "../src/shared/referencias-sync/types.js";

/**
 * Rota da sincronização de referências com a origem ANVISA/Power BI
 * (FEAT-0017, M4 — pipeline completo, estágios 1–8 do design §6.2: claim,
 * extração, validação, snapshot, backup, comparação, aplicação e conclusão).
 * A partir do M4 a sync aplica efeito real no catálogo global: compara o
 * estado com o motor puro (M3), aplica via RPC `aplicar_sync_referencias`
 * (transação única service_role-only) e conclui `success` (sem divergências)
 * ou `pending_review` (pendências de curadoria — decididas por admin via RPC
 * `decidir_pendencia_referencia`).
 *
 * - GET  = cron (Vercel): Bearer CRON_SECRET, comparação timing-safe; a
 *   plataforma envia o header automaticamente quando a env existe. O cron só
 *   dispara no deployment de produção → sempre `environment='prod'`.
 * - POST = manual: Bearer com JWT de sessão válida; papel `admin` em
 *   `usuarios` (mesmo critério do painel); `requested_by` registrado.
 *   Disponível em dev e prod (revisão parcial do R4-1, decisão 2026-09-08).
 * - Ambiente da sync derivado de `VERCEL_ENV` (`ambienteAlvo()`): produção →
 *   `'prod'`; preview/development (incl. `vercel dev` local) → `'dev'`.
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

// Linhas do estado consultado no estágio 6 (service_role; shape do PostgREST —
// a rota não usa os tipos gerados do Supabase, tipa o contrato que consome).
type LinhaGlobalAtiva = {
  id: string;
  nome: string;
  marca: string;
  fenil_mg_por_100g: number;
};

type LinhaEventoAuditoria = {
  id: string;
  tipo: string;
  created_at: string;
};

type LinhaGlobalArquivada = LinhaGlobalAtiva & {
  referencia_eventos: LinhaEventoAuditoria[] | null;
};

type LinhaPendencia = {
  tipo: string;
  referencia_id: string | null;
  proposta: IdentidadeReferencia | null;
};

type LinhaDecisao = {
  tipo: string;
  referencia_id: string | null;
  proposta: IdentidadeReferencia | null;
  status: string;
};

/** Resumo retornado pela RPC `aplicar_sync_referencias` (estágio 7/8). */
type ResumoAplicacao = {
  equivalentes: number;
  criadas: number;
  arquivadas: number;
  divergencias: number;
};

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

/**
 * Ambiente em que a rota executa (revisão parcial do R4-1, decisão humana
 * 2026-09-08): deployment de produção → `'prod'`; qualquer outro (`preview`,
 * `vercel dev` local — `VERCEL_ENV=development`) → `'dev'`. O cron só dispara
 * no deployment de produção; a execução manual fica disponível em dev e prod.
 * Deriva-se de `VERCEL_ENV` — e não de env dedicada — porque o ambiente muda
 * de escopo junto com as `REFERENCIAS_SYNC_*`: um deployment nunca grava no
 * environment errado, e não há env nova para configurar por escopo. O racional
 * do DEBT-0006 (o cron precisava alcançar dev) não se aplica: aqui o cron é
 * prod-only por requisito. Ausência de `VERCEL_ENV` (fora do Vercel) → dev
 * (nunca `prod` acidental).
 */
function ambienteAlvo(): string {
  return process.env.VERCEL_ENV === "production" ? "prod" : "dev";
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
      environment: ambienteAlvo(),
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
 * Executa o estágio, cronometra e registra no `details.estagios` — com evento
 * de auditoria quando `tipoEvento` é informado (design §6.2). Comparação e
 * aplicação NÃO têm evento no catálogo §11.1 (a aplicação gera os eventos de
 * domínio dentro da própria RPC) — passam `tipoEvento = null` e só alimentam
 * os tempos/contagens de `details.estagios` (base da calibração R5). O
 * registro do estágio acontece ANTES do rethrow para o `details` final da sync
 * carregar também os estágios que falharam.
 */
async function executarEstagio(
  supabase: SupabaseClient,
  syncId: string,
  nome: string,
  tipoEvento: SyncEventoTipo | null,
  acao: () => Promise<DetalhesEvento>,
  estagiosGravados: DetalhesEvento[]
): Promise<DetalhesEvento> {
  const inicio = Date.now();

  try {
    const detalhes = await acao();
    estagiosGravados.push({ estagio: nome, status: "ok", ...detalhes });

    if (tipoEvento) {
      await registrarEvento(supabase, syncId, tipoEvento, detalhes);
    }

    return { ...detalhes, duration_ms: Date.now() - inicio };
  } catch (erro) {
    const message = erro instanceof Error ? erro.message : String(erro);
    estagiosGravados.push({ estagio: nome, status: "erro", erro: message });

    if (tipoEvento) {
      await registrarEvento(supabase, syncId, tipoEvento, {
        erro: message,
        duration_ms: Date.now() - inicio,
      });
    }

    throw erro;
  }
}

type StatusFinalSync = "success" | "pending_review" | "origin_invalid" | "failure";

async function concluirSync(
  supabase: SupabaseClient,
  syncId: string,
  status: StatusFinalSync,
  message: string,
  totalOrigem: number | null,
  detalhes: DetalhesEvento,
  bootstrap?: boolean
): Promise<void> {
  const { error } = await supabase
    .from("referencia_syncs")
    .update({
      status,
      message,
      total_origem: totalOrigem,
      finished_at: new Date().toISOString(),
      details: detalhes,
      ...(bootstrap === undefined ? {} : { bootstrap }),
    })
    .eq("id", syncId);

  if (error) {
    throw error;
  }
}

/** Eventos da referência em ordem cronológica determinística (id desempata). */
function ordenarEventos(eventos: LinhaEventoAuditoria[]): LinhaEventoAuditoria[] {
  return eventos
    .slice()
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
    );
}

/**
 * Estágio 6 — estado do catálogo para o motor (design §7.3): globais ativas,
 * globais arquivadas com eventos de auditoria, pendências open de qualquer
 * sync (dedupe global D-6), decisões approved/rejected de absence/new_item em
 * ordem cronológica (a última vence) e o histórico de syncs do environment
 * para derivar o modo (bootstrap × pos_bootstrap, §14). Tudo via service_role.
 */
async function consultarEstadoCatalogo(
  supabase: SupabaseClient,
  syncId: string
): Promise<{
  ativas: GlobalAtiva[];
  arquivadas: ArquivadaGlobal[];
  pendenciasAbertas: PendenciaAberta[];
  decisoes: DecisaoPendencia[];
  modo: ModoSync;
}> {
  const [resultadoAtivas, resultadoArquivadas, resultadoPendencias, resultadoDecisoes, resultadoHistorico] =
    await Promise.all([
      supabase
        .from("referencias")
        .select("id, nome, marca, fenil_mg_por_100g")
        .eq("is_global", true)
        .eq("is_ativa", true),
      supabase
        .from("referencias")
        .select(
          "id, nome, marca, fenil_mg_por_100g, referencia_eventos(id, tipo, created_at)"
        )
        .eq("is_global", true)
        .eq("is_ativa", false),
      supabase
        .from("referencia_sync_pendencias")
        .select("tipo, referencia_id, proposta")
        .eq("status", "open"),
      supabase
        .from("referencia_sync_pendencias")
        .select("tipo, referencia_id, proposta, status")
        .in("tipo", ["absence", "new_item"])
        .in("status", ["approved", "rejected"])
        .order("decided_at", { ascending: true }),
      supabase
        .from("referencia_syncs")
        .select("status")
        .eq("environment", ambienteAlvo())
        .neq("id", syncId),
    ]);

  if (
    resultadoAtivas.error ||
    resultadoArquivadas.error ||
    resultadoPendencias.error ||
    resultadoDecisoes.error ||
    resultadoHistorico.error
  ) {
    throw (
      resultadoAtivas.error ??
      resultadoArquivadas.error ??
      resultadoPendencias.error ??
      resultadoDecisoes.error ??
      resultadoHistorico.error
    );
  }

  const ativas: GlobalAtiva[] = ((resultadoAtivas.data ?? []) as LinhaGlobalAtiva[]).map(
    (linha) => ({
      id: linha.id,
      nome: linha.nome,
      marca: linha.marca,
      fenil_mg_por_100g: linha.fenil_mg_por_100g,
    })
  );

  const arquivadas: ArquivadaGlobal[] = (
    (resultadoArquivadas.data ?? []) as LinhaGlobalArquivada[]
  ).map((linha) => ({
    nome: linha.nome,
    marca: linha.marca,
    fenil_mg_por_100g: linha.fenil_mg_por_100g,
    eventos: ordenarEventos(linha.referencia_eventos ?? []).map((evento) => ({
      tipo: evento.tipo,
      criadoEm: evento.created_at,
    })),
  }));

  const pendenciasAbertas: PendenciaAberta[] = (
    (resultadoPendencias.data ?? []) as LinhaPendencia[]
  ).map((pendencia) => ({
    tipo: pendencia.tipo as PendenciaAberta["tipo"],
    referencia_id: pendencia.referencia_id,
    proposta: pendencia.proposta,
  }));

  const decisoes: DecisaoPendencia[] = ((resultadoDecisoes.data ?? []) as LinhaDecisao[]).map(
    (decisao) => ({
      tipo: decisao.tipo as DecisaoPendencia["tipo"],
      referencia_id: decisao.referencia_id,
      proposta: decisao.proposta,
      status: decisao.status as DecisaoPendencia["status"],
    })
  );

  const historico = (resultadoHistorico.data ?? []) as { status: string }[];
  const modo = derivarModoSync(historico);

  return { ativas, arquivadas, pendenciasAbertas, decisoes, modo };
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
  // Flag da decisão 5 do M4 (lida no catch — precisa do escopo da função):
  // true sse a RPC de aplicação retornou ok (alterações são fato).
  let aplicado = false;

  try {
    // Estágio 1 — claim: stale recovery (25 min) + INSERT running + evento.
    syncId = await reclamarSync(supabase, triggerSource, requestedBy);

    await registrarEvento(supabase, syncId, "sync_started", {
      trigger_source: triggerSource,
      environment: ambienteAlvo(),
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

    // Estágio 6 — comparação (design §6.2/§7.3): consulta o estado do catálogo
    // e monta o plano com o motor puro (M3). Sem evento de auditoria próprio
    // (o resultado vive no detalhe do estágio e no payload da aplicação).
    let plano: PlanoSync | null = null;
    let modo: ModoSync = "bootstrap";

    await executarEstagio(
      supabase,
      syncId,
      "comparison",
      null,
      async () => {
        const estado = await consultarEstadoCatalogo(supabase, syncId);
        modo = estado.modo;

        const planoConstruido = construirPlanoSync({
          origem: rows,
          ativas: estado.ativas,
          arquivadas: estado.arquivadas,
          pendenciasAbertas: estado.pendenciasAbertas,
          decisoes: estado.decisoes,
          modo: estado.modo,
        });
        plano = planoConstruido;

        return {
          modo: estado.modo,
          ativas: estado.ativas.length,
          arquivadas: estado.arquivadas.length,
          pendencias_abertas: estado.pendenciasAbertas.length,
          decisoes_consideradas: estado.decisoes.length,
          plano: {
            criacoes: planoConstruido.criacoes.length,
            arquivamentos: planoConstruido.arquivamentos.length,
            pendencias_novas: planoConstruido.pendencias.length,
            equivalentes: planoConstruido.resumo.equivalentes,
          },
        };
      },
      detalhesEstagios
    );

    if (!plano) {
      throw new Error("Comparação não produziu plano.");
    }

    // Estágio 7 — aplicação (design §7.5): RPC SECURITY DEFINER
    // service_role-only; transação única — qualquer exceção desfaz tudo
    // (ops, pendências, eventos e contadores) e a sync é marcada failure.
    let resumoAplicacao: ResumoAplicacao | null = null;

    await executarEstagio(
      supabase,
      syncId,
      "apply",
      null,
      async () => {
        const { data, error } = await supabase.rpc("aplicar_sync_referencias", {
          p_sync_id: syncId,
          p_plano: plano,
        });

        if (error) {
          throw error;
        }

        aplicado = true;
        resumoAplicacao = (data ?? {}) as ResumoAplicacao;

        return { ...resumoAplicacao };
      },
      detalhesEstagios
    );

    // Estágio 8 — conclusão: o resumo retornado pela RPC decide o status
    // (design §7.5 item 6): divergências (pendências) → pending_review
    // (curadoria); sem divergências → success.
    const divergencias = resumoAplicacao?.divergencias ?? 0;
    const statusFinal: StatusFinalSync =
      divergencias > 0 ? "pending_review" : "success";

    const mensagemFinal =
      statusFinal === "success"
        ? `Sincronização concluída: ${resumoAplicacao?.equivalentes ?? 0} equivalentes, ` +
          `${resumoAplicacao?.criadas ?? 0} criadas, ${resumoAplicacao?.arquivadas ?? 0} arquivadas, ` +
          `sem divergências pendentes.`
        : `Sincronização concluída com ${divergencias} divergência(s) pendente(s) de curadoria: ` +
          `${resumoAplicacao?.equivalentes ?? 0} equivalentes, ` +
          `${resumoAplicacao?.criadas ?? 0} criadas, ${resumoAplicacao?.arquivadas ?? 0} arquivadas.`;

    await concluirSync(
      supabase,
      syncId,
      statusFinal,
      mensagemFinal,
      contagemOrigem,
      { estagios: detalhesEstagios },
      modo === "bootstrap"
    );

    console.info(
      `[referencias-sync] ${triggerSource} sync ${syncId} ok em ` +
        `${Date.now() - inicioRun}ms (${contagemOrigem} linhas, modo ${modo}, ` +
        `status ${statusFinal}, ${divergencias} divergências)`
    );

    responder(res, 200, { sync_id: syncId, status: statusFinal });
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
        // Decisão 5 do M4: se a RPC de aplicação já retornou ok, as alterações
        // SÃO fato (`alteracoes`/contadores gravados na sync) — a falha é da
        // conclusão; a mensagem registra a verdade (rollback do M5 poderá
        // reverter). Antes disso, nada foi aplicado (transação abortou).
        const mensagemFalha = aplicado
          ? `Alterações aplicadas; falha ao finalizar a sync: ${message}`
          : message;

        await concluirSync(supabase, syncId, "failure", mensagemFalha, null, {
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
