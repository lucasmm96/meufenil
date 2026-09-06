/**
 * Modelo de dados do motor de sincronização de referências (FEAT-0017, M3) —
 * tipos PUROS, sem escrita de domínio. Espelham o schema real do M1
 * (`supabase/migrations/20260905000000_referencias_sync_tabelas.sql`) e a
 * identidade canônica do banco (`referencias` — ENH-0004).
 *
 * O `PlanoSync` é o `p_plano jsonb` (design §7.5): a rota (M4) produz o plano
 * no motor e o entrega à RPC `aplicar_sync_referencias` numa transação única.
 * Chaves do jsonb = exatamente estes campos (camelCase); a RPC lê
 * `criacoes`/`arquivamentos`/`pendencias` — não alterar sem migrar o SQL.
 *
 * Entradas do motor (M4 monta a partir do banco):
 * - `ativas` e `arquivadas`: SOMENTE globais (`is_global = true`) — pessoais
 *   são intocadas (BR-034+; design §7.3); ativas = `is_ativa`, arquivadas =
 *   `is_ativa = false` com os eventos de auditoria da referência;
 * - `pendenciasAbertas`: pendências `open` de QUALQUER sync (D-6 — dedupe
 *   global de abertas, não apenas da sync corrente);
 * - `decisoes`: pendências decididas (`approved`/`rejected`) de absence e
 *   new_item, em ordem cronológica de decisão (a última vence) — alimentam a
 *   re-apresentação pós-rejeição (decisão humana 2026-09-06; ver compare.ts).
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

export type TipoPendencia = "substitution" | "absence" | "new_item";

export type StatusDecisao = "approved" | "rejected";

/** Pendência `open` (dedupe D-6 — bloqueia ação automática e nova pendência). */
export type PendenciaAberta = {
  tipo: TipoPendencia;
  referencia_id: string | null;
  proposta: IdentidadeReferencia | null;
};

/**
 * Pendência decidida de absence/new_item — única memória pós-rejeição do
 * motor (decisão humana 2026-09-06): rejeição não cria regra permanente, mas
 * o auto-apply nunca a desfaz — a divergência volta como NOVA pendência
 * enquanto persistir. Decisões de substitution não entram (substituição é
 * sempre pendência; não há auto a suprimir).
 */
export type DecisaoPendencia = {
  tipo: "absence" | "new_item";
  referencia_id: string | null;
  proposta: IdentidadeReferencia | null;
  status: StatusDecisao;
};

/** Derivação B8(b) do estado inativo de uma global arquivada (§6.4). */
export type OrigemArquivada = "arquivada_pela_origem" | "bloqueada_manual";

/** 1ª sync do ambiente (zero auto) × sync confiável pós-bootstrap. */
export type ModoSync = "bootstrap" | "pos_bootstrap";

/** Mudança campo a campo para diff GitHub-like (design §5.2/§8). */
export type DiffCampo = {
  campo: "nome" | "marca" | "fenil_mg_por_100g";
  antes: string | number;
  depois: string | number;
};

/** Pendência a criar — espelho das colunas de `referencia_sync_pendencias`. */
export type PendenciaPlano = {
  tipo: TipoPendencia;
  referencia_id: string | null;
  proposta: IdentidadeReferencia | null;
  diff: DiffCampo[] | null;
};

/** Aplicação automática: criação de nova global (nunca reativa, nunca UPDATE). */
export type OperacaoCriacao = {
  op: "create";
  identidade: IdentidadeReferencia;
};

/** Aplicação automática: arquivamento por ausência (`is_ativa = false`). */
export type OperacaoArquivamento = {
  op: "archive";
  referencia_id: string;
  identidade: IdentidadeReferencia;
};

/** Contadores — espelham as colunas de `referencia_syncs` (§5.1). */
export type ResumoPlano = {
  /** Linhas recebidas da origem (antes da dedupe de exatas). */
  totalOrigem: number;
  /** Matching sem ação (design §7.3). */
  equivalentes: number;
  /** Criações automáticas (auto-apply pós-bootstrap). */
  criadas: number;
  /** Arquivamentos automáticos por ausência (pós-bootstrap). */
  arquivadas: number;
  /** Pendências novas a criar (curadoria). */
  divergencias: number;
  pendencias: Record<TipoPendencia, number>;
};

/** Plano de aplicação — `p_plano jsonb` da RPC `aplicar_sync_referencias`. */
export type PlanoSync = {
  versao: typeof PLANO_VERSAO;
  modo: ModoSync;
  criacoes: OperacaoCriacao[];
  arquivamentos: OperacaoArquivamento[];
  pendencias: PendenciaPlano[];
  resumo: ResumoPlano;
};
