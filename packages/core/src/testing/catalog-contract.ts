/**
 * The `CatalogModel` contract: one suite, run against the in-memory catalog and a catalog on
 * a real strand. Tests run in order and build on the sample catalog (catalog/sample.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CatalogModel, DraftDefinition, Version } from '../catalog/model.js';
import { EMPTY_DRAFT, loadSampleCatalog } from '../catalog/sample.js';
import type { CoreErrorKind, Result } from '../result.js';

export interface CatalogTarget {
  model: CatalogModel;
  /** The writer the model records. */
  actor: string;
  teardown?: () => Promise<void>;
}

function value<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.kind} ${r.error.rule ?? ''}: ${r.error.message}`);
  return r.value;
}

function failure<T>(r: Result<T>, kind: CoreErrorKind, rule?: string): void {
  expect(r.ok, r.ok ? 'expected a failure' : '').toBe(false);
  if (r.ok) return;
  expect(r.error.kind).toBe(kind);
  if (rule) expect(r.error.rule).toBe(rule);
}

const definition = (v: Version): DraftDefinition => ({
  spec: v.spec, familyScript: v.familyScript, priceFormula: v.priceFormula, explodeDefault: v.explodeDefault,
  compatNotes: v.compatNotes, parameters: v.parameters, lines: v.lines, processes: v.processes, notes: v.notes, documents: v.documents,
});

export function describeCatalogContract(name: string, setup: () => Promise<CatalogTarget>): void {
  describe(`CatalogModel contract: ${name}`, () => {
    let t: CatalogTarget;
    let m: CatalogModel;

    beforeAll(async () => {
      t = await setup();
      m = t.model;
      await loadSampleCatalog(m);
    });
    afterAll(async () => { await t?.teardown?.(); });

    it('keeps reference data, updating by key', async () => {
      expect(value(await m.units.list()).map((u) => u.code)).toEqual(['ea', 'm', 'mm']);
      value(await m.operations.put({ code: 'assy', description: 'Assemble and test' }));
      expect(value(await m.operations.list()).find((o) => o.code === 'assy')!.description).toBe('Assemble and test');
      failure(await m.units.put({ code: 'bad code', name: 'x', dimension: 'count', scale: 0, factorNum: null, factorDen: null }), 'refused', 'UnitCodeFormat');
    });

    it('lists and finds families', async () => {
      expect(value(await m.families.list()).map((f) => f.base)).toEqual(['@:tower', 'a:chan', 'b:cap', 'b:netcup', 'b:pipe']);
      expect(value(await m.families.list({ classPrefix: 'b' })).length).toBe(3);
      expect(value(await m.families.list({ text: 'GROW' })).map((f) => f.base)).toEqual(['a:chan']);
      const chan = value(await m.families.get('a:chan'));
      expect(chan).toMatchObject({ classPrefix: 'a', currentVer: 1, draftVer: null, status: 'active' });
      failure(await m.families.get('a:none'), 'not-found');
      failure(await m.families.create({ base: 'chan', unitCode: 'ea', description: 'x' }), 'invalid');
      failure(await m.families.create({ base: 'a:chan', unitCode: 'ea', description: 'x' }), 'duplicate');
    });

    it('reads a released version and records who released it', async () => {
      const v = value(await m.versions.get('a:chan'));
      expect(v).toMatchObject({ ver: 1, state: 'released', interchangeable: true, releasedBy: t.actor, latestMinor: 0 });
      expect(v.parameters.map((p) => p.var)).toEqual(['L', 'N', 'D']);
      expect(v.parameters[2]!.allowed.map((a) => a.value)).toEqual(['100', '75']);
      expect(v.lines.map((l) => l.component)).toEqual(['b:pipe', 'b:cap', 'b:netcup']);
      expect(v.notes[1]!.measure).toEqual({ name: 'hole', units: 'mm', nominal: 51, min: 50.5, max: 52 });
    });

    it('creates a family with a draft, edits the draft as a whole, and discards it', async () => {
      const fam = value(await m.families.create({ base: 'a:rail', unitCode: 'ea', description: 'Support rail' }));
      expect(fam).toMatchObject({ currentVer: null, draftVer: 1 });
      const def: DraftDefinition = {
        ...EMPTY_DRAFT,
        processes: [{ idx: 1, operationCode: 'cut', nextIdx: null, setupTime: null, laborPerUnit: '1', machinePerUnit: null, description: null }],
        lines: [{ pos: 1, component: 'b:pipe', childParams: ['75'], qty: '1', when: null, script: null, processIdx: 1, childVer: null, comment: null }],
        documents: [{ id: 'DOC-1', kind: 'drawing', name: 'rail.pdf', contentRef: 'files/rail.pdf' }],
        notes: [{ processIdx: 1, seq: 1, type: 'fig', body: 'See drawing', documentId: 'DOC-1', measure: null }],
      };
      value(await m.versions.saveDraft(fam.id, def));
      // Saving again replaces steps, lines and documents that keep their keys.
      const again = value(await m.versions.saveDraft(fam.id, { ...def, spec: 'v1' }));
      expect(again.spec).toBe('v1');
      expect(again.notes.map((n) => n.documentId)).toEqual(['DOC-1']);
      failure(await m.versions.saveDraft(fam.id, { ...def, notes: [{ ...def.notes[0]!, documentId: 'NOPE' }] }), 'refused', 'NoteDocument');
      // Removing a step a line still uses is refused.
      failure(await m.versions.saveDraft(fam.id, { ...def, processes: [], notes: [] }), 'refused');

      value(await m.versions.discardDraft(fam.id));
      expect(value(await m.families.get(fam.id)).draftVer).toBeNull();
      value(await m.families.remove(fam.id));
      failure(await m.families.get('a:rail'), 'not-found');
    });

    it('checks lines against their children at release', async () => {
      const fam = value(await m.families.create({ base: 'a:frame', unitCode: 'ea', description: 'Frame' }, {
        lines: [{ pos: 1, component: 'b:pipe', childParams: ['75', '2'], qty: '1', when: null, script: null, processIdx: null, childVer: null, comment: null }],
      }));
      failure(await m.versions.release(fam.id, { changeSummary: 'first' }), 'refused', 'ChildParamCount');
      const draft = value(await m.versions.get(fam.id));
      value(await m.versions.saveDraft(fam.id, { ...definition(draft), lines: [{ ...draft.lines[0]!, childParams: ['75'] }] }));
      failure(await m.versions.release(fam.id, { changeSummary: ' ' }), 'invalid');
      value(await m.versions.release(fam.id, { changeSummary: 'first' }));
      failure(await m.families.remove(fam.id), 'refused', 'FamilyDeleteUnreleased');
      failure(await m.families.update(fam.id, { base: 'a:frame2' }), 'refused', 'FamilyBaseFixed');
      expect(value(await m.families.update(fam.id, { description: 'Grow frame' })).description).toBe('Grow frame');
    });

    it('starts the next draft as a copy, releases it and supersedes the previous one', async () => {
      const ver = value(await m.versions.startDraft('a:chan'));
      expect(ver).toBe(2);
      failure(await m.versions.startDraft('a:chan'), 'refused', 'VersionOneDraft');
      const draft = value(await m.versions.get('a:chan', 2));
      const v1 = value(await m.versions.get('a:chan', 1));
      expect(draft.state).toBe('draft');
      expect(draft.lines).toEqual(v1.lines);
      expect(draft.notes.map((n) => n.body)).toEqual(v1.notes.map((n) => n.body));
      expect(draft.notes[0]!.id).not.toBe(v1.notes[0]!.id);

      value(await m.versions.saveDraft('a:chan', { ...definition(draft), spec: 'Now with a drain fitting.' }));
      failure(await m.versions.release('a:chan', { changeSummary: 'drain' }), 'invalid');
      const released = value(await m.versions.release('a:chan', { changeSummary: 'drain', interchangeable: true }));
      expect(released.state).toBe('released');
      expect(value(await m.versions.list('a:chan')).map((v) => v.state)).toEqual(['superseded', 'released']);
      expect(value(await m.families.get('a:chan'))).toMatchObject({ currentVer: 2, draftVer: null });
      failure(await m.versions.saveDraft('a:chan', definition(draft)), 'refused', 'NoDraft');
    });

    it('records minor revisions of a released version and keeps the earlier text', async () => {
      const v = value(await m.versions.get('a:chan'));
      const step = v.notes.find((n) => n.type === 'step')!;
      const minor = value(await m.versions.revise('a:chan', 2, {
        summary: 'clearer spacing, deburr check',
        notes: {
          replace: [{ ...step, body: 'Space sites evenly; the first is 150 mm from the inlet end.' }],
          add: [{ processIdx: 2, seq: 3, type: 'qc', body: 'No burrs inside the pipe', documentId: null, measure: { name: 'burrs', passfail: true } }],
        },
        processTimes: [{ idx: 2, laborPerUnit: '0.4 * N' }],
      }));
      expect(minor).toBe(1);
      const now = value(await m.versions.get('a:chan', 2));
      expect(now.latestMinor).toBe(1);
      expect(now.minorRevisions).toEqual([expect.objectContaining({ minor: 1, by: t.actor })]);
      expect(now.notes.map((n) => n.seq)).toEqual([1, 2, 3]);
      expect(now.notes[0]!.body).toMatch(/the first is/);
      expect(now.processes[1]!.laborPerUnit).toBe('0.4 * N');
      const then = value(await m.versions.get('a:chan', 2, { asOfMinor: 0 }));
      expect(then.notes.map((n) => n.body)).toEqual(v.notes.map((n) => n.body));

      failure(await m.versions.revise('a:chan', 2, { summary: 'nothing' }), 'invalid');
      failure(await m.versions.revise('a:chan', 2, { summary: 'x', notes: { remove: [step.id] } }), 'not-found');
      expect(value(await m.versions.revise('a:chan', 2, { summary: 'drop qc', notes: { remove: [now.notes[2]!.id] } }))).toBe(2);
    });

    it('retires an old version but not the current one', async () => {
      failure(await m.versions.retire('a:chan', 2), 'refused', 'RetireCurrent');
      value(await m.versions.retire('a:chan', 1));
      expect(value(await m.versions.list('a:chan')).map((v) => v.state)).toEqual(['retired', 'released']);
    });

    it('numbers approved combinations once, in canonical form', async () => {
      const parts = value(await m.parts.list());
      expect(parts.map((p) => p.pnum)).toEqual([1, 2, 3, 4]);
      expect(parts.map((p) => p.partname)).toEqual(['b:pipe(75)', 'b:cap(75)', 'b:netcup', 'a:chan(1200,6,75)']);

      const p = value(await m.parts.create('a:chan', ['2400.0', '012', ''], { tracking: 'run' }));
      expect(p).toMatchObject({ pnum: 5, params: ['2400', '12', '75'], partname: 'a:chan(2400,12,75)', status: 'proposed', tracking: 'run' });
      failure(await m.parts.create('a:chan', ['2400', '12.00', '75']), 'refused', 'PartCombination');
      failure(await m.parts.create('a:chan', ['2400', '12', '50']), 'invalid');
      failure(await m.parts.create('a:chan', ['200', '12', '75']), 'invalid');
      failure(await m.parts.create('a:chan', ['2400', '12']), 'invalid');
      failure(await m.parts.create('@:tower', ['4', '1200']), 'refused', 'PartKind');

      expect(value(await m.parts.get({ partname: 'a:chan(2400.00, 12, 75).2' })).pnum).toBe(5);
      expect(value(await m.parts.get({ partname: '5' })).id).toBe(p.id);
      expect(value(await m.parts.get({ pnum: 5 })).id).toBe(p.id);
      failure(await m.parts.get({ partname: 'a:chan(3000,12,75)' }), 'not-found');
      failure(await m.parts.get({ partname: 'not a part' }), 'invalid');
      failure(await m.parts.canonical('a:chan', ['1.2e3', '1', '75']), 'invalid');
      expect(value(await m.parts.canonical('a:chan', ['300.50', '+1', '100']))).toEqual(['300.5', '1', '100']);
    });

    it('updates a part but never its identity', async () => {
      const p = value(await m.parts.update(value(await m.parts.get({ pnum: 5 })).id, { status: 'active', minLevel: 4, comment: 'popular' }));
      expect(p).toMatchObject({ status: 'active', minLevel: 4, comment: 'popular', params: ['2400', '12', '75'] });
      failure(await m.parts.update(p.id, { status: 'bogus' as never }), 'refused', 'PartStatus');
      expect(value(await m.parts.list({ status: 'active' })).map((x) => x.pnum)).toEqual([4, 5]);
    });

    it('keeps standard packages, with values left open', async () => {
      const tower = value(await m.families.get('@:tower'));
      const pkg = value(await m.packages.create('@:tower', 'Custom length', ['4', null]));
      expect(pkg.params).toEqual(['4', null]);
      failure(await m.packages.create('a:chan', 'nope', ['1200', '6', '75']), 'refused', 'StandardPackageKind');
      expect(value(await m.packages.list(tower.id)).map((x) => x.name)).toEqual(['Custom length', 'Four by 1.2 m']);
      value(await m.packages.remove(pkg.id));
      expect(value(await m.packages.list(tower.id)).length).toBe(1);
    });

    it('answers where a family is used', async () => {
      const used = value(await m.families.whereUsed('b:pipe'));
      expect(used.map((u) => `${u.base}.${u.ver}/${u.state}`)).toEqual(['a:chan.1/retired', 'a:chan.2/released', 'a:frame.1/released']);
    });
  });
}
