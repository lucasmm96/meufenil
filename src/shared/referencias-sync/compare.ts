/**
 * Comparação bidirecional origem × banco (FEAT-0017, M3 — design §7.3).
 *
 * Entrada (contrato da rota, M4 — SEMPRE validada e deduplicada, §6.3):
 * - `origem`: itens da extração validada; D-10 garante que linhas que dividem
 *   nome+marca têm o MESMO fenil — logo, numa origem válida nenhuma global
 *   com correspondência exata (matched) participa de um grupo de substituição;
 * - `ativas`/`arquivadas`: SOMENTE globais (`is_global = true`) — pessoais
 *   são intocadas (BR-034+; §7.3); arquivadas carregam os eventos de auditoria
 *   da referência para a derivação do motivo do arquivamento (B8(b), §6.4);
 * - `pendenciasAbertas`: pendências `open` de QUALQUER sync (D-6) — cobrem o
 *   alvo (absence/substitution) ou a proposta (new_item): nem ação automática
 *   nem pendência nova enquanto estiverem abertas;
 * - `decisoes`: decisões `approved`/`rejected` de absence e new_item, em ordem
 *   cronológica (a última vence). Memória de rejeição (decisão humana
 *   2026-09-06): rejeição não cria regra permanente, mas o auto-apply nunca a
 *   desfaz — a divergência volta como NOVA pendência enquanto persistir;
 * - `modo`: `bootstrap` (1ª sync do ambiente — zero auto, tudo vira pendência)
 *   vs. `pos_bootstrap` (auto: criar novo + arquivar ausente; substituição é
 *   SEMPRE pendência, nos dois modos). A rota (M4) deriva o modo do histórico
 *   de syncs do environment com `derivarModoSync` (design §14.1/§14.4):
 *   pós-bootstrap sse existe sync anterior com extração válida concluída
 *   (`success`/`pending_review`).
 *
 * Classificação por divergência (matriz §7.3):
 *   matched                     → nada (equivalente)
 *   novo                        → cria (pos_bootstrap) | pendência (bootstrap)
 *   ausente                     → arquiva (pos_bootstrap) | pendência (bootstrap)
 *   substituição                → pendência SEMPRE (nunca auto)
 *   reaparição (arquivada_pela_origem) → recria (mesmo fluxo do novo)
 *   reaparição de bloqueio manual      → silêncio (nunca recria contra
 *                                        desativação humana)
 *   divergência com pendência open     → nada (D-6, aguarda decisão)
 *
 * Garantias: este módulo NUNCA reativa, nunca toca `is_global = false`, nunca
 * decide divergência e nunca exclui — o máximo que recomenda é `create`
 * (novo id) e `archive` (`is_ativa = false`). Determinístico: mesmas entradas
 * → mesma saída (idempotência §6.6 emerge no engine: 2ª execução com o estado
 * pós-aplicação → tudo matched, zero operações).
 */

import { chaveFenil, chaveNomeMarca, chaveRef } from "./canonical.js";
import type {
  ArquivadaGlobal,
  DecisaoPendencia,
  DiffCampo,
  EventoArquivada,
  GlobalAtiva,
  IdentidadeReferencia,
  ModoSync,
  OrigemArquivada,
  PendenciaAberta,
  PendenciaPlano,
  StatusDecisao,
} from "./types.js";

/**
 * Eventos de auditoria decisivos da derivação B8(b) (§6.4) — valores do enum
 * `referencia_eventos.tipo` (M1, 20260905000000). `referencia_arquivada` =
 * arquivamento decidido pela origem/sync; `is_ativa_manual` e
 * `pre_sync_inativa` = bloqueio manual (curadoria/seed). Qualquer outro evento
 * (ex.: `mudanca_aprovada`, `rollback`) é irrelevante para a derivação.
 */
const TIPO_EVENTO_ARQUIVADA = "referencia_arquivada";
const TIPOS_EVENTO_BLOQUEIO_MANUAL = new Set(["is_ativa_manual", "pre_sync_inativa"]);

export type EntradaComparacao = {
  origem: IdentidadeReferencia[];
  ativas: GlobalAtiva[];
  arquivadas: ArquivadaGlobal[];
  pendenciasAbertas: PendenciaAberta[];
  decisoes: DecisaoPendencia[];
  modo: ModoSync;
};

export type ResultadoComparacao = {
  /** Matching sem ação (chaveRef presente nos dois lados). */
  equivalentes: number;
  /** Novos/reaparições a criar automaticamente (nunca no bootstrap). */
  itensParaCriar: IdentidadeReferencia[];
  /** Ausentes a arquivar automaticamente (nunca no bootstrap). */
  ativasParaArquivar: GlobalAtiva[];
  /** Pendências novas a criar (curadoria) — ordem determinística. */
  pendencias: PendenciaPlano[];
};

/**
 * Derivação B8(b) do motivo do arquivamento de uma global (§6.4): o último
 * evento decisivo em ordem cronológica vence. Sem eventos decisivos (arquivo
 * legado anterior à auditoria) → `bloqueada_manual` (default conservador:
 * ausência de evidência não autoriza recriação automática). Empates de
 * `criadoEm` mantêm a ordem da entrada (query da M4 é ORDER BY criadoEm).
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

/**
 * Derivação do modo da sync a partir do histórico do environment (design
 * §14.1/§14.4): pós-bootstrap sse existe sync ANTERIOR com extração válida
 * concluída (`success` ou `pending_review` — sync confiável). Sem histórico
 * confiável (nenhuma sync, só `failure`/`origin_invalid`/`running`) →
 * `bootstrap` (1ª sync real: zero auto). A ordem do histórico é irrelevante
 * (verifica existência); a rota (M4) consulta os status das syncs do mesmo
 * environment e passa o resultado a esta função — determinística.
 */
export function derivarModoSync(historico: { status: string }[]): ModoSync {
  const confiavel = historico.some(
    (sync) => sync.status === "success" || sync.status === "pending_review",
  );
  return confiavel ? "pos_bootstrap" : "bootstrap";
}

export function comparar(entrada: EntradaComparacao): ResultadoComparacao {
  const { origem, ativas, arquivadas, pendenciasAbertas, decisoes, modo } = entrada;

  // Índice das ativas por identidade canônica completa (chaveRef).
  const ativaPorChave = new Map<string, GlobalAtiva>();
  for (const ativa of ativas) {
    ativaPorChave.set(chaveRef(ativa), ativa);
  }

  // Índice de agrupamento da substituição: nome+marca → candidatas ativas.
  const candidatasPorNomeMarca = new Map<string, GlobalAtiva[]>();
  for (const ativa of ativas) {
    const chave = chaveNomeMarca(ativa);
    const grupo = candidatasPorNomeMarca.get(chave) ?? [];
    grupo.push(ativa);
    candidatasPorNomeMarca.set(chave, grupo);
  }

  const chavesDaOrigem = new Set(origem.map((item) => chaveRef(item)));

  // D-6 — pendências open cobrem alvo (absence/substitution) ou proposta
  // (new_item, por fingerprint da proposta). Alvo/proposta coberto: nada.
  const alvosComPendenciaAberta = new Set<string>();
  const propostasComPendenciaAberta = new Set<string>();
  for (const pendencia of pendenciasAbertas) {
    if (pendencia.tipo === "substitution" || pendencia.tipo === "absence") {
      if (pendencia.referencia_id) {
        alvosComPendenciaAberta.add(pendencia.referencia_id);
      }
    } else if (pendencia.proposta) {
      propostasComPendenciaAberta.add(chaveRef(pendencia.proposta));
    }
  }

  // Última decisão por divergência (entrada em ordem cronológica — a última
  // vence; ver doc do módulo). Só a REJEIÇÃO como última decisão importa:
  // suprime o auto (criação/arquivamento) e devolve a divergência ao fluxo
  // de pendências (re-apresentação). Decisão posterior approved/cancelled
  // reautoriza o auto — não guardamos memória de não-rejeições.
  const statusAusencia = new Map<string, StatusDecisao>();
  const statusNovo = new Map<string, StatusDecisao>();
  for (const decisao of decisoes) {
    if (decisao.tipo === "absence" && decisao.referencia_id) {
      statusAusencia.set(decisao.referencia_id, decisao.status);
    } else if (decisao.tipo === "new_item" && decisao.proposta) {
      statusNovo.set(chaveRef(decisao.proposta), decisao.status);
    }
  }

  // Reaparição × bloqueio manual: arquivada com MESMA identidade canônica e
  // derivação manual silencia a divergência (nunca recriar contra decisão
  // humana). Múltiplas arquivadas com a mesma identidade: prevalece o
  // bloqueio manual, se houver (default conservador).
  const bloqueioManualPorChave = new Map<string, boolean>();
  for (const arquivada of arquivadas) {
    const chave = chaveRef(arquivada);
    const manual = derivarOrigemArquivada(arquivada.eventos) === "bloqueada_manual";
    bloqueioManualPorChave.set(chave, (bloqueioManualPorChave.get(chave) ?? false) || manual);
  }

  const itensParaCriar: IdentidadeReferencia[] = [];
  const pendencias: PendenciaPlano[] = [];
  const alvosCobertosPorSubstituicao = new Set<string>();
  let equivalentes = 0;

  // Lado origem (ordem da entrada → saída determinística).
  for (const item of origem) {
    const chave = chaveRef(item);

    if (ativaPorChave.has(chave)) {
      equivalentes++;
      continue;
    }

    // Divergência já coberta por pendência aberta de new_item (D-6).
    if (propostasComPendenciaAberta.has(chave)) {
      continue;
    }

    const candidatas = candidatasPorNomeMarca.get(chaveNomeMarca(item)) ?? [];

    if (candidatas.length > 0) {
      // Substituição: existe global ativa com o mesmo nome+marca e fenil
      // DIFERENTE (por exclusão — a chave exata não está em ativaPorChave).
      // SEMPRE pendência (B7/§7.4): mudança de fenil de item com marca é
      // irreversível na ponta (foto diária) e merece curadoria.
      // Determinismo do alvo quando há várias candidatas (origem válida não
      // produz grupo misto — ver doc do módulo): menor distância de fenil
      // canônico; empate → menor id; pula alvos com pendência aberta (D-6).
      const ordenadas = candidatas
        .slice()
        .sort((a, b) => {
          const distanciaA = Math.abs(chaveFenil(a.fenil_mg_por_100g) - chaveFenil(item.fenil_mg_por_100g));
          const distanciaB = Math.abs(chaveFenil(b.fenil_mg_por_100g) - chaveFenil(item.fenil_mg_por_100g));
          return distanciaA - distanciaB || a.id.localeCompare(b.id);
        });
      const alvo = ordenadas.find((candidata) => !alvosComPendenciaAberta.has(candidata.id));

      if (!alvo) {
        // Todas as candidatas cobertas por pendência aberta — aguarda (D-6).
        continue;
      }

      // Cobre o alvo: sem isso ele seria também classificado como ausente.
      alvosCobertosPorSubstituicao.add(alvo.id);
      pendencias.push({
        tipo: "substitution",
        referencia_id: alvo.id,
        proposta: item,
        diff: diffSubstituicao(alvo, item),
      });
      continue;
    }

    // Sem ativa com nome+marca: novo — ou reaparição de arquivada (recria,
    // §17) quando não houver bloqueio manual na mesma identidade canônica.
    if (bloqueioManualPorChave.get(chave)) {
      continue; // silêncio — humano desativou; presença na origem não é divergência
    }

    const rejeitada = statusNovo.get(chave) === "rejected";

    if (modo === "bootstrap" || rejeitada) {
      pendencias.push({ tipo: "new_item", referencia_id: null, proposta: item, diff: null });
    } else {
      itensParaCriar.push(item);
    }
  }

  // Lado banco — ausências (ativas sem correspondência na origem). NUNCA
  // cobre matched, alvo de substituição ou alvo com pendência aberta.
  const ativasParaArquivar: GlobalAtiva[] = [];
  for (const ativa of ativas) {
    if (chavesDaOrigem.has(chaveRef(ativa))) {
      continue;
    }
    if (alvosCobertosPorSubstituicao.has(ativa.id)) {
      continue;
    }
    if (alvosComPendenciaAberta.has(ativa.id)) {
      continue; // D-6 — aguarda decisão da pendência que cobre esta ausência
    }

    const rejeitada = statusAusencia.get(ativa.id) === "rejected";

    if (modo === "bootstrap" || rejeitada) {
      pendencias.push({ tipo: "absence", referencia_id: ativa.id, proposta: null, diff: null });
    } else {
      ativasParaArquivar.push(ativa);
    }
  }

  return { equivalentes, itensParaCriar, ativasParaArquivar, pendencias };
}

/** Diff campo a campo alvo → proposta (verbatim, fidelidade §3/§6). */
function diffSubstituicao(alvo: GlobalAtiva, item: IdentidadeReferencia): DiffCampo[] {
  const diff: DiffCampo[] = [];

  if (alvo.nome !== item.nome) {
    diff.push({ campo: "nome", antes: alvo.nome, depois: item.nome });
  }
  if (alvo.marca !== item.marca) {
    diff.push({ campo: "marca", antes: alvo.marca, depois: item.marca });
  }
  if (alvo.fenil_mg_por_100g !== item.fenil_mg_por_100g) {
    diff.push({
      campo: "fenil_mg_por_100g",
      antes: alvo.fenil_mg_por_100g,
      depois: item.fenil_mg_por_100g,
    });
  }

  return diff;
}
