/**
 * Motor puro de sincronização (FEAT-0017, M3 — design §7.5/§16): compõe a
 * chave canônica (canonical.ts) e a comparação (compare.ts) e produz o plano
 * de aplicação — o `p_plano jsonb` que a RPC `aplicar_sync_referencias` (M4)
 * aplica numa transação única. Módulo sem efeitos: não lê nem escreve domínio,
 * banco ou rede; entradas imutáveis, saída nova.
 *
 * Contrato da origem (rota/M4): linhas JÁ validadas por `validarExtracao`
 * (estrutura, tipos, faixa fenil 0–2040, sem conflitantes D-10). A dedupe de
 * exatas é feita aqui (mantém a 1ª ocorrência de cada identidade canônica);
 * `resumo.totalOrigem` conta as linhas recebidas ANTES da dedupe (espelha o
 * contador do banco).
 *
 * Idempotência (§6.6): dado o estado pós-aplicação (ativas = origem matched
 * + criadas; ausentes arquivadas com evento), a 2ª execução com a mesma
 * origem produz zero operações — toda divergência vira matched.
 *
 * Nunca: reativa, toca `is_global = false`, decide divergência ou exclui —
 * as únicas operações emitidas são `create` (novo id) e `archive`.
 */

import { chaveRef } from "./canonical.js";
import { comparar } from "./compare.js";
import type { LinhaOrigem } from "../powerbi/types.js";
import {
  PLANO_VERSAO,
  type ArquivadaGlobal,
  type DecisaoPendencia,
  type GlobalAtiva,
  type IdentidadeReferencia,
  type ModoSync,
  type OperacaoArquivamento,
  type OperacaoCriacao,
  type PendenciaAberta,
  type PlanoSync,
  type ResumoPlano,
  type TipoPendencia,
} from "./types.js";

export type EntradaPlanoSync = {
  /** Linhas da origem extraídas e validadas (contrato §6.3). */
  origem: LinhaOrigem[];
  /** Globais ativas (`is_global = true` e `is_ativa = true`). */
  ativas: GlobalAtiva[];
  /** Globais arquivadas com eventos de auditoria (ordem cronológica). */
  arquivadas: ArquivadaGlobal[];
  /** Pendências `open` de qualquer sync (dedupe global, D-6). */
  pendenciasAbertas: PendenciaAberta[];
  /** Decisões approved/rejected de absence/new_item, ordem cronológica. */
  decisoes: DecisaoPendencia[];
  /** bootstrap = 1ª sync real do ambiente (zero auto) — ver compare.ts. */
  modo: ModoSync;
};

/**
 * Linha validada → identidade canônica (marca nula ≡ '', §6.3). O contrato da
 * rota garante nome string não vazio, marca string ou nula e fenil numérico —
 * estreitamento igual ao do `validate.ts` (o motor não revalida).
 */
function linhaParaItem(linha: LinhaOrigem): IdentidadeReferencia {
  const marca = linha["Marca do Produto"];
  return {
    nome: linha["Nome do Produto"] as string,
    marca: marca == null ? "" : (marca as string),
    fenil_mg_por_100g: Number(linha["NU_MAX_AMINOACIDO"]),
  };
}

/** Dedupe de exatas (§6.3.4): 1ª ocorrência de cada chave canônica vence. */
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
    pendenciasAbertas: entrada.pendenciasAbertas,
    decisoes: entrada.decisoes,
    modo: entrada.modo,
  });

  const criacoes: OperacaoCriacao[] = resultado.itensParaCriar.map((identidade) => ({
    op: "create",
    identidade,
  }));

  const arquivamentos: OperacaoArquivamento[] = resultado.ativasParaArquivar.map((ativa) => ({
    op: "archive",
    referencia_id: ativa.id,
    identidade: { nome: ativa.nome, marca: ativa.marca, fenil_mg_por_100g: ativa.fenil_mg_por_100g },
  }));

  const pendenciasPorTipo: Record<TipoPendencia, number> = {
    substitution: 0,
    absence: 0,
    new_item: 0,
  };
  for (const pendencia of resultado.pendencias) {
    pendenciasPorTipo[pendencia.tipo]++;
  }

  const resumo: ResumoPlano = {
    totalOrigem: entrada.origem.length,
    equivalentes: resultado.equivalentes,
    criadas: criacoes.length,
    arquivadas: arquivamentos.length,
    divergencias: resultado.pendencias.length,
    pendencias: pendenciasPorTipo,
  };

  return {
    versao: PLANO_VERSAO,
    modo: entrada.modo,
    criacoes,
    arquivamentos,
    pendencias: resultado.pendencias,
    resumo,
  };
}
