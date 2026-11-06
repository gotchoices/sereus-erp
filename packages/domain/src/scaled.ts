// Exact quantities and money (docs/specs/architecture.md §7). A value is stored as an integer
// count of 1 / 10^scale of its unit. Display divides by the scale.

export type Scaled = number;

export function assertScaled(value: number): asserts value is Scaled {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`not a safe integer: ${value}`);
  }
}

/** Parse decimal text ("12.5") into a scaled integer. Rejects more digits than the scale allows. */
export function parseScaled(text: string, scale: number): Scaled {
  const m = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text.trim());
  if (!m) throw new SyntaxError(`not a decimal number: ${JSON.stringify(text)}`);
  const [, sign, whole, frac = ''] = m;
  if (frac.length > scale) {
    throw new RangeError(`${text} has more than ${scale} decimal places`);
  }
  const value = Number(whole + frac.padEnd(scale, '0')) * (sign ? -1 : 1);
  assertScaled(value);
  return value === 0 ? 0 : value;
}

/** Format a scaled integer as decimal text with exactly `scale` decimal places. */
export function formatScaled(value: Scaled, scale: number): string {
  assertScaled(value);
  const digits = Math.abs(value).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale);
  return (value < 0 ? '-' : '') + whole + (scale > 0 ? '.' + frac : '');
}
