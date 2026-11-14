/**
 * Export a catalog to a YAML file, and restore one into an empty catalog (deployment.md §9).
 *
 * The export is every row of every catalog table, with its identifiers, part numbers and audit
 * fields, in a form a person can read. A restore writes those rows back so that the restored
 * catalog cannot be told from the original: each insert carries the row's original author and
 * time as its mutation context (`CreatedBy`, `CreatedAt`), and a row changed after it was made
 * is then touched once more under its `UpdatedBy`, `UpdatedAt`. The audit rules accept both,
 * because they check the context, not who the writer is (catalog.qsql, "Audit").
 *
 * The schema decides the order. A family, its versions and everything they define are written
 * in one transaction, components before the families that use them (BomLineComponent). Minor
 * revisions follow, one transaction each, since a revision applies only to a version already
 * released (MinorOfReleased, MinorNext). Parts, part numbers and packages come last, in batches.
 */
import type { Database, SqlValue } from '@quereus/quereus';
import { parse, stringify } from 'yaml';
import { rows, run, serialized, transaction, type Row } from '../sql.js';
import { CATALOG_SAPP_VERSION } from './sapp.js';

export const EXPORT_FORMAT = 'wyatterp-catalog';
export const EXPORT_FORMAT_VERSION = 1;

/** The tables an export holds, in the order they are listed in the file. */
export const EXPORT_TABLES = [
  'About', 'Unit', 'Class', 'Operation',
  'Family', 'Version', 'Parameter', 'AllowedValue', 'Process', 'BomLine', 'Document', 'Note', 'MinorRevision',
  'Part', 'PartNumber', 'PartVersion', 'StandardPackage', 'Machine',
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

const KEYS: Record<ExportTable, string[]> = {
  About: ['Id'], Unit: ['Code'], Class: ['Prefix'], Operation: ['Code'],
  Family: ['Id'], Version: ['FamilyId', 'Ver'], Parameter: ['FamilyId', 'Ver', 'Pos'],
  AllowedValue: ['FamilyId', 'Ver', 'ParamPos', 'Value'], Process: ['FamilyId', 'Ver', 'Idx'],
  BomLine: ['FamilyId', 'Ver', 'Pos'], Document: ['Id'], Note: ['Id'], MinorRevision: ['FamilyId', 'Ver', 'Minor'],
  Part: ['Id'], PartNumber: ['Pnum'], PartVersion: ['PartId', 'Ver'], StandardPackage: ['Id'], Machine: ['PeerId'],
};

/** Columns the database computes; never written. */
const GENERATED: Partial<Record<ExportTable, string[]>> = { Family: ['ClassPrefix'] };
/** Columns holding JSON arrays or objects: written to the file as YAML, back to the database as JSON text. */
const JSON_COLUMNS = new Set(['Params', 'ChildParams', 'Measure']);
const AUDIT = ['CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy'];

export interface CatalogExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  /** The catalog sApp version the rows were read under. */
  schema: string;
  exportedAt: string;
  counts: Partial<Record<ExportTable, number>>;
  tables: Partial<Record<ExportTable, Row[]>>;
}

/** Read every catalog row. */
export async function exportCatalog(db: Database, now = new Date().toISOString()): Promise<CatalogExport> {
  return serialized(db, async () => {
    const tables: Partial<Record<ExportTable, Row[]>> = {};
    const counts: Partial<Record<ExportTable, number>> = {};
    for (const t of EXPORT_TABLES) {
      let found: Row[];
      try {
        found = await rows(db, `select * from App.${t} order by ${KEYS[t].join(', ')}`);
      } catch {
        found = []; // a table a later schema added, not yet on this strand
      }
      const gen = GENERATED[t] ?? [];
      tables[t] = found.map((r) => {
        const out: Row = {};
        for (const [k, v] of Object.entries(r)) {
          if (gen.includes(k)) continue;
          out[k] = JSON_COLUMNS.has(k) && typeof v === 'string' ? (JSON.parse(v) as SqlValue) : v;
        }
        return out;
      });
      counts[t] = found.length;
    }
    return { format: EXPORT_FORMAT, version: EXPORT_FORMAT_VERSION, schema: CATALOG_SAPP_VERSION, exportedAt: now, counts, tables };
  });
}

const HEADER = `# WyattERP catalog export (deployment.md §9). Every row of every catalog table, with its
# identifiers, part numbers and audit fields. Restore it into a new, empty catalog with
# "wyatt restore <file>" or the web app's Settings, Backup.
`;

export function catalogExportToYaml(exp: CatalogExport): string {
  return HEADER + stringify(exp, { lineWidth: 0, aliasDuplicateObjects: false });
}

export function parseCatalogExport(text: string): CatalogExport {
  const exp = parse(text) as CatalogExport | null;
  if (!exp || exp.format !== EXPORT_FORMAT) throw new Error('This is not a WyattERP catalog export.');
  if (exp.version !== EXPORT_FORMAT_VERSION) throw new Error(`Export format version ${exp.version} is not supported (expected ${EXPORT_FORMAT_VERSION}).`);
  if (!exp.tables || typeof exp.tables !== 'object') throw new Error('The export holds no tables.');
  return exp;
}

/** What a file holds, for a confirmation before restoring. */
export function describeExport(exp: CatalogExport): { families: number; parts: number; partNumbers: number; exportedAt: string; name: string | null; company: string | null } {
  const about = exp.tables.About?.[0];
  return {
    families: exp.tables.Family?.length ?? 0,
    parts: exp.tables.Part?.length ?? 0,
    partNumbers: exp.tables.PartNumber?.length ?? 0,
    exportedAt: exp.exportedAt,
    name: about ? String(about.Name) : null,
    company: about ? String(about.Company) : null,
  };
}

export interface RestoreProgress {
  step: string;
  done: number;
  total: number;
}

export interface RestoreReport {
  counts: Partial<Record<ExportTable, number>>;
  /** Reference entries already in the catalog (a starting set) that the file's replaced. */
  replaced: number;
}

export class RestoreRefusedError extends Error {
  readonly rule = 'RestoreIntoEmpty';
}

const PART_BATCH = 200;

/**
 * Write an export into a catalog that has no families, parts or packages. Reference entries
 * already there (a starting set) are replaced by the file's; nothing else is touched. About and
 * Machine are not restored: they describe the strand and the machines of the party restoring.
 */
export async function restoreCatalog(db: Database, exp: CatalogExport, onProgress?: (p: RestoreProgress) => void): Promise<RestoreReport> {
  return serialized(db, async () => {
    for (const t of ['Family', 'Part', 'StandardPackage'] as const) {
      const [r] = await rows(db, `select count(*) as N from App.${t}`);
      if (Number(r?.N ?? 0) > 0) throw new RestoreRefusedError(`The catalog already has records (${t}); a restore goes only into an empty catalog.`);
    }
    const t = exp.tables;
    const counts: Partial<Record<ExportTable, number>> = {};
    const count = (table: ExportTable, n = 1) => { counts[table] = (counts[table] ?? 0) + n; };
    const report = (step: string, done: number, total: number) => onProgress?.({ step, done, total });

    // Reference data: the starting set, unused, gives way to the file's.
    let replaced = 0;
    await transaction(db, async () => {
      for (const table of ['Unit', 'Class', 'Operation'] as const) {
        const [r] = await rows(db, `select count(*) as N from App.${table}`);
        replaced += Number(r?.N ?? 0);
        await run(db, `delete from App.${table}`);
        for (const row of t[table] ?? []) { await writeRow(db, table, row); count(table); }
      }
    });
    report('reference data', 1, 1);

    // Families, components first.
    const families = t.Family ?? [];
    const byFamily = <T extends ExportTable>(table: T) => groupBy(t[table] ?? [], (r) => String(r.FamilyId));
    const versions = byFamily('Version'), params = byFamily('Parameter'), allowed = byFamily('AllowedValue');
    const processes = byFamily('Process'), lines = byFamily('BomLine'), docs = byFamily('Document'), notes = byFamily('Note');
    const order = familyOrder(families, lines);
    let done = 0;
    for (const group of order) {
      await transaction(db, async () => {
        const touch: Array<[ExportTable, Row]> = [];
        const put = async (table: ExportTable, row: Row, base: Row = row) => {
          await writeRow(db, table, base);
          if (needsTouch(row)) touch.push([table, row]);
          count(table);
        };
        for (const fam of group) {
          const id = String(fam.Id);
          await put('Family', fam);
          for (const r of versions.get(id) ?? []) await put('Version', r);
          for (const r of params.get(id) ?? []) await put('Parameter', r);
          for (const r of allowed.get(id) ?? []) await put('AllowedValue', r);
          for (const r of processes.get(id) ?? []) await put('Process', r);
          for (const r of lines.get(id) ?? []) await put('BomLine', r);
          // Documents and notes as they stood at the release (minor 0); later minors follow below.
          for (const r of docs.get(id) ?? []) if (Number(r.FromMinor ?? 0) === 0) await put('Document', r, { ...r, ToMinor: null });
          for (const r of notes.get(id) ?? []) if (Number(r.FromMinor ?? 0) === 0) await put('Note', r, { ...r, ToMinor: null });
        }
        // Rows ended by a minor revision are touched when that revision is replayed.
        for (const [table, row] of touch) if (row.ToMinor === null || row.ToMinor === undefined) await touchRow(db, table, row);
      });
      done += group.length;
      report('families', done, families.length);
    }

    // Minor revisions, one transaction each, in order.
    const minors = [...(t.MinorRevision ?? [])].sort((a, b) =>
      String(a.FamilyId).localeCompare(String(b.FamilyId)) || Number(a.Ver) - Number(b.Ver) || Number(a.Minor) - Number(b.Minor));
    for (const [i, m] of minors.entries()) {
      const at = (r: Row) => String(r.FamilyId) === String(m.FamilyId) && Number(r.Ver) === Number(m.Ver);
      await transaction(db, async () => {
        await writeRow(db, 'MinorRevision', m);
        count('MinorRevision');
        for (const table of ['Document', 'Note'] as const) {
          for (const r of (t[table] ?? []).filter(at)) {
            if (Number(r.FromMinor) === Number(m.Minor)) { await writeRow(db, table, { ...r, ToMinor: null }); count(table); }
            if (r.ToMinor !== null && r.ToMinor !== undefined && Number(r.ToMinor) === Number(m.Minor)) {
              await updateRow(db, table, r, { ToMinor: Number(m.Minor) }, String(r.UpdatedBy), String(r.UpdatedAt));
            }
          }
        }
      });
      report('minor revisions', i + 1, minors.length);
    }

    // Parts and what hangs off them, in batches.
    const parts = t.Part ?? [];
    for (let i = 0; i < parts.length; i += PART_BATCH) {
      const batch = parts.slice(i, i + PART_BATCH);
      await transaction(db, async () => {
        for (const p of batch) await writeRow(db, 'Part', p);
        for (const p of batch) if (needsTouch(p)) await touchRow(db, 'Part', p);
      });
      count('Part', batch.length);
      report('parts', Math.min(i + PART_BATCH, parts.length), parts.length);
    }
    for (const table of ['PartNumber', 'PartVersion', 'StandardPackage'] as const) {
      const all = t[table] ?? [];
      for (let i = 0; i < all.length; i += PART_BATCH) {
        const batch = all.slice(i, i + PART_BATCH);
        await transaction(db, async () => {
          for (const r of batch) await writeRow(db, table, r);
          for (const r of batch) if (needsTouch(r)) await touchRow(db, table, r);
        });
        count(table, batch.length);
      }
      report(table, all.length, all.length);
    }
    return { counts, replaced };
  });
}

/** Insert a row as it was first written: its creator and creation time as the context. */
async function writeRow(db: Database, table: ExportTable, row: Row): Promise<void> {
  const gen = GENERATED[table] ?? [];
  const values: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (gen.includes(k)) continue;
    values[k] = toSql(k, v);
  }
  values.UpdatedAt = values.CreatedAt ?? null;
  values.UpdatedBy = values.CreatedBy ?? null;
  const cols = Object.keys(values);
  await run(db,
    `insert into App.${table} (${cols.join(', ')}) with context Actor = :ctx_actor, Now = :ctx_now values (${cols.map((c) => `:v_${c}`).join(', ')})`,
    { ctx_actor: values.CreatedBy ?? null, ctx_now: values.CreatedAt ?? null, ...prefix('v_', values) });
}

/** A row changed after it was made: record its last change under the original author and time. */
async function touchRow(db: Database, table: ExportTable, row: Row): Promise<void> {
  await updateRow(db, table, row, {}, String(row.UpdatedBy), String(row.UpdatedAt));
}

async function updateRow(db: Database, table: ExportTable, row: Row, set: Row, actor: string, now: string): Promise<void> {
  const keys = KEYS[table];
  const all: Row = { ...set, UpdatedAt: now, UpdatedBy: actor };
  await run(db,
    `update App.${table} with context Actor = :ctx_actor, Now = :ctx_now
       set ${Object.keys(all).map((c) => `${c} = :s_${c}`).join(', ')}
       where ${keys.map((c) => `${c} = :w_${c}`).join(' and ')}`,
    { ctx_actor: actor, ctx_now: now, ...prefix('s_', all), ...prefix('w_', Object.fromEntries(keys.map((k) => [k, toSql(k, row[k] as SqlValue)]))) });
}

function needsTouch(row: Row): boolean {
  return row.UpdatedAt !== row.CreatedAt || row.UpdatedBy !== row.CreatedBy;
}

function toSql(col: string, v: unknown): SqlValue {
  if (v === undefined) return null;
  if (JSON_COLUMNS.has(col) && v !== null && typeof v === 'object' && !(v instanceof Uint8Array)) return JSON.stringify(v);
  if (v instanceof Date) return v.toISOString();
  return v as SqlValue;
}

function prefix(p: string, values: Row): Row {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [p + k, v]));
}

function groupBy(list: Row[], key: (r: Row) => string): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of list) {
    const k = key(r);
    let g = m.get(k);
    if (!g) m.set(k, (g = []));
    g.push(r);
  }
  return m;
}

/**
 * Families in groups, each group after every family its lines name as a component. A cycle
 * (which the catalog does not refuse yet) lands in one group, written in one transaction.
 */
function familyOrder(families: Row[], linesByFamily: Map<string, Row[]>): Row[][] {
  const byBase = new Map(families.map((f) => [String(f.Base), f]));
  const deps = new Map<string, Set<string>>();
  for (const f of families) {
    const own = String(f.Base);
    const needs = new Set<string>();
    for (const l of linesByFamily.get(String(f.Id)) ?? []) {
      const c = String(l.Component);
      if (c !== own && byBase.has(c)) needs.add(c);
    }
    deps.set(own, needs);
  }
  const groups: Row[][] = [];
  const placed = new Set<string>();
  while (placed.size < families.length) {
    const ready = [...deps.keys()].filter((b) => !placed.has(b) && [...deps.get(b)!].every((d) => placed.has(d)));
    if (ready.length === 0) {
      const rest = [...deps.keys()].filter((b) => !placed.has(b));
      groups.push(rest.map((b) => byBase.get(b)!));
      break;
    }
    for (const b of ready) { groups.push([byBase.get(b)!]); placed.add(b); }
  }
  return groups;
}
