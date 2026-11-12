/**
 * A small sample catalog: an illustrative hydroponics line, for the in-memory catalog (UI work,
 * demos) and the contract tests. It is not the owner's actual product data; that will be
 * entered through the product manager (STATUS.md, step C3).
 */
import type { CatalogModel, DraftDefinition } from './model.js';
import type { Result } from '../result.js';

const empty: DraftDefinition = {
  spec: null, familyScript: null, priceFormula: null, explodeDefault: 'none', compatNotes: null,
  parameters: [], lines: [], processes: [], notes: [], documents: [],
};

function must<T>(r: Result<T>, what: string): T {
  if (!r.ok) throw new Error(`sample catalog: ${what}: ${r.error.kind} ${r.error.rule ?? ''} ${r.error.message}`);
  return r.value;
}

/** Load the sample into an empty catalog. Families are released as version 1. */
export async function loadSampleCatalog(m: CatalogModel): Promise<void> {
  for (const u of [
    { code: 'ea', name: 'each', dimension: 'count' as const, scale: 0, factorNum: null, factorDen: null },
    { code: 'mm', name: 'millimeter', dimension: 'length' as const, scale: 0, factorNum: 1, factorDen: 1000 },
    { code: 'm', name: 'meter', dimension: 'length' as const, scale: 3, factorNum: 1, factorDen: 1 },
  ]) must(await m.units.put(u), `unit ${u.code}`);
  for (const c of [
    { prefix: 'a', name: 'Assemblies', kind: 'part' as const },
    { prefix: 'b', name: 'Purchased parts', kind: 'part' as const },
    { prefix: '@', name: 'Kits', kind: 'package' as const },
  ]) must(await m.classes.put({ ...c, storageNotes: null, defaultLocationType: null }), `class ${c.prefix}`);
  for (const o of [{ code: 'cut', description: 'Cut to length' }, { code: 'drill', description: 'Drill' }, { code: 'assy', description: 'Assemble' }]) {
    must(await m.operations.put(o), `operation ${o.code}`);
  }

  const define = async (base: string, unitCode: string, description: string, def: Partial<DraftDefinition>) => {
    const fam = must(await m.families.create({ base, unitCode, description }, { ...empty, ...def }), base);
    must(await m.versions.release(fam.id, { changeSummary: 'first release' }), `release ${base}`);
    return fam;
  };

  await define('b:pipe', 'm', 'PVC pipe, sold by length', {
    parameters: [{ pos: 1, var: 'D', type: 'enum', unitCode: null, description: 'Nominal diameter', defaultValue: null, min: null, max: null,
      allowed: [{ value: '75', description: '75 mm' }, { value: '100', description: '100 mm' }] }],
  });
  await define('b:cap', 'ea', 'PVC end cap', {
    parameters: [{ pos: 1, var: 'D', type: 'enum', unitCode: null, description: 'Nominal diameter', defaultValue: null, min: null, max: null,
      allowed: [{ value: '75', description: '75 mm' }, { value: '100', description: '100 mm' }] }],
  });
  await define('b:netcup', 'ea', 'Net cup, 50 mm', {});

  await define('a:chan', 'ea', 'NFT grow channel', {
    spec: 'A length of pipe with planting holes on one side and caps on both ends.',
    parameters: [
      { pos: 1, var: 'L', type: 'num', unitCode: 'mm', description: 'Length', defaultValue: null, min: 300, max: 3000, allowed: [] },
      { pos: 2, var: 'N', type: 'num', unitCode: 'ea', description: 'Planting sites', defaultValue: null, min: 1, max: 30, allowed: [] },
      { pos: 3, var: 'D', type: 'enum', unitCode: null, description: 'Pipe diameter', defaultValue: '75', min: null, max: null,
        allowed: [{ value: '75', description: '75 mm' }, { value: '100', description: '100 mm' }] },
    ],
    processes: [
      { idx: 1, operationCode: 'cut', nextIdx: 2, setupTime: '5', laborPerUnit: '1', machinePerUnit: null, description: 'Cut pipe' },
      { idx: 2, operationCode: 'drill', nextIdx: 3, setupTime: '10', laborPerUnit: '0.5 * N', machinePerUnit: null, description: 'Drill sites' },
      { idx: 3, operationCode: 'assy', nextIdx: null, setupTime: null, laborPerUnit: '2', machinePerUnit: null, description: 'Fit caps' },
    ],
    lines: [
      { pos: 1, component: 'b:pipe', childParams: ['D'], qty: 'L / 1000', when: null, script: null, processIdx: 1, childVer: null, comment: null },
      { pos: 2, component: 'b:cap', childParams: ['D'], qty: '2', when: null, script: null, processIdx: 3, childVer: null, comment: null },
      { pos: 3, component: 'b:netcup', childParams: [], qty: 'N', when: null, script: null, processIdx: null, childVer: null, comment: 'Shipped loose' },
    ],
    notes: [
      { processIdx: 2, seq: 1, type: 'step', body: 'Space sites evenly, first one 150 mm from the inlet end.', documentId: null, measure: null },
      { processIdx: 2, seq: 2, type: 'qc', body: 'Hole diameter', documentId: null,
        measure: { name: 'hole', units: 'mm', nominal: 51, min: 50.5, max: 52 } },
    ],
  });

  await define('@:tower', 'ea', 'Starter NFT kit', {
    explodeDefault: 'to_part',
    parameters: [
      { pos: 1, var: 'C', type: 'num', unitCode: 'ea', description: 'Channels', defaultValue: null, min: 1, max: 12, allowed: [] },
      { pos: 2, var: 'L', type: 'num', unitCode: 'mm', description: 'Channel length', defaultValue: null, min: 300, max: 3000, allowed: [] },
    ],
    lines: [{ pos: 1, component: 'a:chan', childParams: ['L', 'round(L / 200)', '75'], qty: 'C', when: null, script: null, processIdx: null, childVer: null, comment: null }],
  });

  must(await m.parts.create('b:pipe', ['75']), 'part b:pipe(75)');
  must(await m.parts.create('b:cap', ['75']), 'part b:cap(75)');
  must(await m.parts.create('b:netcup', []), 'part b:netcup');
  must(await m.parts.create('a:chan', ['1200', '6', '75'], { status: 'active' }), 'part a:chan(1200,6,75)');
  // Purchased parts get numbers (they are bought on POs); the channel is numbered when sold.
  for (const name of ['b:pipe(75)', 'b:cap(75)', 'b:netcup']) must(await m.parts.number({ partname: name }), `number ${name}`);
  must(await m.packages.create('@:tower', 'Four by 1.2 m', ['4', '1200'], 'The usual starter'), 'package');
}

export { empty as EMPTY_DRAFT };
