/**
 * Modelo de identidade de referências (ENH-0004 + canônico revisto 2026-09-04):
 * nome e marca são atributos separados; a apresentação combinada
 * "Nome (Marca: X)" é montada aqui, dinamicamente — nunca re-embutida no
 * `nome` persistido.
 *
 * Marca EM BRANCO ('') = marca NÃO declarada (o padrão para produtos sem
 * marca, inclusive os criados manualmente) — exibe apenas o nome. 'Produto
 * In Natura' NÃO é mais um canônico de "sem marca": é uma MARCA DECLARADA
 * pela fonte ANVISA para produtos in natura (decidido em 2026-09-04; o
 * default do banco passou a ser '' — migration 20260904030000) e se exibe
 * como qualquer marca.
 *
 * O parse do sufixo "(Marca: ...)" abaixo é o espelho JS do backfill das
 * migrations 20260904000000 + 20260904010000 (ENH-0004): remove TODAS as
 * ocorrências sem parênteses internos e a ocorrência final (que pode conter
 * aninhamento, ex.: "(Marca: Kit Kat (Vegan))" — capturada até o último ")").
 * Diferença intencional: o JS colapsa espaços duplos deixados pela remoção
 * (entrada nova via UI); o SQL apenas remove e faz trim (dados legados).
 *
 * normalizarMarca também extrai o conteúdo de um invólucro "(Marca: X)"
 * digitado ou persistido na própria coluna marca — espelho JS da correção
 * de dados da migration 20260904020000 (bug do PR #55: o backfill original
 * gravou o invólucro verbatim).
 */

/** Variantes textuais de "marca não declarada" (fontes externas/legado) → ''. */
const VARIANTES_SEM_MARCA = new Set([
  "",
  "não se aplica/produto in natura",
  "nao se aplica/produto in natura",
  "não se aplica (produto in natura)",
  "nao se aplica (produto in natura)",
]);

/** Invólucro bem-formado "(Marca: <conteúdo>)" — corrigido pela 20260904020000. */
const WRAPPER_MARCA_RE = /^\(Marca:\s*(.*)\)\s*$/;

const SUFIXO_MARCA_RE = /\(Marca:[^()]*\)/g;
/** Sufixo FINAL sem parênteses internos (a última ocorrência ancorada ao fim). */
const SUFIXO_MARCA_FINAL_RE = /\(Marca:\s*([^()]*)\)\s*$/;
/** Sufixo final tolerante a parênteses internos — captura até o último ')'. */
const SUFIXO_MARCA_FINAL_ANINHADO_RE = /\(Marca:\s*(.*)\)\s*$/;

/**
 * Normaliza a marca para o modelo canônico:
 * - vazio/undefined → '' (marca não declarada);
 * - invólucro "(Marca: X)" → conteúdo interno (regressão do PR #55);
 * - variantes "não se aplica/... in natura" → '' (significam sem marca);
 * - demais textos (inclusive 'Produto In Natura') são preservados — são
 *   marcas declaradas pela fonte e se exibem como tal.
 */
export function normalizarMarca(marca?: string | null): string {
  let limpa = (marca ?? "").trim();
  // Entrada que ainda carrega o invólucro (dado legado ou campo digitado com
  // o texto completo exibido na UI): extrai o conteúdo interno com grupo de
  // captura — mesma regra da migration 20260904020000. Repetido para
  // invólucros aninhados; limite de guarda contra loop infinito.
  let camadas = 0;
  let wrapper: RegExpExecArray | null;
  while ((wrapper = WRAPPER_MARCA_RE.exec(limpa)) !== null && camadas < 3) {
    limpa = wrapper[1].trim();
    camadas += 1;
  }
  if (VARIANTES_SEM_MARCA.has(limpa.toLowerCase())) return "";
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

/**
 * Apresentação combinada "Nome (Marca: X)"; marca em branco (não declarada)
 * = só o nome. 'Produto In Natura' é marca declarada e aparece no sufixo.
 */
export function nomeComMarca(nome: string, marca?: string | null): string {
  const marcaNormalizada = normalizarMarca(marca);
  if (!marcaNormalizada) return nome;
  return `${nome} (Marca: ${marcaNormalizada})`;
}
