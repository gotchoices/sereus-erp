/**
 * Multi-strand experiment (docs/STATUS.md, "Multi-strand spike"). Real cadre-core nodes in
 * this process, with a stand-in sApp per module. What it checks:
 *
 *   1. One machine runs strands of several different sApps at once (catalog, ops, books).
 *   2. Each strand is its own Database: a strand cannot name another strand's tables.
 *   3. A cross-strand read joined in app code.
 *   4. A cross-strand read as one SQL query, through a table-valued function bridge.
 *   5. An idempotent posting from the ops outbox into books, surviving a crash between
 *      applying a posting and marking it sent.
 *   6. A second party (a vendor) joins a vendor-link strand by invitation, reads an extract
 *      published from ops, and writes a bid back, without access to ops or catalog.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateStrandMemberKey, type CadreNode, type SAppConfig, type StrandRow } from '@serfab/cadre-core';
import type { Database, SqlValue } from '@quereus/quereus';
import { startTestNode, until, type TestNode } from '../testing/node-host.js';
import { BOOKS, CATALOG, OPS, VENDOR } from './sapps.js';
import { exposeRelation } from './bridge.js';

type Rec = Record<string, SqlValue>;

async function found(node: CadreNode, sAppConfig: SAppConfig): Promise<{ id: string; db: Database }> {
  const { instance } = await node.foundStrand({
    strandId: crypto.randomUUID(),
    type: 'c',
    memberPrivateKey: await generateStrandMemberKey(),
    sAppConfig,
  });
  return { id: instance.strandId, db: instance.database!.getDatabase() };
}

async function all(db: Database, sql: string, params: SqlValue[] = []): Promise<Rec[]> {
  const out: Rec[] = [];
  for await (const r of db.eval(sql, params as never)) out.push({ ...r } as Rec);
  return out;
}

/** The poster (architecture.md §6). `crashAfterApply` stops before marking the posting sent. */
async function runPoster(ops: Database, books: Database, crashAfterApply = false): Promise<number> {
  let applied = 0;
  for (const p of await all(ops, `select Id, Kind, SourceId, Amount from App.Posting where Status = 'pending' order by Id`)) {
    const existing = await all(books, 'select Id from App.Txn where PostingId = ?', [p.Id]);
    let txnId = existing[0]?.Id as string | undefined;
    if (!txnId) {
      txnId = crypto.randomUUID();
      await books.exec('insert into App.Txn (Id, PostingId, Memo, Amount) values (?, ?, ?, ?)',
        [txnId, p.Id, `${p.Kind} ${p.SourceId}`, p.Amount] as never);
      applied++;
    }
    if (crashAfterApply) return applied;
    await ops.exec(`update App.Posting set Status = 'sent', TargetId = ? where Id = ?`, [txnId, p.Id] as never);
  }
  return applied;
}

describe('one party, several apps\' strands on one machine', () => {
  let us: TestNode;
  let catalog: { id: string; db: Database };
  let ops: { id: string; db: Database };
  let books: { id: string; db: Database };

  beforeAll(async () => {
    us = await startTestNode('us');
    catalog = await found(us.node, CATALOG);
    ops = await found(us.node, OPS);
    books = await found(us.node, BOOKS);

    await catalog.db.exec(`insert into App.Part (Id, Pnum, Name, StdCost) values
      ('p1', '1001', 'Channel 1200mm', 1450), ('p2', '1002', 'End cap', 85)`);
    await ops.db.exec(`insert into App.PoLine (Id, PoNumber, VendorId, PartId, Qty) values
      ('l1', 'PO 26-0001', 'vX', 'p1', 40), ('l2', 'PO 26-0001', 'vX', 'p2', 80), ('l3', 'PO 26-0002', 'vY', 'p2', 10)`);
  });
  afterAll(async () => { await us?.stop(); });

  it('runs three strands of three different sApps, each its own Database', async () => {
    const strands = us.node.getStrands();
    expect([catalog.id, ops.id, books.id].every((id) => strands.has(id))).toBe(true);
    expect(new Set([catalog.db, ops.db, books.db]).size).toBe(3);
    // Every strand's tables are in schema App; ops cannot see catalog's Part.
    await expect(all(ops.db, 'select * from App.Part')).rejects.toThrow(/part/i);
  });

  it('joins across strands in app code', async () => {
    const parts = new Map((await all(catalog.db, 'select Id, Pnum, StdCost from App.Part')).map((p) => [p.Id, p]));
    const lines = await all(ops.db, `select Id, PartId, Qty from App.PoLine where VendorId = 'vX' order by Id`);
    const priced = lines.map((l) => ({ id: l.Id, pnum: parts.get(l.PartId)!.Pnum, ext: (l.Qty as number) * (parts.get(l.PartId)!.StdCost as number) }));
    expect(priced).toEqual([{ id: 'l1', pnum: '1001', ext: 58_000 }, { id: 'l2', pnum: '1002', ext: 6_800 }]);
  });

  it('joins across strands in one SQL query through a table-valued function', async () => {
    exposeRelation(ops.db, 'catalog_part', catalog.db, 'select Id, Pnum, StdCost from App.Part',
      { Id: 'text', Pnum: 'text', StdCost: 'integer' });
    const rows = await all(ops.db, `
      select l.Id, p.Pnum, l.Qty * p.StdCost as Ext
      from App.PoLine l join catalog_part() p on p.Id = l.PartId
      where l.VendorId = 'vX' order by l.Id`);
    expect(rows).toEqual([{ Id: 'l1', Pnum: '1001', Ext: 58_000 }, { Id: 'l2', Pnum: '1002', Ext: 6_800 }]);
  });

  it('posts a receipt to books idempotently, across a poster crash', async () => {
    // The event and its outbox row in one transaction of the ops strand.
    await ops.db.exec('begin');
    await ops.db.exec(`update App.PoLine set Received = 40 where Id = 'l1'`);
    await ops.db.exec(`insert into App.Posting (Id, Kind, SourceId, Amount) values ('post-1', 'receipt', 'l1', 58000)`);
    await ops.db.exec('commit');

    expect(await runPoster(ops.db, books.db, true)).toBe(1); // applied, then "crashed"
    expect(await all(ops.db, `select Status from App.Posting where Id = 'post-1'`)).toEqual([{ Status: 'pending' }]);
    expect(await runPoster(ops.db, books.db)).toBe(0); // the retry applies nothing new
    expect(await runPoster(ops.db, books.db)).toBe(0);

    expect(await all(books.db, 'select PostingId, Amount from App.Txn')).toEqual([{ PostingId: 'post-1', Amount: 58000 }]);
    const [posting] = await all(ops.db, `select Status, TargetId from App.Posting where Id = 'post-1'`);
    expect(posting!.Status).toBe('sent');
    expect(posting!.TargetId).toBeTruthy();
    // The unique PostingId is the backstop if two posters race.
    await expect(books.db.exec(`insert into App.Txn (Id, PostingId, Memo, Amount) values ('dup', 'post-1', 'x', 1)`)).rejects.toThrow();
  });

  describe('a vendor joins a vendor-link strand', () => {
    let vendor: TestNode;
    let link: { id: string; db: Database };
    let linkAtVendor: Database;

    beforeAll(async () => {
      vendor = await startTestNode('vendor');
      link = await found(us.node, VENDOR);

      // Invitation, as ser/chat/packages/core/src/sereus/model.ts mints and redeems one.
      const invitation = await us.node.createOpenInvitation(VENDOR.id, 10 * 60_000);
      await us.node.publishFormationInvite(invitation.token, VENDOR.id, {
        expiresAtMs: invitation.expiration.getTime(), strandId: link.id, totalUses: 1,
      });
      const token = us.node.encodeInvitation(invitation);
      const formed = await vendor.node.formStrand(vendor.node.decodeInvitation(token), {});
      expect(formed.strandId).toBe(link.id);
      expect(formed.memberPrivateKey).toBeTruthy(); // a closed strand: the vendor got its read key
      const row = {
        Id: formed.strandId, MemberPrivateKey: formed.memberPrivateKey ?? null,
        Type: formed.memberPrivateKey ? 'c' : 'o', FounderOwnerKey: null, FounderPeerId: null,
      } as unknown as StrandRow;
      try {
        const instance = await vendor.node.addStrand({ strandRow: row, sAppConfig: VENDOR, founder: false });
        linkAtVendor = instance.database!.getDatabase();
      } catch (err) {
        if (!(err instanceof Error) || err.name !== 'StrandAwaitingFirstSyncError') throw err;
        linkAtVendor = (await vendor.node.whenStrandWritable(link.id, { timeoutMs: 240_000 })).database!.getDatabase();
      }
    });
    afterAll(async () => { await vendor?.stop(); });

    it('reads an extract published from ops, and only holds the link strand', async () => {
      exposeRelation(link.db, 'ops_po_line', ops.db,
        `select Id, PoNumber, VendorId, PartId, Qty, Received from App.PoLine`,
        { Id: 'text', PoNumber: 'text', VendorId: 'text', PartId: 'text', Qty: 'integer', Received: 'integer' });
      exposeRelation(link.db, 'catalog_part', catalog.db, 'select Id, Pnum from App.Part', { Id: 'text', Pnum: 'text' });
      // Publishing the extract is one statement in the link strand over two other strands.
      await link.db.exec(`
        insert into App.OpenPoLine (Id, PoNumber, Pnum, Qty)
        select l.Id, l.PoNumber, p.Pnum, l.Qty - l.Received
        from ops_po_line() l join catalog_part() p on p.Id = l.PartId
        where l.VendorId = 'vX' and l.Qty > l.Received`);

      await until(async () => (await all(linkAtVendor, 'select Id from App.OpenPoLine')).length === 1, 'the extract at the vendor', 120_000);
      expect(await all(linkAtVendor, 'select PoNumber, Pnum, Qty from App.OpenPoLine')).toEqual([{ PoNumber: 'PO 26-0001', Pnum: '1002', Qty: 80 }]);

      const theirs = vendor.node.getStrands();
      expect(theirs.has(link.id)).toBe(true);
      expect(theirs.has(ops.id) || theirs.has(catalog.id) || theirs.has(books.id)).toBe(false);
    });

    it('carries a bid from the vendor back to us', async () => {
      await linkAtVendor.exec(`insert into App.Bid (Id, Pnum, Qty, Price) values ('b1', '1002', 100, 79)`);
      await until(async () => (await all(link.db, 'select Id from App.Bid')).length === 1, 'the bid at our end', 120_000);
      expect(await all(link.db, 'select Pnum, Qty, Price from App.Bid')).toEqual([{ Pnum: '1002', Qty: 100, Price: 79 }]);
    });
  });
});
