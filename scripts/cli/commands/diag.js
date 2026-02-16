import { validateTableName } from "../utils.js";

export async function diagCommand({ db, args }) {
  const table = args.table ?? "referencias";
  validateTableName(table);

  const { count, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;

  return {
    table,
    count,
  };
}

