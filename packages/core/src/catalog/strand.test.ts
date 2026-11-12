/**
 * The catalog schema on a real strand (Optimystic storage, applied by Sereus), checking that
 * Sereus accepts it and that the rules that lean on less common Quereus features hold there
 * too: committed.* snapshots, assertions, partial unique indexes, json keys, mutation context.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { generateStrandMemberKey } from '@serfab/cadre-core';
import type { Database } from '@quereus/quereus';
import { catalogSAppConfig, CATALOG_SAPP_ID } from './sapp.js';
import { startTestNode, type TestNode } from '../testing/node-host.js';
import { rows, txn } from '../testing/memory-db.js';

const T0 = '2026-11-07T10:00:00Z';
const C = `with context Actor = 'kb', Now = '${T0}'`;

let us: TestNode;
let db: Database;

beforeAll(async () => {
  us = await startTestNode('catalog');
  const { instance } = await us.node.foundStrand({
    strandId: crypto.randomUUID(), type: 'c', memberPrivateKey: await generateStrandMemberKey(), sAppConfig: catalogSAppConfig(),
  });
  expect(us.node.getSAppId(instance.strandId)).toBe(CATALOG_SAPP_ID);
  db = instance.database!.getDatabase();
});
afterAll(async () => { await us?.stop(); });

it('defines, releases and freezes a family, and numbers a part, on a strand', async () => {
  await txn(db, [
    `insert into App.Unit (Code, Name, Dimension) ${C} values ('ea', 'each', 'count')`,
    `insert into App.Class (Prefix, Name, Kind) ${C} values ('b', 'Hardware', 'part')`,
  ]);
  await expect(db.exec(`insert into App.Unit (Code, Name, Dimension) values ('kg', 'kilogram', 'mass')`)).rejects.toThrow();

  await txn(db, [
    `insert into App.Family (Id, Base, UnitCode, Description) ${C} values ('F1', 'b:nut', 'ea', 'Nut')`,
    `insert into App.Version (FamilyId, Ver) ${C} values ('F1', 1)`,
    `insert into App.Parameter (FamilyId, Ver, Pos, Var, Type, Description) ${C} values ('F1', 1, 1, 'S', 'str', 'Size')`,
  ]);
  await expect(txn(db, [`insert into App.Version (FamilyId, Ver) ${C} values ('F1', 2)`])).rejects.toThrow();

  // Releasing without moving the family's pointer breaks an assertion.
  const releaseV1 = `update App.Version ${C} set State = 'released', ReleasedAt = '${T0}', ReleasedBy = 'ap',
    Interchangeable = true, ChangeSummary = 'first' where FamilyId = 'F1' and Ver = 1`;
  await expect(txn(db, [releaseV1])).rejects.toThrow(/FamilyCurrentIsReleased/);
  await txn(db, [releaseV1, `update App.Family ${C} set CurrentVer = 1 where Id = 'F1'`]);

  await expect(db.exec(`update App.Parameter ${C} set Description = 'x' where FamilyId = 'F1'`)).rejects.toThrow(/ParameterDraft/);

  await db.exec(`insert into App.Part (Id, Pnum, FamilyId, Params) ${C} values ('P1', 1, 'F1', '["M6"]')`);
  await expect(db.exec(`insert into App.Part (Id, Pnum, FamilyId, Params) ${C} values ('P2', 2, 'F1', '[ "M6" ]')`)).rejects.toThrow(/UNIQUE/);
  expect(await rows(db, `select Pnum, Params from App.Part`)).toEqual([{ Pnum: 1, Params: ['M6'] }]);
});
