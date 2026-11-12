/**
 * Part numbers issued on two devices of one catalog strand at the same moment
 * (STATUS.md, open items, "Allocating part numbers across devices"). Both read the same
 * highest number and propose the same next one; the cohort must refuse one of them, and the
 * model must move that one on to the next free number. No number may be given twice, and
 * both devices must end up agreeing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CatalogModel, Part } from './model.js';
import { catalogSAppConfig } from './sapp.js';
import { foundCatalogStrand, openStrandCatalog } from './open.js';
import { loadSampleCatalog } from './sample.js';
import { startTestNode, until, type TestNode } from '../testing/node-host.js';
import { joinStrand } from '../testing/join.js';
import type { Result } from '../result.js';

function value<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.kind} ${r.error.rule ?? ''}: ${r.error.message}`);
  return r.value;
}

const ROUNDS = 5;

describe('part numbers issued on two devices at once', () => {
  let a: TestNode;
  let b: TestNode;
  let atA: CatalogModel;
  let atB: CatalogModel;

  beforeAll(async () => {
    a = await startTestNode('number-a');
    b = await startTestNode('number-b');
    const strandId = await foundCatalogStrand(a.node);
    atA = openStrandCatalog(a.node, strandId);
    await loadSampleCatalog(atA);
    await joinStrand(a, b, strandId, catalogSAppConfig());
    atB = openStrandCatalog(b.node, strandId);
    await until(async () => { const r = await atB.parts.list(); return r.ok && r.value.length === 4; }, 'the sample at B', 120_000);
  });
  afterAll(async () => { await b?.stop(); await a?.stop(); });

  it('never gives one number to two parts', async () => {
    const issued: Part[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      // One new part on each device, then both numbered at the same moment.
      const L = 1000 + round * 100;
      const pa = value(await atA.parts.create('a:chan', [String(L), '4', '75']));
      const pb = value(await atB.parts.create('a:chan', [String(L + 50), '4', '75']));
      await until(async () => (await atA.parts.get({ id: pb.id })).ok && (await atB.parts.get({ id: pa.id })).ok, `round ${round}: parts on both`, 120_000);
      const [na, nb] = await Promise.all([atA.parts.number({ id: pa.id }), atB.parts.number({ id: pb.id })]);
      issued.push(value(na), value(nb));
    }
    const numbers = issued.map((p) => p.pnum);
    expect(numbers.every((n) => n !== null)).toBe(true);
    expect(new Set(numbers).size).toBe(numbers.length);

    // Both devices converge on the same numbering.
    const view = async (m: CatalogModel) => value(await m.parts.list()).filter((p) => p.pnum !== null).map((p) => `${p.pnum}:${p.partname}`).sort();
    await until(async () => JSON.stringify(await view(atA)) === JSON.stringify(await view(atB)), 'both devices agree', 120_000);
    const final = await view(atA);
    expect(final.length).toBe(3 + issued.length);
    expect(new Set(final.map((x) => x.split(':')[0])).size).toBe(final.length);
  });
});
