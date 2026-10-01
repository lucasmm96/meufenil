import { validateTableName } from "../utils.js";

export async function listCommand({ db, args }) {
  const table = args.table;
  if (!table) {
    throw new Error("Uso: list --table NOME_TABELA [--select campos] [--limit 20]");
  }
  validateTableName(table);

  const select = args.select ?? "*";
  const limit = args.limit ? Number(args.limit) : 20;
  const order = args.order;
  const desc = Boolean(args.desc);

  let query = db.from(table).select(select);
  if (order) {
    query = query.order(order, { ascending: !desc });
  }
  if (!Number.isNaN(limit)) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    table,
    count: Array.isArray(data) ? data.length : 0,
    data,
  };
}

