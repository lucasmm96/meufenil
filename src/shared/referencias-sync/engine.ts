/**
 * Motor puro de sincronização (FEAT-0017/ENH-0009, M3 — design §7.5/§16):
 * compõe a chave canônica (canonical.ts) e a comparação (compare.ts) e produz
 * o plano de aplicação — o `p_plano jsonb` que a RPC `aplicar_sync_referencias`
 * (M4) aplica numa transação única. Módulo sem efeitos: não lê nem escreve
 * domínio, banco ou rede; entradas imutáveis, saída nova.
 *
 * Contrato da origem (rota/M4): linhas JÁ validadas por `validarExtracao`
 * (estrutura, tipos, faixa fenil 0–2040, sem pares conflitantes — BR-044
 * revisada 2026-09-14). A dedupe de exatas é feita aqui (mantém a 1ª
 * ocorrência de cada identidade canônica); `resumo.totalOrigem` conta as linhas
 * recebidas ANTES da dedupe (espelha o contador do banco).
 *
 * Idempotência (§6.6): dado o estado pós-aplicação (ativas = origem matched +
 * criadas; ausentes arquivadas), a 2ª execução com a mesma origem produz zero
 * operações — toda divergência vira matched.
 */

import { chaveRef } from "./canonical.js";
import { comparar } from "./compare.js";
import type { LinhaOrigem } from "../powerbi/types.js";
import {
  PLANO_VERSAO,
  type ArquivadaGlobal,
  type GlobalAtiva,
  type IdentidadeReferencia,
  type OperacaoArquivamento,
  type OperacaoCriacao,
  type PlanoSync,
  type ResumoPlano,
} from "./types.js";

export type EntradaPlanoSync = {
  /** Linhas da origem extraídas e validadas (contrato §6.3). */
  origem: LinhaOrigem[];
  /** Globais ativas (`is_global = true` e `is_ativa = true`). */
  ativas: GlobalAtiva[];
  /** Globais arquivadas com eventos de auditoria (ordem cronológica). */
  arquivadas: ArquivadaGlobal[];
};

function linhaParaItem(linha: LinhaOrigem): IdentidadeReferencia {
  const marca = linha["Marca do Produto"];
  return {
    nome: linha["Nome do Produto"] as string,
    marca: marca == null ? "" : (marca as string),
    fenil_mg_por_100g: Number(linha["NU_MAX_AMINOACIDO"]),
  };
}

function deduplicar(linhas: LinhaOrigem[]): IdentidadeReferencia[] {
  const itens: IdentidadeReferencia[] = [];
  const vistas = new Set<string>();

  for (const linha of linhas) {
    const item = linhaParaItem(linha);
    const chave = chaveRef(item);
    if (!vistas.has(chave)) {
      vistas.add(chave);
      itens.push(item);
    }
  }

  return itens;
}

export function construirPlanoSync(entrada: EntradaPlanoSync): PlanoSync {
  const itens = deduplicar(entrada.origem);
  const resultado = comparar({
    origem: itens,
    ativas: entrada.ativas,
    arquivadas: entrada.arquivadas,
  });

  const criacoes: OperacaoCriacao[] = resultado.itensParaCriar.map((identidade) => ({
    op: "create",
    identidade,
  }));

  const arquivamentos: OperacaoArquivamento[] = resultado.ativasParaArquivar.map((ativa) => ({
    op: "archive",
    referencia_id: ativa.id,
    identidade: { nome: ativa.nome, marca: ativa.marca, fenil_mg_por_100g: ativa.fenil_mg_por_100g },
    motivo: ativa.motivo,
  }));

  const resumo: ResumoPlano = {
    totalOrigem: entrada.origem.length,
    equivalentes: resultado.equivalentes,
    criadas: criacoes.length,
    arquivadas: arquivamentos.filter((a) => a.motivo === "substituicao").length,
  };

  return {
    versao: PLANO_VERSAO,
    criacoes,
    arquivamentos,
    resumo,
  };
}
