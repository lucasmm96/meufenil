/**
 * Comparação bidirecional origem × banco (FEAT-0017/ENH-0009, M3 — design §7.3).
 *
 * Entrada (contrato da rota, M4 — SEMPRE validada e deduplicada, §6.3):
 * - `origem`: itens da extração validada;
 * - `ativas`/`arquivadas`: SOMENTE globais (`is_global = true`) — pessoais
 *   são intocadas (BR-034+; §7.3); arquivadas carregam os eventos de auditoria
 *   da referência para a derivação do motivo do arquivamento (B8(b), §6.4).
 *
 * Classificação por divergência (matriz §7.3 — ENH-0009):
 *   matched                     → nada (equivalente)
 *   novo                        → cria automaticamente
 *   ausente                     → arquiva automaticamente (motivo='ausencia')
 *   substituição                → auto-aplicada: archive(motivo='substituicao') + create
 *   reaparição (arquivada_pela_origem) → recria (mesmo fluxo do novo)
 *   reaparição de bloqueio manual      → silêncio (BR-042: nunca recriar contra
 *                                        desativação humana)
 *
 * Garantias: este módulo NUNCA reativa, nunca toca `is_global = false`, nunca
 * decide divergência e nunca exclui — o máximo que recomenda é `create`
 * (novo id) e `archive` (`is_ativa = false`). Determinístico: mesmas entradas
 * → mesma saída.
 */

import { chaveFenil, chaveNomeMarca, chaveRef } from "./canonical.js";
import type {
  ArquivadaGlobal,
  EventoArquivada,
  GlobalAtiva,
  IdentidadeReferencia,
  OrigemArquivada,
} from "./types.js";

const TIPO_EVENTO_ARQUIVADA = "referencia_arquivada";
const TIPOS_EVENTO_BLOQUEIO_MANUAL = new Set(["is_ativa_manual", "pre_sync_inativa"]);

export type EntradaComparacao = {
  origem: IdentidadeReferencia[];
  ativas: GlobalAtiva[];
  arquivadas: ArquivadaGlobal[];
};

export type ResultadoComparacao = {
  /** Matching sem ação (chaveRef presente nos dois lados). */
  equivalentes: number;
  /** Novos/reaparições a criar automaticamente. */
  itensParaCriar: IdentidadeReferencia[];
  /**
   * Ausentes e alvos de substituição a arquivar.
   * `motivo` informa a RPC se deve tentar deleção física (ausencia) ou apenas
   * soft-archive (substituicao).
   */
  ativasParaArquivar: Array<GlobalAtiva & { motivo: "ausencia" | "substituicao" }>;
};

/**
 * Derivação B8(b) do motivo do arquivamento de uma global (§6.4): o último
 * evento decisivo em ordem cronológica vence. Sem eventos decisivos (arquivo
 * legado anterior à auditoria) → `bloqueada_manual` (default conservador).
 */
export function derivarOrigemArquivada(eventos: EventoArquivada[]): OrigemArquivada {
  const decisivos = eventos
    .slice()
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    .filter((evento) => TIPOS_EVENTO_BLOQUEIO_MANUAL.has(evento.tipo) || evento.tipo === TIPO_EVENTO_ARQUIVADA);

  if (decisivos.length === 0) {
    return "bloqueada_manual";
  }

  const ultimo = decisivos[decisivos.length - 1];
  return ultimo.tipo === TIPO_EVENTO_ARQUIVADA ? "arquivada_pela_origem" : "bloqueada_manual";
}

export function comparar(entrada: EntradaComparacao): ResultadoComparacao {
  const { origem, ativas, arquivadas } = entrada;

  const ativaPorChave = new Map<string, GlobalAtiva>();
  for (const ativa of ativas) {
    ativaPorChave.set(chaveRef(ativa), ativa);
  }

  const candidatasPorNomeMarca = new Map<string, GlobalAtiva[]>();
  for (const ativa of ativas) {
    const chave = chaveNomeMarca(ativa);
    const grupo = candidatasPorNomeMarca.get(chave) ?? [];
    grupo.push(ativa);
    candidatasPorNomeMarca.set(chave, grupo);
  }

  const chavesDaOrigem = new Set(origem.map((item) => chaveRef(item)));

  // BR-042: bloqueio manual de arquivadas — nunca recriar contra desativação humana.
  const bloqueioManualPorChave = new Map<string, boolean>();
  for (const arquivada of arquivadas) {
    const chave = chaveRef(arquivada);
    const manual = derivarOrigemArquivada(arquivada.eventos) === "bloqueada_manual";
    bloqueioManualPorChave.set(chave, (bloqueioManualPorChave.get(chave) ?? false) || manual);
  }

  const itensParaCriar: IdentidadeReferencia[] = [];
  const ativasParaArquivar: Array<GlobalAtiva & { motivo: "ausencia" | "substituicao" }> = [];
  const alvosCobertosPorSubstituicao = new Set<string>();
  let equivalentes = 0;

  // Lado origem (ordem da entrada → saída determinística).
  for (const item of origem) {
    const chave = chaveRef(item);

    if (ativaPorChave.has(chave)) {
      equivalentes++;
      continue;
    }

    const candidatas = candidatasPorNomeMarca.get(chaveNomeMarca(item)) ?? [];

    if (candidatas.length > 0) {
      // Substituição auto-aplicada (ENH-0009): archive(motivo=substituicao) + create.
      // Determinismo quando há várias candidatas: menor distância de fenil; empate → menor id.
      const alvo = candidatas
        .slice()
        .sort((a, b) => {
          const dA = Math.abs(chaveFenil(a.fenil_mg_por_100g) - chaveFenil(item.fenil_mg_por_100g));
          const dB = Math.abs(chaveFenil(b.fenil_mg_por_100g) - chaveFenil(item.fenil_mg_por_100g));
          return dA - dB || a.id.localeCompare(b.id);
        })[0];

      alvosCobertosPorSubstituicao.add(alvo.id);
      ativasParaArquivar.push({ ...alvo, motivo: "substituicao" });
      itensParaCriar.push(item);
      continue;
    }

    // BR-042: bloqueio manual silencia a reaparição.
    if (bloqueioManualPorChave.get(chave)) {
      continue;
    }

    // Novo ou reaparição de arquivada_pela_origem: cria.
    itensParaCriar.push(item);
  }

  // Lado banco — ausências (ativas sem correspondência na origem).
  for (const ativa of ativas) {
    if (chavesDaOrigem.has(chaveRef(ativa))) continue;
    if (alvosCobertosPorSubstituicao.has(ativa.id)) continue;

    ativasParaArquivar.push({ ...ativa, motivo: "ausencia" });
  }

  return { equivalentes, itensParaCriar, ativasParaArquivar };
}
