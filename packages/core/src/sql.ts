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

export async function rows(db: Database, sql: string, params: SqlValue[] | Record<string, SqlValue> = []): Promise<Row[]> {
  const out: Row[] = [];
  for await (const r of db.eval(sql, params as never)) out.push({ ...r } as Row);
  return out;
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
