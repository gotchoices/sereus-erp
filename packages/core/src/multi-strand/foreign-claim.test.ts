/**
 * Probe of current Sereus behavior (cadre-core 1.21): does a machine that joins a strand
 * have to claim it with the sApp recorded in the strand's `Strand.Header`? This matters for
 * WyattERP and Bonum sharing a cadre (docs/STATUS.md, "Apps sharing strands"). The test
 * records what happens today. If Sereus starts refusing the mismatch, this test fails and
 * should be inverted.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { generateStrandMemberKey, type StrandRow } from '@serfab/cadre-core';
import type { Database, SqlValue } from '@quereus/quereus';
import { startTestNode, type TestNode } from '../testing/node-host.js';
import { BOOKS, OPS } from './sapps.js';

let books: TestNode;
let other: TestNode;
beforeAll(async () => {
  books = await startTestNode('books');
  other = await startTestNode('other');
});
afterAll(async () => { await Promise.allSettled([books?.stop(), other?.stop()]); });

async function all(db: Database, sql: string): Promise<Record<string, SqlValue>[]> {
  const out: Record<string, SqlValue>[] = [];
  for await (const r of db.eval(sql)) out.push({ ...r } as Record<string, SqlValue>);
  return out;
}

it('lets a joiner claim a Bonum strand with a different sApp\'s schema (no Header check)', async () => {
  const { instance } = await books.node.foundStrand({
    strandId: crypto.randomUUID(), type: 'c', memberPrivateKey: await generateStrandMemberKey(), sAppConfig: BOOKS,
  });
  const strandId = instance.strandId;
  const ours = instance.database!.getDatabase();
  await ours.exec(`insert into App.Txn (Id, PostingId, Memo, Amount) values ('t1', 'p1', 'opening', 100)`);

  const invitation = await books.node.createOpenInvitation(BOOKS.id, 10 * 60_000);
  await books.node.publishFormationInvite(invitation.token, BOOKS.id, {
    expiresAtMs: invitation.expiration.getTime(), strandId, totalUses: 1,
  });
  const formed = await other.node.formStrand(other.node.decodeInvitation(books.node.encodeInvitation(invitation)), {});
  const row = { Id: strandId, MemberPrivateKey: formed.memberPrivateKey ?? null, Type: 'c', FounderOwnerKey: null, FounderPeerId: null } as unknown as StrandRow;

  let claimed: Database | undefined;
  let refusal: unknown;
  try {
    let inst;
    try {
      inst = await other.node.addStrand({ strandRow: row, sAppConfig: OPS, founder: false });
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'StrandAwaitingFirstSyncError') throw err;
      inst = await other.node.whenStrandWritable(strandId, { timeoutMs: 120_000 });
    }
    claimed = inst.database!.getDatabase();
  } catch (err) {
    refusal = err;
  }

  // Current behavior: the claim is accepted, and the joiner's database for Bonum's strand
  // has the ops tables.
  expect(refusal).toBeUndefined();
  expect(other.node.getSAppId(strandId)).toBe(OPS.id);
  await expect(all(claimed!, 'select count(*) as n from App.PoLine')).resolves.toBeDefined();

  // After time to replicate: the founder is unaffected (it does not see the ops tables), and
  // the joiner cannot see Bonum's table. The mismatch is silent on both sides.
  await new Promise((r) => setTimeout(r, 8_000));
  expect(await all(ours, 'select Id from App.Txn')).toEqual([{ Id: 't1' }]);
  await expect(all(ours, 'select count(*) as n from App.PoLine')).rejects.toThrow(/not found/i);
  await expect(all(claimed!, 'select Id from App.Txn')).rejects.toThrow(/not found/i);
});
