/**
 * Chave canônica do motor de sincronização (FEAT-0017, D-8 — design §7.1/§7.2).
 *
 * Espelho EXATO do índice único parcial do banco:
 *
 *   `referencias_identidade_ativa_unique` (20260904040000, ENH-0004):
 *   `btree (lower(trim(both from nome)), lower(trim(both from marca)),
 *          fenil_mg_por_100g) where is_ativa`
 *
 * com `fenil_mg_por_100g numeric(10,1)`. A chave é aplicada AOS DOIS LADOS
 * (origem e banco) para que "igual no motor" ≡ "igual no índice" — sem
 * falsos-positivos de criação nem matching que o banco não aceitaria.
 *
 * Regras de marca (§7.2): para MATCHING, variantes textuais case-insensíveis
 * de "sem marca" (espelho de `VARIANTES_SEM_MARCA` em
 * `src/react-app/lib/referencias.ts`) E `produto in natura` mapeiam para ''
 * — unificação determinística que evita pares ausência+criação artificiais
 * por variação textual de marca. O VALOR persistido nunca é normalizado aqui
 * (verbatim, fidelidade §3/§6); `normalizarMarca` (react-app) preserva
 * 'Produto In Natura' de propósito — a chave de matching é deliberadamente
 * mais larga (diferença documentada, não bug).
 *
 * Separador das chaves compostas: escape `\u0001` (SOH — design §7.1),
 * textual no arquivo — NUNCA byte de controle cru (mesma convenção do `\u0000`
 * da chave de duplicidade em `src/shared/powerbi/validate.ts`, que é par
 * interno da validação e nunca se mistura com as chaves do motor).
 */

import type { IdentidadeReferencia } from "./types.js";

/** Separador das chaves compostas (design §7.1 — SOH, escape textual). */
const SEPARADOR_CHAVE = "\u0001";

/** `VARIANTES_SEM_MARCA` de `src/react-app/lib/referencias.ts` + §7.2. */
const SEM_MARCA_PARA_CHAVE = new Set([
  "",
  "não se aplica/produto in natura",
  "nao se aplica/produto in natura",
  "não se aplica (produto in natura)",
  "nao se aplica (produto in natura)",
  "produto in natura",
]);

export function chaveNome(nome: string): string {
  return nome.trim().toLowerCase();
}

/** lower(trim) com as variantes "sem marca"/"produto in natura" → ''. */
export function chaveMarca(marca: string): string {
  const limpa = marca.trim().toLowerCase();
  return SEM_MARCA_PARA_CHAVE.has(limpa) ? "" : limpa;
}

/**
 * Fenil canônico: `round(numeric(10,1))` — o banco armazena escala 1
 * (numeric(10,1) arredonda na escrita; origem é inteiro 0–2040 validado) e
 * 184 ≡ 184.0 no índice. O arredondamento é no-op para os valores possíveis;
 * existe para normalizar ruído numérico sem mudar a comparação do banco.
 * Meio (x.5) arredonda para +∞ em valores positivos — igual ao numeric do
 * Postgres (faixa 0–2040; negativos não ocorrem na origem validada).
 */
export function chaveFenil(fenil: number): number {
  return Math.round(fenil * 10) / 10;
}

/** Par nome+marca canônico — agrupamento da substituição (§7.3). */
export function chaveNomeMarca(item: IdentidadeReferencia): string {
  return `${chaveNome(item.nome)}${SEPARADOR_CHAVE}${chaveMarca(item.marca)}`;
}

/** Chave completa nome+marca+fenil — identidade canônica (3 partes). */
export function chaveRef(item: IdentidadeReferencia): string {
  return `${chaveNome(item.nome)}${SEPARADOR_CHAVE}${chaveMarca(item.marca)}${SEPARADOR_CHAVE}${chaveFenil(item.fenil_mg_por_100g)}`;
}
