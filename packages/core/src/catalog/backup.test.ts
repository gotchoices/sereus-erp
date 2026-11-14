import { describe, expect, it } from 'vitest';
import type { Result } from '../result.js';
import { openMemoryDb } from '../sql.js';
import {
  catalogExportToYaml, describeExport, exportCatalog, parseCatalogExport, restoreCatalog, RestoreRefusedError,
} from './backup.js';
import { loadSampleCatalog } from './sample.js';
import { CATALOG_SCHEMA } from './sapp.js';
import { createCatalogModel } from './sql-model.js';
import { loadStarterCatalog, STARTER_CLASSES, STARTER_UNITS } from './starter.js';

const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`${r.error.kind}: ${r.error.message}`);
  return r.value;
};

let tick = 0;
const clock = () => new Date(Date.UTC(2026, 0, 1) + (tick++) * 60_000).toISOString();

async function catalog(actor: string) {
  const db = await openMemoryDb(CATALOG_SCHEMA);
  return { db, model: createCatalogModel(db, { actor, now: clock }) };
}

describe('starter set', () => {
  it('adds units, classes and operations once, keeping what is there', async () => {
    const { model } = await catalog('admin');
    value(await model.units.put({ code: 'ea', name: 'piece', dimension: 'count', scale: 0, factorNum: 1, factorDen: 1 }));
    const first = await loadStarterCatalog(model);
    expect(first.units).toBe(STARTER_UNITS.length - 1);
    expect(first.classes).toBe(STARTER_CLASSES.length);
    expect(value(await model.units.list()).find((u) => u.code === 'ea')?.name).toBe('piece');
    expect(await loadStarterCatalog(model)).toEqual({ units: 0, classes: 0, operations: 0 });
  });
});

describe('about and machine names', () => {
  it('keeps one about record and a name per machine', async () => {
    const { model } = await catalog('m1');
    expect(value(await model.about.get())).toBeNull();
    value(await model.about.set({ name: 'Catalog', purpose: 'Main catalog', company: 'Acme' }));
    const again = value(await model.about.set({ name: 'Main', purpose: 'Everything we make', company: 'Acme' }));
    expect(again).toMatchObject({ name: 'Main', purpose: 'Everything we make', company: 'Acme' });
    expect((await model.about.set({ name: '  ', purpose: '', company: '' })).ok).toBe(false);
    value(await model.machines.name('peer-a', 'office server'));
    value(await model.machines.name('peer-a', 'closet server'));
    value(await model.machines.name('peer-b', 'shop laptop'));
    expect(value(await model.machines.list()).map((m) => m.label)).toEqual(['closet server', 'shop laptop']);
  });
});

describe('export and restore', () => {
  it('restores a catalog that cannot be told from the original', async () => {
    const src = await catalog('engineer-1');
    value(await src.model.about.set({ name: 'Catalog', purpose: 'Test', company: 'Acme' }));
    await loadSampleCatalog(src.model);
    // A second writer, a minor revision, a part number and a second version.
    const other = createCatalogModel(src.db, { actor: 'engineer-2', now: clock });
    const chan = value(await other.families.get('a:chan'));
    const v1 = value(await other.versions.get(chan.id, 1));
    const step = v1.notes[0];
    if (step) value(await other.versions.revise(chan.id, 1, { summary: 'clarify', notes: { replace: [{ ...step, body: step.body + ' (clarified)' }] } }));
    const part = value(await other.parts.create('a:chan', ['2400', '12', '100']));
    value(await other.parts.number({ id: part.id }));
    value(await other.versions.startDraft(chan.id));
    value(await other.versions.release(chan.id, { changeSummary: 'second', interchangeable: true }));

    const exp = await exportCatalog(src.db, '2026-02-01T00:00:00.000Z');
    const text = catalogExportToYaml(exp);
    const parsed = parseCatalogExport(text);
    expect(describeExport(parsed)).toMatchObject({ families: exp.tables.Family!.length, name: 'Catalog' });

    // The target was founded with the starting set, which gives way to the file's.
    const dst = await catalog('restorer');
    await loadStarterCatalog(dst.model);
    const report = await restoreCatalog(dst.db, parsed);
    expect(report.replaced).toBeGreaterThan(0);

    const back = await exportCatalog(dst.db, exp.exportedAt);
    for (const t of Object.keys(exp.tables) as Array<keyof typeof exp.tables>) {
      if (t === 'About' || t === 'Machine') continue;
      expect(back.tables[t], t).toEqual(exp.tables[t]);
    }
    // Nothing was written as the restorer.
    expect(JSON.stringify(back.tables)).not.toContain('restorer');

    // The restored catalog works: a new draft can be started and released.
    value(await dst.model.versions.startDraft(chan.id));
    value(await dst.model.versions.release(chan.id, { changeSummary: 'third', interchangeable: true }));
  });

  it('refuses a catalog that has families', async () => {
    const src = await catalog('e');
    await loadSampleCatalog(src.model);
    const exp = await exportCatalog(src.db);
    await expect(restoreCatalog(src.db, exp)).rejects.toBeInstanceOf(RestoreRefusedError);
  });
});
