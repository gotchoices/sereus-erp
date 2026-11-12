/**
 * The catalog schema's rules (docs/specs/catalog.qsql, product.md), applied to an in-memory
 * Quereus database. Each test states one rule and checks both that a valid write is accepted
 * and that the violating one is refused.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@quereus/quereus';
import { CATALOG_SCHEMA } from './sapp.js';
import { memoryDb, rows, txn } from '../testing/memory-db.js';

const T0 = '2026-11-07T10:00:00Z';
const ctx = (actor = 'kb', now = T0) => `with context Actor = '${actor}', Now = '${now}'`;
const C = ctx();

let db: Database;

/** Units, classes, an operation, and two part families with released version 1. */
async function seed(): Promise<void> {
  await txn(db, [
    `insert into App.Unit (Code, Name, Dimension, Scale) ${C} values ('ea', 'each', 'count', 0), ('mm', 'millimeter', 'length', 0)`,
    `insert into App.Class (Prefix, Name, Kind) ${C} values ('a', 'Assemblies', 'part'), ('b', 'Hardware', 'part'), ('@', 'Packages', 'package')`,
    `insert into App.Operation (Code, Description) ${C} values ('cut', 'Cut'), ('assy', 'Assemble')`,
  ]);
  // b:screw v1 released, with one parameter.
  await txn(db, [
    `insert into App.Family (Id, Base, UnitCode, Description) ${C} values ('F-screw', 'b:screw', 'ea', 'Screw')`,
    `insert into App.Version (FamilyId, Ver) ${C} values ('F-screw', 1)`,
    `insert into App.Parameter (FamilyId, Ver, Pos, Var, Type, UnitCode, Description) ${C} values ('F-screw', 1, 1, 'L', 'num', 'mm', 'Length')`,
  ]);
  await release('F-screw', 1);
  // a:chan v1 draft: two parameters, a routing step, two lines.
  await txn(db, [
    `insert into App.Family (Id, Base, UnitCode, Description) ${C} values ('F-chan', 'a:chan', 'ea', 'Grow channel')`,
    `insert into App.Version (FamilyId, Ver, Spec) ${C} values ('F-chan', 1, 'v1 spec')`,
    `insert into App.Parameter (FamilyId, Ver, Pos, Var, Type, UnitCode, Description, MinValue, MaxValue) ${C}
       values ('F-chan', 1, 1, 'L', 'num', 'mm', 'Length', 300, 3000)`,
    `insert into App.Parameter (FamilyId, Ver, Pos, Var, Type, Description) ${C} values ('F-chan', 1, 2, 'C', 'enum', 'Color')`,
    `insert into App.AllowedValue (FamilyId, Ver, ParamPos, Value, Description) ${C} values ('F-chan', 1, 2, 'w', 'white'), ('F-chan', 1, 2, 'k', 'black')`,
    `insert into App.Process (FamilyId, Ver, Idx, OperationCode, LaborPerUnit) ${C} values ('F-chan', 1, 1, 'assy', '2')`,
    `insert into App.BomLine (FamilyId, Ver, Pos, Component, ChildParams, Qty, ProcessIdx) ${C}
       values ('F-chan', 1, 1, 'b:screw', '["12"]', 'Math.ceil(L / 300) + 1', 1)`,
    `insert into App.BomLine (FamilyId, Ver, Pos, Component, ChildParams, Qty, WhenExpr) ${C}
       values ('F-chan', 1, 2, 'b:screw', '["20"]', '2', 'C == "k"')`,
    `insert into App.Note (Id, FamilyId, Ver, ProcessIdx, Seq, Type, Body) ${C} values ('N1', 'F-chan', 1, 1, 1, 'step', 'Fit end caps')`,
  ]);
}

/** Release a draft: the version's fields, the previous version superseded, the family's pointer. */
async function release(familyId: string, ver: number, opts: { setCurrent?: boolean } = {}): Promise<void> {
  const statements = [
    `update App.Version ${C} set State = 'released', ReleasedAt = '${T0}', ReleasedBy = 'approver',
       Interchangeable = true, ChangeSummary = 'release ${ver}', UpdatedAt = '${T0}', UpdatedBy = 'kb'
       where FamilyId = '${familyId}' and Ver = ${ver}`,
  ];
  if (ver > 1) {
    statements.unshift(`update App.Version ${C} set State = 'superseded' where FamilyId = '${familyId}' and Ver = ${ver - 1}`);
  }
  if (opts.setCurrent !== false) {
    statements.push(`update App.Family ${C} set CurrentVer = ${ver} where Id = '${familyId}'`);
  }
  await txn(db, statements);
}

/** Start the next draft of a family as a copy of nothing (enough for these tests). */
async function draft(familyId: string, ver: number): Promise<void> {
  await txn(db, [`insert into App.Version (FamilyId, Ver) ${C} values ('${familyId}', ${ver})`]);
}

beforeEach(async () => {
  db = await memoryDb(CATALOG_SCHEMA);
  await seed();
});

describe('audit (architecture.md §9)', () => {
  it('fills Created/Updated from the mutation context, and refuses a write without one', async () => {
    expect(await rows(db, `select CreatedBy, CreatedAt, UpdatedBy from App.Unit where Code = 'ea'`))
      .toEqual([{ CreatedBy: 'kb', CreatedAt: T0, UpdatedBy: 'kb' }]);
    await expect(db.exec(`insert into App.Unit (Code, Name, Dimension) values ('kg', 'kilogram', 'mass')`)).rejects.toThrow();
    await expect(db.exec(`update App.Unit set Name = 'x' where Code = 'ea'`)).rejects.toThrow(/UnitAuditUpdate/);
  });

  it('requires an update to restamp Updated with the context, and keeps Created', async () => {
    const later = ctx('ann', '2026-11-08T00:00:00Z');
    await expect(db.exec(`update App.Unit ${later} set Name = 'pieces' where Code = 'ea'`)).rejects.toThrow(/UnitAuditUpdate/);
    await db.exec(`update App.Unit ${later} set Name = 'pieces', UpdatedBy = 'ann', UpdatedAt = '2026-11-08T00:00:00Z' where Code = 'ea'`);
    await expect(db.exec(`update App.Unit ${later} set CreatedBy = 'ann', UpdatedBy = 'ann', UpdatedAt = '2026-11-08T00:00:00Z' where Code = 'ea'`))
      .rejects.toThrow(/UnitAuditUpdate/);
  });
});

describe('families', () => {
  it('checks the base format and derives the class from its prefix', async () => {
    for (const bad of ['chan', 'a-chan', 'a:', 'ab:chan', 'a:ch an', 'a:ch-an']) {
      await expect(db.exec(`insert into App.Family (Id, Base, UnitCode, Description) ${C} values ('X', '${bad}', 'ea', 'x')`),
        bad).rejects.toThrow();
    }
    await expect(db.exec(`insert into App.Family (Id, Base, UnitCode, Description) ${C} values ('X', 'z:thing', 'ea', 'x')`))
      .rejects.toThrow(/FamilyClass/);
    expect(await rows(db, `select ClassPrefix from App.Family where Id = 'F-chan'`)).toEqual([{ ClassPrefix: 'a' }]);
  });

  it('lets the base change until a version is released', async () => {
    await db.exec(`insert into App.Family (Id, Base, UnitCode, Description) ${C} values ('F-new', 'a:new', 'ea', 'x')`);
    await db.exec(`update App.Family ${C} set Base = 'a:renamed' where Id = 'F-new'`);
    await expect(db.exec(`update App.Family ${C} set Base = 'b:screw2' where Id = 'F-screw'`)).rejects.toThrow(/FamilyBaseFixed/);
  });

  it('refuses to delete a family with a released version', async () => {
    await expect(db.exec(`delete from App.Family where Id = 'F-screw'`)).rejects.toThrow(/FamilyDeleteUnreleased/);
  });
});

describe('versions (product.md §4)', () => {
  it('allows one draft per family, numbered current + 1', async () => {
    await expect(draft('F-chan', 2)).rejects.toThrow(); // a draft (1) already exists
    await expect(draft('F-screw', 3)).rejects.toThrow(/DraftFollowsCurrent/);
    await draft('F-screw', 2);
  });

  it('releases a draft only with its release fields, and with the family pointing at it', async () => {
    await expect(txn(db, [`update App.Version ${C} set State = 'released' where FamilyId = 'F-chan' and Ver = 1`]))
      .rejects.toThrow(/VersionReleaseFields/);
    await expect(release('F-chan', 1, { setCurrent: false })).rejects.toThrow(/FamilyCurrentIsReleased/);
    await release('F-chan', 1);
    expect(await rows(db, `select CurrentVer from App.Family where Id = 'F-chan'`)).toEqual([{ CurrentVer: 1 }]);
  });

  it('supersedes the previous version on the next release, and allows no way back', async () => {
    await draft('F-screw', 2);
    await release('F-screw', 2);
    expect(await rows(db, `select Ver, State from App.Version where FamilyId = 'F-screw' order by Ver`))
      .toEqual([{ Ver: 1, State: 'superseded' }, { Ver: 2, State: 'released' }]);
    await expect(db.exec(`update App.Version ${C} set State = 'released' where FamilyId = 'F-screw' and Ver = 1`))
      .rejects.toThrow(/VersionTransition/);
    await db.exec(`update App.Version ${C} set State = 'retired' where FamilyId = 'F-screw' and Ver = 1`);
  });

  it('freezes a released version and its definition', async () => {
    await release('F-chan', 1);
    await expect(db.exec(`update App.Version ${C} set Spec = 'changed' where FamilyId = 'F-chan' and Ver = 1`))
      .rejects.toThrow(/VersionFrozen/);
    await expect(db.exec(`update App.Parameter ${C} set MaxValue = 4000 where FamilyId = 'F-chan' and Ver = 1 and Pos = 1`))
      .rejects.toThrow(/ParameterDraft/);
    await expect(db.exec(`insert into App.AllowedValue (FamilyId, Ver, ParamPos, Value, Description) ${C} values ('F-chan', 1, 2, 'g', 'green')`))
      .rejects.toThrow(/AllowedValueDraft/);
    await expect(db.exec(`delete from App.BomLine where FamilyId = 'F-chan' and Ver = 1 and Pos = 2`))
      .rejects.toThrow(/BomLineDraftDelete/);
    await expect(db.exec(`delete from App.Version where FamilyId = 'F-chan' and Ver = 1`)).rejects.toThrow(/VersionDeleteDraft/);
  });

  it('lets a draft be edited and released in one transaction', async () => {
    await txn(db, [`update App.Version ${C} set Spec = 'final spec' where FamilyId = 'F-chan' and Ver = 1`]);
    await draft('F-screw', 2);
    await txn(db, [
      `insert into App.Parameter (FamilyId, Ver, Pos, Var, Type, UnitCode, Description) ${C} values ('F-screw', 2, 1, 'L', 'num', 'mm', 'Length')`,
      `update App.Version ${C} set State = 'superseded' where FamilyId = 'F-screw' and Ver = 1`,
      `update App.Version ${C} set State = 'released', ReleasedAt = '${T0}', ReleasedBy = 'approver', Interchangeable = true,
         ChangeSummary = 'v2' where FamilyId = 'F-screw' and Ver = 2`,
      `update App.Family ${C} set CurrentVer = 2 where Id = 'F-screw'`,
    ]);
  });

  it('discards a draft with everything that hangs off it', async () => {
    await txn(db, [
      `insert into App.Document (Id, FamilyId, Ver, Kind, Name, ContentRef) ${C} values ('D1', 'F-chan', 1, 'drawing', 'chan.pdf', 'files/chan.pdf')`,
      `update App.Note ${C} set DocumentId = 'D1' where Id = 'N1'`,
    ]);
    await db.exec(`delete from App.Version where FamilyId = 'F-chan' and Ver = 1`);
    for (const t of ['Parameter', 'AllowedValue', 'BomLine', 'Process', 'Note', 'Document']) {
      expect(await rows(db, `select count(*) as n from App.${t} where FamilyId = 'F-chan'`), t).toEqual([{ n: 0 }]);
    }
  });
});

describe('parameters and lines', () => {
  it('validates parameter names, types and ranges', async () => {
    const ins = (pos: number, v: string, type: string, extra = '') =>
      db.exec(`insert into App.Parameter (FamilyId, Ver, Pos, Var, Type, UnitCode, Description${extra ? ', MinValue, MaxValue' : ''}) ${C}
        values ('F-chan', 1, ${pos}, '${v}', '${type}', ${type === 'num' ? `'mm'` : 'null'}, 'x'${extra})`);
    await expect(ins(3, 'L', 'num')).rejects.toThrow(); // duplicate name
    await expect(ins(3, 'skip', 'num')).rejects.toThrow(/ParameterVarFormat/);
    await expect(ins(3, '2W', 'num')).rejects.toThrow(/ParameterVarFormat/);
    await expect(ins(3, 'W', 'num', ', 10, 5')).rejects.toThrow(/ParameterRange/);
    await expect(db.exec(`insert into App.Parameter (FamilyId, Ver, Pos, Var, Type, Description) ${C} values ('F-chan', 1, 3, 'W', 'num', 'x')`))
      .rejects.toThrow(/ParameterNumUnit/);
    await ins(3, 'W', 'num', ', 5, 10');
  });

  it('keeps lines and notes from pointing at a deleted step or document', async () => {
    await expect(db.exec(`delete from App.Process where FamilyId = 'F-chan' and Ver = 1 and Idx = 1`)).rejects.toThrow(/ProcessUnused/);
    await db.exec(`insert into App.Document (Id, FamilyId, Ver, Kind, Name, ContentRef) ${C} values ('D1', 'F-chan', 1, 'drawing', 'x', 'y')`);
    await db.exec(`update App.Note ${C} set DocumentId = 'D1' where Id = 'N1'`);
    await expect(db.exec(`delete from App.Document where Id = 'D1'`)).rejects.toThrow(/DocumentUnused/);
    await expect(db.exec(`insert into App.BomLine (FamilyId, Ver, Pos, Component, ProcessIdx) ${C} values ('F-chan', 1, 3, 'b:screw', 9)`))
      .rejects.toThrow(/BomLineProcess/);
  });

  it('allows listed values only on enum parameters', async () => {
    await expect(db.exec(`insert into App.AllowedValue (FamilyId, Ver, ParamPos, Value, Description) ${C} values ('F-chan', 1, 1, '5', 'x')`))
      .rejects.toThrow(/AllowedValueOfEnum/);
  });

  it('requires lines to name an existing family, and a pin to name a released version', async () => {
    await expect(db.exec(`insert into App.BomLine (FamilyId, Ver, Pos, Component) ${C} values ('F-chan', 1, 3, 'b:nothing')`))
      .rejects.toThrow(/BomLineComponent/);
    await expect(db.exec(`insert into App.BomLine (FamilyId, Ver, Pos, Component, ChildVer) ${C} values ('F-chan', 1, 3, 'b:screw', 2)`))
      .rejects.toThrow(/BomLineChildVer/);
    await expect(db.exec(`insert into App.BomLine (FamilyId, Ver, Pos, Component, ChildParams) ${C} values ('F-chan', 1, 3, 'b:screw', '{"L": 1}')`))
      .rejects.toThrow(/BomLineChildParams/);
    await db.exec(`insert into App.BomLine (FamilyId, Ver, Pos, Component, ChildVer) ${C} values ('F-chan', 1, 3, 'b:screw', 1)`);
    expect(await rows(db, `select ChildParams from App.BomLine where FamilyId = 'F-chan' and Pos = 1`)).toEqual([{ ChildParams: ['12'] }]);
  });
});

describe('minor revisions (product.md §5)', () => {
  beforeEach(async () => { await release('F-chan', 1); });

  const minor = (n: number) =>
    `insert into App.MinorRevision (FamilyId, Ver, Minor, Summary) ${C} values ('F-chan', 1, ${n}, 'notes ${n}')`;
  const reviseNote = (n: number, body: string) => [
    `update App.Note ${C} set ToMinor = ${n} where Id = 'N${n}'`,
    `insert into App.Note (Id, FamilyId, Ver, ProcessIdx, Seq, Type, Body, FromMinor) ${C}
       values ('N${n + 1}', 'F-chan', 1, 1, 1, 'step', '${body}', ${n})`,
  ];

  it('changes a note of a released version only with a new minor revision, keeping the old text', async () => {
    await expect(txn(db, reviseNote(1, 'Fit both end caps'))).rejects.toThrow(/Note(Update|Insert)/);
    await txn(db, [minor(1), ...reviseNote(1, 'Fit both end caps')]);
    expect(await rows(db, `select Id, Body, FromMinor, ToMinor from App.Note order by Id`)).toEqual([
      { Id: 'N1', Body: 'Fit end caps', FromMinor: 0, ToMinor: 1 },
      { Id: 'N2', Body: 'Fit both end caps', FromMinor: 1, ToMinor: null },
    ]);
    await expect(db.exec(`update App.Note ${C} set Body = 'edited in place' where Id = 'N2'`)).rejects.toThrow(/NoteUpdate/);
    await expect(db.exec(`delete from App.Note where Id = 'N1'`)).rejects.toThrow(/NoteDraftDelete/);
  });

  it('numbers minor revisions 1, 2, … one per transaction, only on released versions', async () => {
    await expect(txn(db, [minor(2)])).rejects.toThrow(/MinorNext/);
    await txn(db, [minor(1)]);
    await txn(db, [minor(2)]);
    await expect(db.exec(`delete from App.MinorRevision where Minor = 2`)).rejects.toThrow(/MinorInsertOnly/);
    await draft('F-chan', 2);
    await expect(db.exec(`insert into App.MinorRevision (FamilyId, Ver, Minor, Summary) ${C} values ('F-chan', 2, 1, 'x')`))
      .rejects.toThrow(/MinorOfReleased/);
  });

  it('changes process times with a minor revision, but never the step itself', async () => {
    const time = `update App.Process ${C} set LaborPerUnit = '3' where FamilyId = 'F-chan' and Ver = 1 and Idx = 1`;
    await expect(txn(db, [time])).rejects.toThrow(/ProcessDraftUpdate/);
    await txn(db, [minor(1), time]);
    await expect(txn(db, [minor(2), `update App.Process ${C} set OperationCode = 'cut' where FamilyId = 'F-chan' and Idx = 1`]))
      .rejects.toThrow(/ProcessDraftUpdate/);
  });
});

describe('parts and packages', () => {
  const part = (id: string, family: string, params: string) =>
    db.exec(`insert into App.Part (Id, FamilyId, Params) ${C} values ('${id}', '${family}', '${params}')`);
  const number = (pnum: number, partId: string) =>
    db.exec(`insert into App.PartNumber (Pnum, PartId) ${C} values (${pnum}, '${partId}')`);

  it('keeps one part per approved combination of a part family', async () => {
    await part('P1', 'F-screw', '[12]');
    await expect(part('P2', 'F-screw', '[ 12 ]')).rejects.toThrow(/UNIQUE/); // same value, other spelling
    await expect(db.exec(`delete from App.Part where Id = 'P1'`)).rejects.toThrow(/PartNoDelete/);
    await expect(db.exec(`update App.Part ${C} set Params = '[16]' where Id = 'P1'`)).rejects.toThrow(/PartIdentityFixed/);
    await db.exec(`update App.Part ${C} set Status = 'active', MinLevel = 50 where Id = 'P1'`);
  });

  it('numbers a part once, with a number never reused', async () => {
    await part('P1', 'F-screw', '[12]');
    await part('P2', 'F-screw', '[16]');
    await number(1001, 'P1');
    await expect(number(1002, 'P1')).rejects.toThrow(/UNIQUE/); // a part has one number
    await expect(number(1001, 'P2')).rejects.toThrow(/UNIQUE/); // a number has one part
    await expect(number(0, 'P2')).rejects.toThrow(/PartNumberPositive/);
    await expect(txn(db, [`insert into App.PartNumber (Pnum, PartId) ${C} values (1003, 'none')`])).rejects.toThrow(/PartNumberPart/);
    await expect(db.exec(`update App.PartNumber ${C} set Pnum = 1002 where PartId = 'P1'`)).rejects.toThrow(/PartNumberInsertOnly/);
    await expect(db.exec(`delete from App.PartNumber where PartId = 'P1'`)).rejects.toThrow(/PartNumberInsertOnly/);
  });

  it('never numbers a package, and keeps standard packages to package families', async () => {
    await txn(db, [`insert into App.Family (Id, Base, UnitCode, Description) ${C} values ('F-kit', '@:kit', 'ea', 'Kit')`]);
    await expect(part('P9', 'F-kit', '[]')).rejects.toThrow(/PartKind/);
    await expect(db.exec(`insert into App.StandardPackage (Id, FamilyId, Name, Params) ${C} values ('S1', 'F-chan', 'std', '[]')`))
      .rejects.toThrow(/StandardPackageKind/);
    await db.exec(`insert into App.StandardPackage (Id, FamilyId, Name, Params) ${C} values ('S1', 'F-kit', '4 x 2400', '[4, null]')`);
  });

  it('records part versions only for released versions, insert-only', async () => {
    await part('P1', 'F-screw', '[12]');
    await db.exec(`insert into App.PartVersion (PartId, Ver, ExplosionHash, Interchangeable) ${C} values ('P1', 1, 'h1', true)`);
    await expect(db.exec(`insert into App.PartVersion (PartId, Ver, ExplosionHash, Interchangeable) ${C} values ('P1', 2, 'h2', true)`))
      .rejects.toThrow(/PartVersionReleased/);
    await expect(db.exec(`update App.PartVersion ${C} set ExplosionHash = 'x'`)).rejects.toThrow(/PartVersionInsertOnly/);
  });
});
