/**
 * Stack regression: `on delete cascade` runs on a strand as it does in memory.
 *
 * Optimystic's Quereus plugin before 1.26.0 returned `{ status: 'ok' }` without the deleted
 * row from a DELETE, which Quereus reads as "nothing deleted": cascades, change recording and
 * row-time maintenance were skipped (fixed upstream in optimystic a38841e8, released 1.26.0).
 * Found by WyattERP in November 2026 (docs/sereus-requirements.md §5).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateStrandMemberKey, type SAppConfig } from '@serfab/cadre-core';
import type { Database } from '@quereus/quereus';
import { openMemoryDb, rows } from '../sql.js';
import { startTestNode, type TestNode } from '../testing/node-host.js';

const SCHEMA = `
table P (Id text primary key);
table C (Id text primary key, PId text, constraint CP foreign key (PId) references P(Id) on delete cascade);
`;
const sApp = { id: 'org.wyatterp.test.cascade', version: '0.1.0', schema: SCHEMA, signature: '', latencyHint: 'interactive' } as SAppConfig;

async function cascades(db: Database): Promise<void> {
  await db.exec(`insert into App.P (Id) values ('p1'), ('p2')`);
  await db.exec(`insert into App.C (Id, PId) values ('c1', 'p1'), ('c2', 'p2')`);
  await db.exec(`delete from App.P where Id = 'p1'`);
  expect(await rows(db, 'select Id from App.C order by Id')).toEqual([{ Id: 'c2' }]);
  await db.exec('begin');
  await db.exec(`delete from App.P where Id = 'p2'`);
  await db.exec('commit');
  expect(await rows(db, 'select Id from App.C')).toEqual([]);
  await expect(db.exec(`insert into App.C (Id, PId) values ('c3', 'none')`)).rejects.toThrow(/CP/);
}

describe('on delete cascade', () => {
  let us: TestNode;
  beforeAll(async () => { us = await startTestNode('cascade'); });
  afterAll(async () => { await us?.stop(); });

  it('runs in memory', async () => { await cascades(await openMemoryDb(SCHEMA)); });

  it('runs on a strand', async () => {
    const { instance } = await us.node.foundStrand({
      strandId: crypto.randomUUID(), type: 'c', memberPrivateKey: await generateStrandMemberKey(), sAppConfig: sApp,
    });
    await cascades(instance.database!.getDatabase());
  });
});
