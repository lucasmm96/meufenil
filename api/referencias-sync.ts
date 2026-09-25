import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { extractPowerBiReport } from "../src/shared/powerbi/extract.js";
import { validarExtracao, type ValidacaoExtracao } from "../src/shared/powerbi/validate.js";
import type { LinhaOrigem } from "../src/shared/powerbi/types.js";
import { construirPlanoSync } from "../src/shared/referencias-sync/engine.js";
import type {
  ArquivadaGlobal,
  GlobalAtiva,
  PlanoSync,
} from "../src/shared/referencias-sync/types.js";

/**
 * Rota da sincronização de referências com a origem ANVISA/Power BI
 * (FEAT-0017/ENH-0009, M4 — pipeline completo, estágios 1–8 do design §6.2:
 * claim, extração, validação, snapshot, backup, comparação, aplicação e
 * conclusão). A partir do M4 a sync aplica efeito real no catálogo global:
 * compara o estado com o motor puro (M3), aplica via RPC
 * `aplicar_sync_referencias` (transação única service_role-only) e conclui
 * sempre com status `success`.
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

/** Teto de rejeições individuais gravadas no evento (o total vai em `contagem`). */
const MAX_REJEITADAS_REPORTADAS = 100;

/** Tamanho de página das consultas paginadas (teto do PostgREST por request). */
const TAMANHO_PAGINA = 1000;

/**
 * Consulta paginada completa: o PostgREST trunca em 1000 linhas por request e
 * o catálogo excede o teto — sem paginação, o backup (estágio 5) e o estado
 * do catálogo (estágio 6) veriam um retrato PARCIAL (comparação com falsos
 * new_item/absence; backup incapaz de restaurar o catálogo inteiro). Itera
 * com `.range` até a última página.
 */
async function buscarTodasAsLinhas<T>(
  executar: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const linhas: T[] = [];

  for (let from = 0; ; from += TAMANHO_PAGINA) {
    const { data, error } = await executar(from, from + TAMANHO_PAGINA - 1);

    if (error) {
      throw error;
    }

    const pagina = data ?? [];
    linhas.push(...pagina);

    if (pagina.length < TAMANHO_PAGINA) {
      break;
    }
  }

  return linhas;
}

/**
 * Busca eventos de auditoria para um conjunto de referências arquivadas.
 * Utiliza `.in("referencia_id", lote)` em batches de 200 IDs para evitar URLs
 * muito longas. Pagina com `buscarTodasAsLinhas` dentro de cada batch.
 *
 * A FK referencia_eventos.referencia_id → referencias foi removida no ENH-0009,
 * impossibilitando o embed PostgREST "referencia_eventos(...)". Este helper
 * substitui o embed com duas consultas sequenciais (refs → eventos por lote).
 */
const LOTE_IDS_EVENTOS = 200;

async function buscarEventosDasArquivadas(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, LinhaEventoAuditoria[]>> {
  const mapa = new Map<string, LinhaEventoAuditoria[]>();
  if (ids.length === 0) return mapa;

  for (let i = 0; i < ids.length; i += LOTE_IDS_EVENTOS) {
    const lote = ids.slice(i, i + LOTE_IDS_EVENTOS);

    const eventos = await buscarTodasAsLinhas<LinhaEventoArquivada>((from, to) =>
      supabase
        .from("referencia_eventos")
        .select("id, tipo, created_at, referencia_id")
        .in("referencia_id", lote)
        .range(from, to)
    );

    for (const ev of eventos) {
      const lista = mapa.get(ev.referencia_id) ?? [];
      lista.push({ id: ev.id, tipo: ev.tipo, created_at: ev.created_at });
      mapa.set(ev.referencia_id, lista);
    }
  }

  return mapa;
}

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

// ENH-0009 removeu a FK referencia_eventos.referencia_id → referencias;
// os eventos são buscados separadamente e incluem referencia_id para agrupamento.
type LinhaEventoArquivada = LinhaEventoAuditoria & { referencia_id: string };

/** Linha de evento de remoção lida no estágio audit (ENH-0010/ENH-0011). */
type LinhaEventoRemocao = {
  tipo: string;
  referencia_id: string;
  /** Desde ENH-0011: inclui `motivo` ('ausencia'|'substituicao'|'sweep'). Eventos históricos: motivo ausente. */
  detalhes: Record<string, unknown> | null;
};

/** Resumo retornado pela RPC `aplicar_sync_referencias` (estágio 7/8). */
type ResumoAplicacao = {
  equivalentes: number;
  criadas: number;
  arquivadas: number;
  deletadas: number;
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
 * Extrai mensagem legível de qualquer valor lançável.
 * Cobre Error, PostgrestError (objeto simples com .message) e primitivos.
 */
function mensagemErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (erro !== null && typeof erro === "object" && "message" in erro) {
    const msg = (erro as { message: unknown }).message;
    return typeof msg === "string" && msg !== "" ? msg : JSON.stringify(erro);
  }
  return String(erro);
}

/**
 * Extrai campos de diagnóstico adicionais (PostgrestError: code, hint, details).
 * Retorna undefined quando não há nada além da mensagem.
 */
function contextoErro(erro: unknown): Record<string, unknown> | undefined {
  if (!erro || typeof erro !== "object" || erro instanceof Error) return undefined;
  const obj = erro as Record<string, unknown>;
  const ctx: Record<string, unknown> = {};
  if (obj.code !== undefined && obj.code !== null) ctx.code = obj.code;
  if (typeof obj.hint === "string" && obj.hint) ctx.hint = obj.hint;
  if (typeof obj.details === "string" && obj.details) ctx.details = obj.details;
  return Object.keys(ctx).length > 0 ? ctx : undefined;
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
    const message = mensagemErro(erro);
    const ctx = contextoErro(erro);
    estagiosGravados.push({
      estagio: nome,
      status: "erro",
      erro: message,
      ...(ctx ? { contexto_erro: ctx } : {}),
    });

    if (tipoEvento) {
      await registrarEvento(supabase, syncId, tipoEvento, {
        erro: message,
        ...(ctx ? { contexto_erro: ctx } : {}),
        duration_ms: Date.now() - inicio,
      });
    }

    throw erro;
  }
}

type StatusFinalSync = "success" | "origin_invalid" | "failure";

async function concluirSync(
  supabase: SupabaseClient,
  syncId: string,
  status: StatusFinalSync,
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
 * Estágio 6 — estado do catálogo para o motor (design §7.3/ENH-0009): globais
 * ativas e globais arquivadas com eventos de auditoria. Tudo via service_role.
 * Consultas paginadas (`buscarTodasAsLinhas`) — o catálogo excede o teto de
 * 1000 linhas do PostgREST; sem paginação a comparação vê um retrato parcial.
 */
async function consultarEstadoCatalogo(
  supabase: SupabaseClient
): Promise<{
  ativas: GlobalAtiva[];
  arquivadas: ArquivadaGlobal[];
}> {
  const [ativasBrutas, arquivadasBrutas] = await Promise.all([
    buscarTodasAsLinhas<LinhaGlobalAtiva>((from, to) =>
      supabase
        .from("referencias")
        .select("id, nome, marca, fenil_mg_por_100g")
        .eq("is_global", true)
        .eq("is_ativa", true)
        .range(from, to)
    ),
    // ENH-0009: sem o embed referencia_eventos — FK removida. Eventos buscados abaixo.
    buscarTodasAsLinhas<LinhaGlobalAtiva>((from, to) =>
      supabase
        .from("referencias")
        .select("id, nome, marca, fenil_mg_por_100g")
        .eq("is_global", true)
        .eq("is_ativa", false)
        .range(from, to)
    ),
  ]);

  const ativas: GlobalAtiva[] = ativasBrutas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    marca: linha.marca,
    fenil_mg_por_100g: linha.fenil_mg_por_100g,
  }));

  const arquivadaIds = arquivadasBrutas.map((r) => r.id);
  const eventosPorRef = await buscarEventosDasArquivadas(supabase, arquivadaIds);

  const arquivadas: ArquivadaGlobal[] = arquivadasBrutas.map((linha) => ({
    nome: linha.nome,
    marca: linha.marca,
    fenil_mg_por_100g: linha.fenil_mg_por_100g,
    eventos: ordenarEventos(eventosPorRef.get(linha.id) ?? []).map((evento) => ({
      tipo: evento.tipo,
      criadoEm: evento.created_at,
    })),
  }));

  return { ativas, arquivadas };
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

    // Estágio 3 — validação: estrutura inesperada e 0 linhas válidas abortam a
    // sync; anomalias de campo/tipo rejeitam a linha individualmente e
    // duplicidade conflitante rejeita o par inteiro (BR-044 revisada
    // 2026-09-14) — reportadas no evento; só aborta se não restar nenhuma
    // válida. Origem inválida termina a sync SEM snapshot/backup (B9).
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
          rejeitadas: validacao.rejeitadas.slice(0, MAX_REJEITADAS_REPORTADAS),
          rejeitadas_truncadas: validacao.rejeitadas.length > MAX_REJEITADAS_REPORTADAS,
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

    // Pipeline segue só com as linhas válidas e normalizadas (marca nula já
    // virou string vazia) — rejeições individuais não abortam a sync.
    rows = validacao.rowsValidas;

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
        // Consulta paginada completa — o catálogo excede o teto de 1000 linhas
        // do PostgREST; um backup truncado não conseguiria restaurar o catálogo.
        const backupPayload = (await buscarTodasAsLinhas<unknown>((from, to) =>
          supabase.from("referencias").select("*").range(from, to)
        )) as unknown[];
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

    // Estágio 6 — comparação (design §6.2/§7.3/ENH-0009): consulta o estado do
    // catálogo e monta o plano com o motor puro (M3). Sem evento de auditoria
    // próprio (o resultado vive no detalhe do estágio e no payload da aplicação).
    let plano: PlanoSync | null = null;

    await executarEstagio(
      supabase,
      syncId,
      "comparison",
      null,
      async () => {
        const estado = await consultarEstadoCatalogo(supabase);

        const planoConstruido = construirPlanoSync({
          origem: rows,
          ativas: estado.ativas,
          arquivadas: estado.arquivadas,
        });
        plano = planoConstruido;

        return {
          ativas: estado.ativas.length,
          arquivadas: estado.arquivadas.length,
          plano: {
            criacoes: planoConstruido.criacoes.length,
            arquivamentos: planoConstruido.arquivamentos.length,
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

    // Estágio audit — ENH-0010: identidade das referências removidas (AC-4:
    // isolado em try/catch — falha não impede a conclusão do sync).
    const arAudit = resumoAplicacao?.arquivadas ?? 0;
    const dlAudit = resumoAplicacao?.deletadas ?? 0;

    if (arAudit > 0 || dlAudit > 0) {
      try {
        const eventosRemocao = await buscarTodasAsLinhas<LinhaEventoRemocao>((from, to) =>
          supabase
            .from("referencia_eventos")
            .select("tipo, referencia_id, detalhes")
            .eq("sync_id", syncId)
            .in("tipo", ["referencia_deletada", "referencia_arquivada"])
            .range(from, to)
        );

        detalhesEstagios.push({
          estagio: "audit",
          status: "ok",
          // ENH-0011: motivo extraído de detalhes como campo separado de identidade.
          // Eventos históricos sem motivo resultam em motivo: null.
          alteracoes: eventosRemocao.map((ev) => {
            const { motivo = null, ...identidade } = ev.detalhes ?? {};
            return {
              tipo: ev.tipo,
              referencia_id: ev.referencia_id,
              identidade,
              motivo: motivo as string | null,
            };
          }),
        });
      } catch (erroAudit) {
        console.error(
          `[referencias-sync] audit stage falhou (sync ${syncId}): ` +
            `${erroAudit instanceof Error ? erroAudit.message : String(erroAudit)}`
        );
        detalhesEstagios.push({
          estagio: "audit",
          status: "erro",
          erro: erroAudit instanceof Error ? erroAudit.message : String(erroAudit),
        });
      }
    }

    // Estágio 8 — conclusão: a sync sempre conclui com status `success` após
    // a aplicação (ENH-0009: sem curadoria, sem pending_review).
    const rejeitadasOrigem = validacao.rejeitadas.length;
    const sufixoRejeicoes =
      rejeitadasOrigem > 0
        ? ` ${rejeitadasOrigem} linha(s) da origem rejeitada(s) por dado inválido.`
        : "";

    const eq = resumoAplicacao?.equivalentes ?? 0;
    const cr = resumoAplicacao?.criadas ?? 0;
    const ar = resumoAplicacao?.arquivadas ?? 0;
    const dl = resumoAplicacao?.deletadas ?? 0;
    const mensagemFinal =
      `Sincronização concluída: ${eq} equivalentes, ${cr} criadas, ` +
      `${ar} arquivadas, ${dl} deletadas.` + sufixoRejeicoes;

    await concluirSync(
      supabase,
      syncId,
      "success",
      mensagemFinal,
      contagemOrigem,
      { estagios: detalhesEstagios }
    );

    console.info(
      `[referencias-sync] ${triggerSource} sync ${syncId} ok em ` +
        `${Date.now() - inicioRun}ms (${contagemOrigem} linhas, ${rejeitadasOrigem} rejeitadas, ` +
        `equivalentes ${eq}, criadas ${cr}, arquivadas ${ar}, deletadas ${dl})`
    );

    responder(res, 200, { sync_id: syncId, status: "success" });
  } catch (erro) {
    const message = mensagemErro(erro);

    if (erro instanceof SyncEmAndamento) {
      responder(res, 409, { error: "Sync já em andamento para este ambiente." });
      return;
    }

    console.error(`[referencias-sync] ${triggerSource} sync ${syncId ?? "<sem-claim>"} falhou: ${message}`);

    // Falha antes do claim (ex.: erro de rede no INSERT) não tem sync a marcar.
    if (syncId) {
      try {
        // Decisão 5 do M4: se a RPC de aplicação já retornou ok, as alterações
        // SÃO fato (contadores gravados na sync) — a falha é da conclusão;
        // a mensagem registra a verdade. Antes disso, nada foi aplicado.
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

    const message = mensagemErro(erro);

    console.error(`[referencias-sync] falha inesperada: ${message}`);

    responder(res, 500, { error: message });
  }
}
