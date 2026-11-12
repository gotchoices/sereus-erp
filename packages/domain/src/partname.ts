// Partnames and part numbers (design/specs/domain/product.md §2, §3).
//
//   a:chan(2400,4,w)      a configuration, in the current version
//   a:chan(2400,4,w).3    the configuration as defined by family version 3
//   1234                  a part number, in the current version
//   1234.3 / 1234.0       that part under version 3 / version unknown
//
// Parameter values are compared and stored in canonical form: numbers without a leading '+',
// leading zeros or trailing zeros, enum and str values as given (trimmed).

/** A family base: `prefix:name`, as product.md §2 and catalog.qsql (FamilyBaseFormat) define it. */
export function isBase(text: string): boolean {
  return /^[A-Za-z0-9@]:[A-Za-z0-9_]+$/.test(text) && text.length <= 64;
}

/**
 * The canonical form of a decimal number, or null when `text` is not one.
 * `0.3750` → `0.375`, `.375` → `0.375`, `+12.0` → `12`, `-0` → `0`, `1e3` → null.
 */
export function canonicalNumber(text: string): string | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!m) return null;
  const [, sign, whole = '', frac = ''] = m;
  if (whole === '' && frac === '') return null;
  const w = whole.replace(/^0+(?=\d)/, '') || '0';
  const f = frac.replace(/0+$/, '');
  const body = f ? `${w}.${f}` : w;
  return body === '0' || sign !== '-' ? body : `-${body}`;
}

export type Partname =
  | { kind: 'config'; base: string; params: string[]; ver: number | null }
  | { kind: 'pnum'; pnum: number; ver: number | null };

/**
 * Parse a partname or part number. Parameter values are split on commas and trimmed, but not
 * canonicalized: that needs the family's parameter types. Throws SyntaxError.
 */
export function parsePartname(text: string): Partname {
  const s = text.trim();
  const num = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (num) {
    const pnum = Number(num[1]);
    if (pnum < 1 || !Number.isSafeInteger(pnum)) throw new SyntaxError(`not a part number: ${JSON.stringify(text)}`);
    return { kind: 'pnum', pnum, ver: num[2] === undefined ? null : Number(num[2]) };
  }
  const cfg = /^([^()\s]+)(?:\(([^()]*)\))?(?:\.(\d+))?$/.exec(s);
  if (!cfg || !isBase(cfg[1]!)) throw new SyntaxError(`not a partname: ${JSON.stringify(text)}`);
  const params = cfg[2] === undefined || cfg[2].trim() === '' ? [] : cfg[2].split(',').map((p) => p.trim());
  return { kind: 'config', base: cfg[1]!, params, ver: cfg[3] === undefined ? null : Number(cfg[3]) };
}

/** Format a configuration: `base(p1,p2)` with an optional `.ver`. A family without parameters is `base`. */
export function formatPartname(base: string, params: readonly string[], ver: number | null = null): string {
  const p = params.length ? `(${params.join(',')})` : '';
  return `${base}${p}${ver === null ? '' : `.${ver}`}`;
}
