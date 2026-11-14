/**
 * The starting set a new catalog may be given (product-05 Q4): units, classes and operations
 * that suit almost any shop, for the owner to adjust. Offered when a strand is founded, never
 * applied without asking.
 *
 * Each dimension's base unit has factor 1/1 (product.md, Unit). Factors are exact fractions.
 */
import type { CatalogModel, Class, Operation, Unit } from './model.js';
import type { Result } from '../result.js';

const u = (code: string, name: string, dimension: Unit['dimension'], scale: number, factorNum: number, factorDen: number): Unit =>
  ({ code, name, dimension, scale, factorNum, factorDen });

export const STARTER_UNITS: readonly Unit[] = [
  u('ea', 'each', 'count', 0, 1, 1),
  u('pr', 'pair', 'count', 0, 2, 1),
  u('dz', 'dozen', 'count', 0, 12, 1),
  u('m', 'meter', 'length', 3, 1, 1),
  u('cm', 'centimeter', 'length', 1, 1, 100),
  u('mm', 'millimeter', 'length', 0, 1, 1000),
  u('in', 'inch', 'length', 3, 127, 5000),          // 0.0254 m
  u('ft', 'foot', 'length', 3, 381, 1250),          // 0.3048 m
  u('m2', 'square meter', 'area', 3, 1, 1),
  u('ft2', 'square foot', 'area', 3, 145161, 1562500), // 0.09290304 m²
  u('l', 'liter', 'volume', 3, 1, 1),
  u('ml', 'milliliter', 'volume', 0, 1, 1000),
  u('m3', 'cubic meter', 'volume', 3, 1000, 1),
  u('gal', 'US gallon', 'volume', 3, 473176473, 125000000), // 3.785411784 l
  u('kg', 'kilogram', 'mass', 3, 1, 1),
  u('g', 'gram', 'mass', 0, 1, 1000),
  u('lb', 'pound', 'mass', 3, 45359237, 100000000), // 0.45359237 kg
  u('oz', 'ounce', 'mass', 3, 45359237, 1600000000), // 1/16 lb
  u('h', 'hour', 'time', 2, 1, 1),
  u('min', 'minute', 'time', 0, 1, 60),
];

const c = (prefix: string, name: string, kind: Class['kind'], storageNotes: string | null = null): Class =>
  ({ prefix, name, kind, storageNotes, defaultLocationType: null });

export const STARTER_CLASSES: readonly Class[] = [
  c('a', 'Assemblies and products made here', 'part'),
  c('b', 'Bought components', 'part'),
  c('r', 'Raw materials', 'part'),
  c('s', 'Supplies and consumables', 'part'),
  c('@', 'Kits and packages, sold as a set', 'package'),
  c('K', 'Custom, made to one order', 'custom'),
];

export const STARTER_OPERATIONS: readonly Operation[] = [
  { code: 'cut', description: 'Cut to size' },
  { code: 'drill', description: 'Drill' },
  { code: 'machine', description: 'Machine' },
  { code: 'form', description: 'Bend or form' },
  { code: 'weld', description: 'Weld or join' },
  { code: 'assy', description: 'Assemble' },
  { code: 'wire', description: 'Wire' },
  { code: 'finish', description: 'Paint or finish' },
  { code: 'test', description: 'Test' },
  { code: 'inspect', description: 'Inspect' },
  { code: 'pack', description: 'Pack' },
];

/** How many starter entries were added; entries already present are left as they are. */
export interface StarterResult {
  units: number;
  classes: number;
  operations: number;
}

/** Add the starting set to a catalog, skipping any entry whose code is already there. */
export async function loadStarterCatalog(m: CatalogModel): Promise<StarterResult> {
  const must = <T>(r: Result<T>, what: string): T => {
    if (!r.ok) throw new Error(`starter catalog: ${what}: ${r.error.message}`);
    return r.value;
  };
  const have = {
    units: new Set(must(await m.units.list(), 'units').map((x) => x.code)),
    classes: new Set(must(await m.classes.list(), 'classes').map((x) => x.prefix)),
    operations: new Set(must(await m.operations.list(), 'operations').map((x) => x.code)),
  };
  const added: StarterResult = { units: 0, classes: 0, operations: 0 };
  for (const x of STARTER_UNITS) if (!have.units.has(x.code)) { must(await m.units.put(x), `unit ${x.code}`); added.units++; }
  for (const x of STARTER_CLASSES) if (!have.classes.has(x.prefix)) { must(await m.classes.put(x), `class ${x.prefix}`); added.classes++; }
  for (const x of STARTER_OPERATIONS) if (!have.operations.has(x.code)) { must(await m.operations.put(x), `operation ${x.code}`); added.operations++; }
  return added;
}
