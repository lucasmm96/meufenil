/**
 * Modelo canônico de referências (ENH-0004): nome e marca são atributos
 * separados; a apresentação combinada "Nome (Marca: X)" é montada aqui,
 * dinamicamente — nunca re-embutida no `nome` persistido.
 *
 * O parse do sufixo "(Marca: ...)" abaixo é o espelho JS do backfill das
 * migrations 20260904000000 + 20260904010000 (ENH-0004): remove TODAS as
 * ocorrências sem parênteses internos e a ocorrência final (que pode conter
 * aninhamento, ex.: "(Marca: Kit Kat (Vegan))" — capturada até o último ")").
 * Diferença intencional: o JS colapsa espaços duplos deixados pela remoção
 * (entrada nova via UI); o SQL apenas remove e faz trim (dados legados).
 */

/** Representação canônica de "sem marca" / produto in natura (OQ2 da ENH-0004). */
export const MARCA_SEM_MARCA = "Produto In Natura";

const SUFIXO_MARCA_RE = /\(Marca:[^()]*\)/g;
/** Sufixo FINAL sem parênteses internos (a última ocorrência ancorada ao fim). */
const SUFIXO_MARCA_FINAL_RE = /\(Marca:\s*([^()]*)\)\s*$/;
/** Sufixo final tolerante a parênteses internos — captura até o último ')'. */
const SUFIXO_MARCA_FINAL_ANINHADO_RE = /\(Marca:\s*(.*)\)\s*$/;

const VARIANTES_SEM_MARCA = new Set([
  "",
  "não se aplica/produto in natura",
  "nao se aplica/produto in natura",
  "não se aplica (produto in natura)",
  "nao se aplica (produto in natura)",
]);

export function normalizarMarca(marca?: string | null): string {
  const limpa = (marca ?? "").trim();
  if (VARIANTES_SEM_MARCA.has(limpa.toLowerCase())) return MARCA_SEM_MARCA;
  return limpa;
}

export function extrairMarcaDoNome(nome: string): {
  nome: string;
  marca: string;
} {
  // Marca: prefere a ocorrência final sem aninhamento; se a final tiver
  // parênteses internos (ex.: "Kit Kat (Vegan)"), captura até o último ')'.
  const simples = SUFIXO_MARCA_FINAL_RE.exec(nome);
  const marca = simples
    ? simples[1]
    : SUFIXO_MARCA_FINAL_ANINHADO_RE.exec(nome)?.[1];

  // Nome: remove TODAS as ocorrências sem parênteses internos (em qualquer
  // posição) e, se restar, a ocorrência aninhada ancorada ao fim — mesma
  // cadeia das migrations 20260904000000 + 20260904010000.
  const limpo = nome
    .replace(SUFIXO_MARCA_RE, "")
    .replace(SUFIXO_MARCA_FINAL_ANINHADO_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    nome: limpo,
    marca: normalizarMarca(marca),
  };
}

/** Apresentação combinada "Nome (Marca: X)"; sem marca/in natura = só o nome. */
export function nomeComMarca(nome: string, marca?: string | null): string {
  const marcaNormalizada = normalizarMarca(marca);
  if (!marcaNormalizada || marcaNormalizada === MARCA_SEM_MARCA) return nome;
  return `${nome} (Marca: ${marcaNormalizada})`;
}
