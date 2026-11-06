/**
 * An experimental cross-strand read in SQL: expose a query on one strand's Database as a
 * table-valued function in another's. Sereus gives each strand its own Database (with its
 * tables in schema `App`), and Quereus has no ATTACH, so this is one way to write a join
 * across strands as a single query. Rows are read in full on each call; no predicate is
 * pushed down.
 */
import {
  createTableValuedFunction, FunctionFlags, INTEGER_TYPE, TEXT_TYPE, scalarReturn,
  type Database, type Row, type SqlValue,
} from '@quereus/quereus';

export type ColumnType = 'text' | 'integer';

export function exposeRelation(
  into: Database,
  name: string,
  from: Database,
  sql: string,
  columns: Record<string, ColumnType>,
): void {
  const names = Object.keys(columns);
  async function* rows(): AsyncIterable<Row> {
    // A different Database, so this does not wait on the calling statement's exec mutex.
    for await (const r of from.eval(sql)) {
      yield names.map((n) => r[n] as SqlValue);
    }
  }
  into.registerFunction(createTableValuedFunction({
    name,
    numArgs: 0,
    flags: FunctionFlags.UTF8,
    returnType: {
      typeClass: 'relation',
      isReadOnly: true,
      isSet: false,
      columns: names.map((n) => ({
        name: n,
        type: scalarReturn(columns[n] === 'integer' ? INTEGER_TYPE : TEXT_TYPE, false),
      })),
      keys: [],
      rowConstraints: [],
    },
  } as never, rows));
}
