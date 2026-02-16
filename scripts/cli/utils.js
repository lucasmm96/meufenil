export function validateTableName(table) {
  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    throw new Error(`Nome de tabela inválido: ${table}`);
  }
}

export function requireConfirm(args, commandName) {
  if (args.confirm !== true && args.confirm !== "true") {
    throw new Error(
      `Confirmação obrigatória. Use --confirm para executar ${commandName}.`
    );
  }
}

export function printResult(result) {
  const text = JSON.stringify(result, null, 2);
  console.log(text);
}

