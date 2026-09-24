/**
 * Modelo de dados do motor de sincronização de referências (FEAT-0017/ENH-0009)
 * — tipos PUROS, sem escrita de domínio. Espelham o schema real do M1 e a
 * identidade canônica do banco (`referencias` — ENH-0004).
 *
 * O `PlanoSync` é o `p_plano jsonb` (design §7.5): a rota (M4) produz o plano
 * no motor e o entrega à RPC `aplicar_sync_referencias` numa transação única.
 * Chaves do jsonb = exatamente estes campos; a RPC lê `criacoes`/`arquivamentos`
 * — não alterar sem migrar o SQL.
 *
 * Entradas do motor (M4 monta a partir do banco):
 * - `ativas` e `arquivadas`: SOMENTE globais (`is_global = true`) — pessoais
 *   são intocadas (BR-034+; design §7.3); ativas = `is_ativa`, arquivadas =
 *   `is_ativa = false` com os eventos de auditoria da referência;
 */

export const PLANO_VERSAO = 1 as const;

/** Identidade oficial de uma referência — colunas de `referencias` (verbatim). */
export type IdentidadeReferencia = {
  nome: string;
  marca: string;
  fenil_mg_por_100g: number;
};

/** Global ativa (`is_global = true` e `is_ativa = true`). */
export type GlobalAtiva = IdentidadeReferencia & { id: string };

/** Global arquivada com os eventos de auditoria da referência (B8 derivação). */
export type ArquivadaGlobal = IdentidadeReferencia & {
  /** Eventos da referência em ordem cronológica (query da M4). */
  eventos: EventoArquivada[];
};

/** Evento de auditoria relevante para a derivação do estado inativo (§6.4). */
export type EventoArquivada = {
  tipo: string;
  criadoEm: string;
};

/** Derivação B8(b) do estado inativo de uma global arquivada (§6.4). */
export type OrigemArquivada = "arquivada_pela_origem" | "bloqueada_manual";

/** Aplicação automática: criação de nova global (nunca reativa, nunca UPDATE). */
export type OperacaoCriacao = {
  op: "create";
  identidade: IdentidadeReferencia;
};

/**
 * Arquivamento automático por ausência ou substituição auto-aplicada.
 * - `ausencia`: referência desapareceu da origem; RPC tenta DELETE físico
 *   e degrada para soft-archive se houver vínculos (registros/favoritas).
 * - `substituicao`: referência substituída por outra na mesma posição
 *   nome+marca; sempre soft-archive (é_global=true, is_ativa=false).
 */
export type OperacaoArquivamento = {
  op: "archive";
  referencia_id: string;
  identidade: IdentidadeReferencia;
  motivo: "ausencia" | "substituicao";
};

/** Contadores — espelham as colunas de `referencia_syncs` (§5.1). */
export type ResumoPlano = {
  /** Linhas recebidas da origem (antes da dedupe de exatas). */
  totalOrigem: number;
  /** Matching sem ação (design §7.3). */
  equivalentes: number;
  /** Criações automáticas (auto-apply). */
  criadas: number;
  /** Soft-archivamentos (ausência com vínculos, ou substituição). */
  arquivadas: number;
};

/** Plano de aplicação — `p_plano jsonb` da RPC `aplicar_sync_referencias`. */
export type PlanoSync = {
  versao: typeof PLANO_VERSAO;
  criacoes: OperacaoCriacao[];
  arquivamentos: OperacaoArquivamento[];
  resumo: ResumoPlano;
};
