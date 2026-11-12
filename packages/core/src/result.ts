/**
 * Results and errors, shared by every module's model. An operation returns `Result<T>` and does
 * not throw for a failure a screen must handle. A thrown error is a defect. (Same convention as
 * ser/chat/packages/core/src/model/result.ts.)
 */

export type CoreErrorKind =
  /** The record named does not exist. */
  | 'not-found'
  /** The input is malformed, caught before writing (a bad partname, a missing field). */
  | 'invalid'
  /** A rule of the module refused the write. `rule` names it: a schema constraint or assertion, or a rule checked in code. */
  | 'refused'
  /** A key that must be unique is taken. */
  | 'duplicate'
  /** The data could not be read or written just now (a peer, the cohort, a timeout). */
  | 'unavailable';

export interface CoreError {
  kind: CoreErrorKind;
  /** For `refused`: the rule's name, e.g. `VersionFrozen` (catalog.qsql) or `ChildParamCount` (code). */
  rule?: string;
  /** English, for logs and as a fallback for display. */
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: CoreError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(kind: CoreErrorKind, message: string, rule?: string): Result<T> =>
  ({ ok: false, error: rule ? { kind, rule, message } : { kind, message } });

/** A failure raised inside an operation, turned into a `Result` at its boundary. */
export class CoreFailure extends Error {
  constructor(readonly kind: CoreErrorKind, message: string, readonly rule?: string) {
    super(message);
    this.name = 'CoreFailure';
  }
}

/**
 * Classify an error from Quereus. Constraint failures name their rule:
 *   CHECK constraint failed: VersionFrozen         (foreign keys report this way too)
 *   Integrity assertion failed: app.DraftFollowsCurrent [...]
 *   UNIQUE constraint failed: Unit PK.
 *   NOT NULL constraint failed: Operation.Description
 * Anything else is `unavailable`.
 */
export function toCoreError(err: unknown): CoreError {
  if (err instanceof CoreFailure) return err.rule ? { kind: err.kind, rule: err.rule, message: err.message } : { kind: err.kind, message: err.message };
  const message = err instanceof Error ? err.message : String(err);
  let m = /CHECK constraint failed: (\w+)/.exec(message);
  if (m) return { kind: 'refused', rule: m[1]!, message };
  m = /Integrity assertion failed: (?:\w+\.)?(\w+)/.exec(message);
  if (m) return { kind: 'refused', rule: m[1]!, message };
  if (/UNIQUE constraint failed/.test(message)) return { kind: 'duplicate', message };
  if (/NOT NULL constraint failed/.test(message)) return { kind: 'invalid', message };
  return { kind: 'unavailable', message };
}

/** Run an operation, turning any failure into a `Result`. */
export async function attempt<T>(op: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await op());
  } catch (err) {
    return { ok: false, error: toCoreError(err) };
  }
}
