export function parseArgs(argv) {
  const args = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (!current.startsWith("--")) {
      args._.push(current);
      continue;
    }

    const withoutPrefix = current.slice(2);
    const eqIndex = withoutPrefix.indexOf("=");
    if (eqIndex !== -1) {
      const key = withoutPrefix.slice(0, eqIndex);
      const value = withoutPrefix.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const key = withoutPrefix;
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

