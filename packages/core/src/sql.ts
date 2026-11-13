/**
 * Small helpers over a Quereus `Database`, shared by every module's model.
 *
 * A module's model is written once, against the `Database` that holds its schema in `App`.
 * That database is either a strand's (Sereus) or a local in-memory one built from the same
 * schema (`openMemoryDb`), so both enforce exactly the same rules.
 */
import { Database, type SqlValue } from '@quereus/quereus';

export type Row = Record<string, SqlValue>;

/** Apply an sApp schema body to a new in-memory database, the way Sereus applies it to a strand. */
export async function openMemoryDb(schemaBody: string): Promise<Database> {
  const db = new Database();
  await db.exec(`declare schema App using (default_vtab_module = 'memory') {\n${schemaBody}\n}`);
  await db.exec('apply schema App');
  return db;
}

type Params = SqlValue[] | Record<string, SqlValue>;

export async function rows(db: Database, sql: string, params: Params = []): Promise<Row[]> {
  return withStatement(db, sql, params, async (stmt) => {
    const out: Row[] = [];
    for await (const r of stmt.all(params as never)) out.push({ ...r } as Row);
    return out;
  });
}

/** Run one statement that returns no rows (insert, update, delete). */
export async function run(db: Database, sql: string, params: Params = []): Promise<void> {
  await withStatement(db, sql, params, (stmt) => stmt.run(params as never));
}

// Quereus has no plan cache: every `exec`/`eval` parses, plans and emits the statement again,
// and planning is most of the cost of a small write (measured on the ATI import: half the CPU).
// So each database keeps its compiled statements, keyed by SQL text and by the type of each
// value (a statement's parameter types are fixed by the first values bound to it; 1 and 0.5
// are different types). A statement
// still running (an interleaved read of the same text) is not shared: a fresh one is used.
// Compiled statements follow schema changes on their own (Quereus recompiles them).
type Statement = Awaited<ReturnType<Database['prepare']>>;
interface Cached { stmt: Statement; busy: boolean }
const STATEMENT_CACHE_SIZE = 400;
const statements = new WeakMap<Database, Map<string, Cached>>();

function typeKey(params: Params): string {
  // Quereus types a whole JavaScript number as INTEGER and any other as REAL.
  const kind = (v: SqlValue) =>
    v === null ? 'n' : v instanceof Uint8Array ? 'b' : typeof v === 'number' ? (Number.isInteger(v) ? 'i' : 'r') : (typeof v)[0];
  return Array.isArray(params)
    ? params.map(kind).join('')
    : Object.keys(params).sort().map((k) => `${k}:${kind(params[k] as SqlValue)}`).join(',');
}

async function withStatement<T>(db: Database, sql: string, params: Params, use: (stmt: Statement) => Promise<T>): Promise<T> {
  let cache = statements.get(db);
  if (!cache) statements.set(db, (cache = new Map()));
  const key = `${typeKey(params)}\u0000${sql}`;
  let entry = cache.get(key);
  if (entry?.busy) {
    const fresh = await db.prepare(sql);
    try { return await use(fresh); } finally { await fresh.finalize().catch(() => {}); }
  }
  if (!entry) {
    entry = { stmt: await db.prepare(sql), busy: false };
    cache.set(key, entry);
    if (cache.size > STATEMENT_CACHE_SIZE) {
      const [oldKey, old] = cache.entries().next().value as [string, Cached];
      if (!old.busy) { cache.delete(oldKey); void old.stmt.finalize().catch(() => {}); }
    }
  } else {
    // Most recently used last, so the oldest is evicted first.
    cache.delete(key);
    cache.set(key, entry);
  }
  entry.busy = true;
  try {
    return await use(entry.stmt);
  } catch (err) {
    // A failed statement is not kept: its state after an error is not worth trusting.
    cache.delete(key);
    void entry.stmt.finalize().catch(() => {});
    throw err;
  } finally {
    entry.busy = false;
  }
}

/** Run statements in one transaction; roll back and rethrow on failure. */
export async function txn(db: Database, statements: string[]): Promise<void> {
  await transaction(db, async () => { for (const s of statements) await db.exec(s); });
}

/** Run `body` in one transaction; roll back and rethrow on failure. */
export async function transaction<T>(db: Database, body: () => Promise<T>): Promise<T> {
  await db.exec('begin');
  try {
    const value = await body();
    await db.exec('commit');
    return value;
  } catch (err) {
    await db.exec('rollback').catch(() => {});
    throw err;
  }
}

const queues = new WeakMap<Database, Promise<unknown>>();

/**
 * Run `op` after every earlier `serialized` call on the same database has finished. A model
 * runs each operation this way, so one operation's transaction never interleaves with another's.
 */
export function serialized<T>(db: Database, op: () => Promise<T>): Promise<T> {
  const prev = queues.get(db) ?? Promise.resolve();
  const next = prev.then(op, op);
  queues.set(db, next.catch(() => {}));
  return next;
}
