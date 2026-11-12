/**
 * An sApp schema applied to a local in-memory Quereus database, the way Sereus applies it to a
 * strand (`declare schema App { … }`), for fast tests of the schema's rules.
 */
import { Database, type SqlValue } from '@quereus/quereus';

export async function memoryDb(schemaBody: string): Promise<Database> {
  const db = new Database();
  await db.exec(`declare schema App using (default_vtab_module = 'memory') {\n${schemaBody}\n}`);
  await db.exec('apply schema App');
  return db;
}

export async function rows(db: Database, sql: string, params: SqlValue[] = []): Promise<Record<string, SqlValue>[]> {
  const out: Record<string, SqlValue>[] = [];
  for await (const r of db.eval(sql, params as never)) out.push({ ...r } as Record<string, SqlValue>);
  return out;
}

/** Run statements in one transaction; roll back and rethrow on failure. */
export async function txn(db: Database, statements: string[]): Promise<void> {
  await db.exec('begin');
  try {
    for (const s of statements) await db.exec(s);
    await db.exec('commit');
  } catch (err) {
    await db.exec('rollback').catch(() => {});
    throw err;
  }
}
