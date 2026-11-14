/**
 * The command line, parsed: positional words, and `--name value`, `--name=value` or a bare
 * `--flag`. A value never starts with `--`.
 */
export interface Parsed {
  positional: string[];
  opts: Record<string, string | boolean>;
}

/** Options that take no value. */
const FLAGS = new Set(['json', 'no-starter', 'desktop', 'no-ws', 'backup', 'accept-loss', 'yes', 'system', 'help']);

export function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = a.slice(2, eq < 0 ? undefined : eq);
      if (eq >= 0) opts[name] = a.slice(eq + 1);
      else if (FLAGS.has(name) || i + 1 >= argv.length || argv[i + 1]!.startsWith('--')) opts[name] = true;
      else opts[name] = argv[++i]!;
    } else {
      positional.push(a);
    }
  }
  return { positional, opts };
}
