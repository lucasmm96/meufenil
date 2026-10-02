import { requireConfirm, validateTableName } from "../utils.js";

export async function seedReferenciaCommand({ db, args }) {
  requireConfirm(args, "seed-referencia");

  const table = "referencias";
  validateTableName(table);

  const nome = args.nome;
  const fenil = args.fenil;
  const criadoPor = args["criado-por"] ?? args.criado_por;

  if (!nome || !fenil || !criadoPor) {
    throw new Error(
      "Uso: seed-referencia --nome \"Alimento\" --fenil 12.3 --criado-por UUID --confirm"
    );
  }

  const payload = {
    nome,
    fenil_mg_por_100g: Number(fenil),
    criado_por: criadoPor,
    is_global: false,
  };

  const { data, error } = await db.from(table).insert(payload).select("*").single();
  if (error) throw error;

  return {
    inserted: data,
  };
}

