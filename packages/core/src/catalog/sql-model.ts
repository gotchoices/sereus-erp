/**
 * The catalog model over a Quereus `Database` holding the catalog schema in `App`
 * (catalog.qsql). The schema enforces the invariants. This file turns operations into
 * statements, supplies the mutation context (who and when), and checks the few rules the
 * schema cannot: parameter values against their definitions, child parameter counts at
 * release, and the shape of inputs.
 *
 * Not yet here (they need the BOM engine, packages/bom-engine): release validation explosions,
 * PartVersion rows at release, cycle checks (product.md §4, §8).
 */
import type { Database, SqlValue } from '@quereus/quereus';
import { canonicalNumber, formatPartname, isBase, newId, parsePartname } from '@wyatt/domain';
import { attempt, CoreFailure, toCoreError, type Result } from '../result.js';
import { rows, run, serialized, transaction, type Row } from '../sql.js';
import type {
  BomLineDef, CatalogModel, Class, DocumentDef, DraftDefinition, Family, FamilyFilter, FamilyPatch,
  MinorChange, NewFamily, NoteDef, Operation, ParameterDef, Part, PartFields, PartRef, ProcessDef,
  ReferenceUsage, Release, StandardPackage, Unit, Version, WhereUsed,
} from './model.js';

export interface CatalogModelOptions {
  /** Who is writing: recorded as CreatedBy/UpdatedBy. On a strand, this device's peer ID. */
  actor: string;
  /** The current time, ISO-8601. Defaults to the clock. */
  now?: () => string;
}

const refused = (rule: string, message: string) => new CoreFailure('refused', message, rule);
const notFound = (message: string) => new CoreFailure('not-found', message);
const invalid = (message: string) => new CoreFailure('invalid', message);

// Column names of each entity, in the model's terms → the schema's.
const PART_FIELDS: Record<keyof PartFields, string> = {
  status: 'Status', minLevel: 'MinLevel', targetLevel: 'TargetLevel', minBuy: 'MinBuy', weight: 'Weight',
  length: 'Length', width: 'Width', height: 'Height', stackFactor: 'StackFactor', tracking: 'Tracking',
  shelfLifeDays: 'ShelfLifeDays', comment: 'Comment',
};
const FAMILY_FIELDS: Record<keyof FamilyPatch, string> = {
  base: 'Base', unitCode: 'UnitCode', description: 'Description', status: 'Status', versionStrict: 'VersionStrict',
};

const str = (v: SqlValue | undefined): string | null => (v === null || v === undefined ? null : String(v));
const num = (v: SqlValue | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const bool = (v: SqlValue | undefined): boolean | null => (v === null || v === undefined ? null : Boolean(v));
const json = <T>(v: SqlValue | undefined): T => (typeof v === 'string' ? JSON.parse(v) : v) as T;

function mapFamily(r: Row): Family {
  return {
    id: String(r.Id), base: String(r.Base), classPrefix: String(r.ClassPrefix), unitCode: String(r.UnitCode),
    description: String(r.Description), status: r.Status as Family['status'], currentVer: num(r.CurrentVer),
    draftVer: num(r.DraftVer), versionStrict: Boolean(r.VersionStrict),
  };
}

function mapPart(r: Row): Part {
  const params = json<string[]>(r.Params);
  return {
    id: String(r.Id), pnum: num(r.Pnum), familyId: String(r.FamilyId), base: String(r.Base), params,
    partname: formatPartname(String(r.Base), params),
    status: r.Status as Part['status'], minLevel: num(r.MinLevel), targetLevel: num(r.TargetLevel), minBuy: num(r.MinBuy),
    weight: num(r.Weight), length: num(r.Length), width: num(r.Width), height: num(r.Height),
    stackFactor: num(r.StackFactor), tracking: r.Tracking as Part['tracking'], shelfLifeDays: num(r.ShelfLifeDays),
    comment: str(r.Comment),
  };
}

const FAMILY_SELECT = `select f.*, d.Ver as DraftVer from App.Family f
  left join (select FamilyId, Ver from App.Version where State = 'draft') d on d.FamilyId = f.Id`;
const PART_SELECT = `select p.*, f.Base, n.Pnum from App.Part p join App.Family f on f.Id = p.FamilyId
  left join App.PartNumber n on n.PartId = p.Id`;
/** Tries at numbering a part when other devices keep taking the number first. */
const NUMBER_ATTEMPTS = 8;

export function createCatalogModel(db: Database, opts: CatalogModelOptions): CatalogModel {
  const clock = opts.now ?? (() => new Date().toISOString());

  /** One operation: serialized on the database, failures turned into a Result. */
  function op<T>(body: (w: Writer) => Promise<T>): Promise<Result<T>> {
    return serialized(db, () => attempt(() => body(new Writer(db, opts.actor, clock()))));
  }
  const inTxn = <T>(body: () => Promise<T>) => transaction(db, body);

  // ── Reads used by several operations ──

  async function family(idOrBase: string): Promise<Family> {
    const [r] = await rows(db, `${FAMILY_SELECT} where f.Id = ? or f.Base = ?`, [idOrBase, idOrBase]);
    if (!r) throw notFound(`no family ${idOrBase}`);
    return mapFamily(r);
  }

  async function latestMinor(familyId: string, ver: number): Promise<number> {
    const [r] = await rows(db, 'select max(Minor) as M from App.MinorRevision where FamilyId = ? and Ver = ?', [familyId, ver]);
    return num(r?.M) ?? 0;
  }

  async function parameters(familyId: string, ver: number): Promise<ParameterDef[]> {
    const params = await rows(db, 'select * from App.Parameter where FamilyId = ? and Ver = ? order by Pos', [familyId, ver]);
    const allowed = await rows(db, 'select * from App.AllowedValue where FamilyId = ? and Ver = ? order by ParamPos, Value', [familyId, ver]);
    return params.map((p) => ({
      pos: Number(p.Pos), var: String(p.Var), type: p.Type as ParameterDef['type'], unitCode: str(p.UnitCode),
      description: String(p.Description), defaultValue: str(p.DefaultValue), min: num(p.MinValue), max: num(p.MaxValue),
      allowed: allowed.filter((a) => a.ParamPos === p.Pos).map((a) => ({ value: String(a.Value), description: String(a.Description) })),
    }));
  }

  async function version(familyId: string, ver: number, asOf?: number): Promise<Version> {
    const [v] = await rows(db, 'select * from App.Version where FamilyId = ? and Ver = ?', [familyId, ver]);
    if (!v) throw notFound(`no version ${ver} of family ${familyId}`);
    const latest = await latestMinor(familyId, ver);
    const m = asOf ?? latest;
    if (m < 0 || m > latest) throw notFound(`version ${ver} has no minor revision ${m}`);
    const valid = 'FamilyId = ? and Ver = ? and FromMinor <= ? and (ToMinor is null or ToMinor > ?)';
    const [lines, processes, notes, documents, minors] = await Promise.all([
      rows(db, 'select * from App.BomLine where FamilyId = ? and Ver = ? order by Pos', [familyId, ver]),
      rows(db, 'select * from App.Process where FamilyId = ? and Ver = ? order by Idx', [familyId, ver]),
      rows(db, `select * from App.Note where ${valid} order by ProcessIdx, Seq`, [familyId, ver, m, m]),
      rows(db, `select * from App.Document where ${valid} order by Kind, Name`, [familyId, ver, m, m]),
      rows(db, 'select * from App.MinorRevision where FamilyId = ? and Ver = ? order by Minor', [familyId, ver]),
    ]);
    return {
      familyId, ver, state: v.State as Version['state'],
      releasedAt: str(v.ReleasedAt), releasedBy: str(v.ReleasedBy), interchangeable: bool(v.Interchangeable),
      changeSummary: str(v.ChangeSummary), compatNotes: str(v.CompatNotes), spec: str(v.Spec),
      familyScript: str(v.FamilyScript), priceFormula: str(v.PriceFormula), explodeDefault: v.ExplodeDefault as Version['explodeDefault'],
      asOfMinor: m, latestMinor: latest,
      minorRevisions: minors.map((r) => ({ minor: Number(r.Minor), summary: String(r.Summary), at: String(r.CreatedAt), by: String(r.CreatedBy) })),
      parameters: await parameters(familyId, ver),
      lines: lines.map((l) => ({
        pos: Number(l.Pos), component: String(l.Component), childParams: json<string[]>(l.ChildParams), qty: String(l.Qty),
        when: str(l.WhenExpr), script: str(l.Script), processIdx: num(l.ProcessIdx), childVer: num(l.ChildVer), comment: str(l.Comment),
      })),
      processes: processes.map((p) => ({
        idx: Number(p.Idx), operationCode: String(p.OperationCode), nextIdx: num(p.NextIdx), setupTime: str(p.SetupTime),
        laborPerUnit: str(p.LaborPerUnit), machinePerUnit: str(p.MachinePerUnit), description: str(p.Description),
      })),
      notes: notes.map((n) => ({
        id: String(n.Id), processIdx: Number(n.ProcessIdx), seq: Number(n.Seq), type: n.Type as NoteDef['type'],
        body: String(n.Body), documentId: str(n.DocumentId), measure: n.Measure === null ? null : json<NoteDef['measure']>(n.Measure),
      })),
      documents: documents.map((d) => ({ id: String(d.Id), kind: String(d.Kind), name: String(d.Name), contentRef: String(d.ContentRef) })),
    };
  }

  /** Check values against a family's current version and return them in canonical form. */
  async function canonical(fam: Family, values: Array<string | null>, allowOpen = false): Promise<Array<string | null>> {
    if (fam.currentVer === null) throw refused('NoCurrentVersion', `${fam.base} has no released version`);
    const defs = await parameters(fam.id, fam.currentVer);
    if (values.length !== defs.length) {
      throw invalid(`${fam.base} takes ${defs.length} parameter(s), got ${values.length}`);
    }
    return defs.map((d, i) => {
      let v = values[i] ?? null;
      if (v === null) {
        if (allowOpen) return null;
        throw invalid(`${fam.base}: ${d.var} has no value`);
      }
      v = v.trim();
      if (v === '' && d.defaultValue !== null) v = d.defaultValue;
      if (v === '') throw invalid(`${fam.base}: ${d.var} has no value`);
      switch (d.type) {
        case 'num': {
          const c = canonicalNumber(v);
          if (c === null) throw invalid(`${fam.base}: ${d.var} = ${v} is not a number`);
          const n = Number(c);
          if ((d.min !== null && n < d.min) || (d.max !== null && n > d.max)) {
            throw invalid(`${fam.base}: ${d.var} = ${c} is outside ${d.min ?? ''}..${d.max ?? ''}`);
          }
          return c;
        }
        case 'enum':
          if (!d.allowed.some((a) => a.value === v)) throw invalid(`${fam.base}: ${d.var} = ${v} is not one of ${d.allowed.map((a) => a.value).join(', ')}`);
          return v;
        case 'str':
          if (/[(),]/.test(v)) throw invalid(`${fam.base}: ${d.var} may not contain parentheses or commas`);
          return v;
      }
    });
  }

  async function partBy(ref: PartRef): Promise<Part> {
    if ('id' in ref) {
      const [r] = await rows(db, `${PART_SELECT} where p.Id = ?`, [ref.id]);
      if (!r) throw notFound(`no part ${ref.id}`);
      return mapPart(r);
    }
    if ('pnum' in ref) {
      const [r] = await rows(db, `${PART_SELECT} where n.Pnum = ?`, [ref.pnum]);
      if (!r) throw notFound(`no part number ${ref.pnum}`);
      return mapPart(r);
    }
    let parsed;
    try { parsed = parsePartname(ref.partname); } catch (err) { throw invalid((err as Error).message); }
    if (parsed.kind === 'pnum') return partBy({ pnum: parsed.pnum });
    const fam = await family(parsed.base);
    const params = await canonical(fam, parsed.params);
    const [r] = await rows(db, `${PART_SELECT} where p.FamilyId = ? and p.Params = ?`, [fam.id, JSON.stringify(params)]);
    if (!r) throw notFound(`${formatPartname(fam.base, params as string[])} has no part number`);
    return mapPart(r);
  }

  // ── Writing a draft's definition ──

  /** Delete everything that hangs off a draft version, children before parents (a whole-draft save). */
  async function deleteContents(familyId: string, ver: number): Promise<void> {
    for (const t of ['Note', 'BomLine', 'AllowedValue', 'Parameter', 'Process', 'Document']) {
      await run(db, `delete from App.${t} where FamilyId = ? and Ver = ?`, [familyId, ver]);
    }
  }

  async function writeDefinition(w: Writer, familyId: string, ver: number, def: Partial<DraftDefinition>, replace: boolean): Promise<void> {
    const docs = (def.documents ?? []).map((d) => ({ ...d, id: d.id ?? newId() }));
    const docIds = new Set(docs.map((d) => d.id));
    for (const n of def.notes ?? []) {
      if (n.documentId !== null && !docIds.has(n.documentId)) {
        throw refused('NoteDocument', `note refers to document ${n.documentId}, which is not in this version`);
      }
    }
    await w.update('Version', {
      Spec: def.spec ?? null, FamilyScript: def.familyScript ?? null, PriceFormula: def.priceFormula ?? null,
      ExplodeDefault: def.explodeDefault ?? 'none', CompatNotes: def.compatNotes ?? null,
    }, { FamilyId: familyId, Ver: ver });
    if (replace) await deleteContents(familyId, ver);
    const key = { FamilyId: familyId, Ver: ver };
    for (const d of docs) await w.insert('Document', { ...key, ...documentRow(d), Id: d.id });
    for (const p of def.parameters ?? []) {
      await w.insert('Parameter', {
        ...key, Pos: p.pos, Var: p.var, Type: p.type, UnitCode: p.unitCode, Description: p.description,
        DefaultValue: p.defaultValue, MinValue: p.min, MaxValue: p.max,
      });
      for (const a of p.allowed) await w.insert('AllowedValue', { ...key, ParamPos: p.pos, Value: a.value, Description: a.description });
    }
    for (const p of def.processes ?? []) await w.insert('Process', { ...key, ...processRow(p) });
    for (const l of def.lines ?? []) await w.insert('BomLine', { ...key, ...lineRow(l) });
    for (const n of def.notes ?? []) await w.insert('Note', { ...key, ...noteRow(n), Id: n.id ?? newId() });
  }

  /** Release-time checks the schema cannot make (product.md §8). */
  async function checkLines(fam: Family, lines: BomLineDef[]): Promise<void> {
    for (const l of lines) {
      if (l.component === fam.base) continue; // a self-reference: the engine checks cycles
      const child = await family(l.component);
      const ver = l.childVer ?? child.currentVer;
      if (ver === null) throw refused('ChildNotReleased', `line ${l.pos}: ${l.component} has no released version`);
      const count = (await parameters(child.id, ver)).length;
      if (l.childParams.length !== count) {
        throw refused('ChildParamCount', `line ${l.pos}: ${l.component}.${ver} takes ${count} parameter(s), the line gives ${l.childParams.length}`);
      }
    }
  }

  // ── Reference data ──

  /** How many records name each unit, class and operation (product-05). */
  async function usage(): Promise<ReferenceUsage> {
    const count = async (sql: string) => Object.fromEntries((await rows(db, sql)).map((r) => [String(r.K), Number(r.N)]));
    const [famUnits, paramUnits, classes, operations] = await Promise.all([
      count('select UnitCode as K, count(*) as N from App.Family group by UnitCode'),
      count('select UnitCode as K, count(*) as N from App.Parameter where UnitCode is not null group by UnitCode'),
      count('select ClassPrefix as K, count(*) as N from App.Family group by ClassPrefix'),
      count('select OperationCode as K, count(*) as N from App.Process group by OperationCode'),
    ]);
    const units: Record<string, number> = { ...famUnits };
    for (const [k, n] of Object.entries(paramUnits)) units[k] = (units[k] ?? 0) + n;
    return { units, classes, operations };
  }

  /**
   * Insert or update reference data by key. `guard` sees the stored row and the new one and
   * may refuse the change (rules the schema cannot see, such as "in use").
   */
  function reference<T>(table: string, keyCol: string, toRow: (x: T) => Row, fromRow: (r: Row) => T, keyOf: (x: T) => string, order: string,
    guard?: (stored: Row, next: Row) => Promise<void>) {
    return {
      list: () => op(async () => (await rows(db, `select * from App.${table} order by ${order}`)).map(fromRow)),
      put: (x: T) => op(async (w) => {
        const key = keyOf(x);
        const [exists] = await rows(db, `select * from App.${table} where ${keyCol} = ?`, [key]);
        const r = toRow(x);
        if (exists && guard) await guard(exists, r);
        if (exists) {
          const { [keyCol]: _, ...rest } = r;
          await w.update(table, rest, { [keyCol]: key });
        } else {
          await w.insert(table, r);
        }
        const [after] = await rows(db, `select * from App.${table} where ${keyCol} = ?`, [key]);
        return fromRow(after!);
      }),
    };
  }

  return {
    units: reference<Unit>('Unit', 'Code',
      (u) => ({ Code: u.code, Name: u.name, Dimension: u.dimension, Scale: u.scale, FactorNum: u.factorNum, FactorDen: u.factorDen }),
      (r) => ({ code: String(r.Code), name: String(r.Name), dimension: r.Dimension as Unit['dimension'], scale: Number(r.Scale), factorNum: num(r.FactorNum), factorDen: num(r.FactorDen) }),
      (u) => u.code, 'Code',
      async (stored, next) => {
        // Quantities are stored as integers of the unit's scale (architecture.md §7): a new scale
        // would change what every stored quantity means.
        if (Number(stored.Scale) !== Number(next.Scale) && ((await usage()).units[String(stored.Code)] ?? 0) > 0) {
          throw refused('UnitScaleFixed', `${stored.Code} is in use; its decimal places cannot change`);
        }
      }),
    classes: reference<Class>('Class', 'Prefix',
      (c) => ({ Prefix: c.prefix, Name: c.name, Kind: c.kind, StorageNotes: c.storageNotes, DefaultLocationType: c.defaultLocationType }),
      (r) => ({ prefix: String(r.Prefix), name: String(r.Name), kind: r.Kind as Class['kind'], storageNotes: str(r.StorageNotes), defaultLocationType: str(r.DefaultLocationType) }),
      (c) => c.prefix, 'Prefix',
      async (stored, next) => {
        // Whether a family's combinations are parts, packages or one-offs is decided by its class.
        if (stored.Kind !== next.Kind && ((await usage()).classes[String(stored.Prefix)] ?? 0) > 0) {
          throw refused('ClassKindFixed', `class ${stored.Prefix} has families; its kind cannot change`);
        }
      }),
    operations: reference<Operation>('Operation', 'Code',
      (o) => ({ Code: o.code, Description: o.description }),
      (r) => ({ code: String(r.Code), description: String(r.Description) }),
      (o) => o.code, 'Code'),

    usage: () => op(() => usage()),

    families: {
      list: (filter: FamilyFilter = {}) => op(async () => {
        const where: string[] = [];
        const params: SqlValue[] = [];
        if (filter.classPrefix) { where.push('f.ClassPrefix = ?'); params.push(filter.classPrefix); }
        if (filter.status) { where.push('f.Status = ?'); params.push(filter.status); }
        const all = (await rows(db, `${FAMILY_SELECT}${where.length ? ` where ${where.join(' and ')}` : ''} order by f.Base`, params)).map(mapFamily);
        const text = filter.text?.trim().toLowerCase();
        return text ? all.filter((f) => f.base.toLowerCase().includes(text) || f.description.toLowerCase().includes(text)) : all;
      }),

      get: (idOrBase: string) => op(() => family(idOrBase)),

      create: (input: NewFamily, draft: Partial<DraftDefinition> = {}) => op(async (w) => {
        if (!isBase(input.base)) throw invalid(`not a family base: ${input.base}`);
        const id = newId();
        await inTxn(async () => {
          await w.insert('Family', { Id: id, Base: input.base, UnitCode: input.unitCode, Description: input.description, VersionStrict: input.versionStrict ?? false });
          await w.insert('Version', { FamilyId: id, Ver: 1 });
          await writeDefinition(w, id, 1, draft, false);
        });
        return family(id);
      }),

      update: (id: string, patch: FamilyPatch) => op(async (w) => {
        const fam = await family(id);
        if (patch.base !== undefined && !isBase(patch.base)) throw invalid(`not a family base: ${patch.base}`);
        const set: Row = {};
        for (const [k, col] of Object.entries(FAMILY_FIELDS)) {
          const v = patch[k as keyof FamilyPatch];
          if (v !== undefined) set[col] = v;
        }
        if (Object.keys(set).length) await inTxn(() => w.update('Family', set, { Id: fam.id }));
        return family(fam.id);
      }),

      remove: (id: string) => op(async () => {
        const fam = await family(id);
        if (fam.currentVer !== null) throw refused('FamilyDeleteUnreleased', `${fam.base} has been released; mark it obsolete instead`);
        // The draft and everything under it go by `on delete cascade` (catalog.qsql).
        await inTxn(() => run(db, 'delete from App.Family where Id = ?', [fam.id]));
      }),

      whereUsed: (base: string) => op(async () => {
        const found = await rows(db, `select b.FamilyId, f.Base, b.Ver, v.State, b.Pos, b.ChildParams, b.Qty
          from App.BomLine b join App.Family f on f.Id = b.FamilyId
          join App.Version v on v.FamilyId = b.FamilyId and v.Ver = b.Ver
          where b.Component = ? order by f.Base, b.Ver, b.Pos`, [base]);
        return found.map((r): WhereUsed => ({
          familyId: String(r.FamilyId), base: String(r.Base), ver: Number(r.Ver), state: r.State as WhereUsed['state'],
          pos: Number(r.Pos), childParams: json<string[]>(r.ChildParams), qty: String(r.Qty),
        }));
      }),
    },

    versions: {
      get: (familyId: string, ver?: number, o: { asOfMinor?: number } = {}) => op(async () => {
        const fam = await family(familyId);
        const v = ver ?? fam.currentVer ?? fam.draftVer;
        if (v === null) throw notFound(`${fam.base} has no versions`);
        return version(fam.id, v, o.asOfMinor);
      }),

      list: (familyId: string) => op(async () => {
        const fam = await family(familyId);
        const vs = await rows(db, `select v.Ver, v.State, v.ReleasedAt, v.ChangeSummary,
            (select max(m.Minor) from App.MinorRevision m where m.FamilyId = v.FamilyId and m.Ver = v.Ver) as Latest
          from App.Version v where v.FamilyId = ? order by v.Ver`, [fam.id]);
        return vs.map((r) => ({
          familyId: fam.id, ver: Number(r.Ver), state: r.State as Version['state'], releasedAt: str(r.ReleasedAt),
          changeSummary: str(r.ChangeSummary), latestMinor: num(r.Latest) ?? 0,
        }));
      }),

      startDraft: (familyId: string) => op(async (w) => {
        const fam = await family(familyId);
        if (fam.draftVer !== null) throw refused('VersionOneDraft', `${fam.base} already has draft ${fam.draftVer}`);
        const ver = (fam.currentVer ?? 0) + 1;
        const from = fam.currentVer === null ? null : await version(fam.id, fam.currentVer);
        // New ids for the copied documents; notes follow their documents.
        const docIds = new Map((from?.documents ?? []).map((d) => [d.id, newId()]));
        await inTxn(async () => {
          // TEMPORARY (STATUS.md, open items: "cascade leftovers"): a catalog written before
          // Optimystic 1.26 can hold rows under this number that a cascade failed to delete.
          // They belong to no version; clear them so the copy starts clean.
          await deleteContents(fam.id, ver);
          await w.insert('Version', { FamilyId: fam.id, Ver: ver });
          if (from) {
            await writeDefinition(w, fam.id, ver, {
              ...from, compatNotes: null,
              documents: from.documents.map((d) => ({ ...d, id: docIds.get(d.id)! })),
              notes: from.notes.map(({ id: _, ...n }) => ({ ...n, documentId: n.documentId === null ? null : docIds.get(n.documentId) ?? null })),
            }, false);
          }
        });
        return ver;
      }),

      saveDraft: (familyId: string, def: DraftDefinition) => op(async (w) => {
        const fam = await family(familyId);
        if (fam.draftVer === null) throw refused('NoDraft', `${fam.base} has no draft; start one first`);
        await inTxn(() => writeDefinition(w, fam.id, fam.draftVer!, def, true));
        return version(fam.id, fam.draftVer);
      }),

      discardDraft: (familyId: string) => op(async () => {
        const fam = await family(familyId);
        if (fam.draftVer === null) throw notFound(`${fam.base} has no draft`);
        await inTxn(() => run(db, `delete from App.Version where FamilyId = ? and Ver = ? and State = 'draft'`, [fam.id, fam.draftVer]));
      }),

      release: (familyId: string, r: Release) => op(async (w) => {
        const fam = await family(familyId);
        if (fam.draftVer === null) throw refused('NoDraft', `${fam.base} has no draft to release`);
        const ver = fam.draftVer;
        if (ver > 1 && typeof r.interchangeable !== 'boolean') throw invalid('say whether this version is interchangeable with the previous one');
        if (!r.changeSummary.trim()) throw invalid('a change summary is required');
        const draft = await version(fam.id, ver);
        await checkLines(fam, draft.lines);
        // TODO(bom-engine): validation explosions and PartVersion rows (product.md §4 steps 3–4).
        await inTxn(async () => {
          if (fam.currentVer !== null) await w.update('Version', { State: 'superseded' }, { FamilyId: fam.id, Ver: fam.currentVer });
          await w.update('Version', {
            State: 'released', ReleasedAt: w.now, ReleasedBy: w.actor, Interchangeable: ver === 1 ? true : r.interchangeable!,
            ChangeSummary: r.changeSummary, CompatNotes: r.compatNotes === undefined ? draft.compatNotes : r.compatNotes,
          }, { FamilyId: fam.id, Ver: ver });
          await w.update('Family', { CurrentVer: ver }, { Id: fam.id });
        });
        return version(fam.id, ver);
      }),

      retire: (familyId: string, ver: number) => op(async (w) => {
        const fam = await family(familyId);
        if (ver === fam.currentVer) throw refused('RetireCurrent', `${fam.base}.${ver} is current; release a new version or mark the family obsolete`);
        await inTxn(() => w.update('Version', { State: 'retired' }, { FamilyId: fam.id, Ver: ver }));
      }),

      revise: (familyId: string, ver: number, change: MinorChange) => op(async (w) => {
        const fam = await family(familyId);
        const before = await version(fam.id, ver);
        if (before.state === 'draft') throw refused('MinorOfReleased', 'a draft is edited directly, without minor revisions');
        if (!change.summary.trim()) throw invalid('a summary is required');
        const n = change.notes ?? {};
        const d = change.documents ?? {};
        const count = (n.add?.length ?? 0) + (n.replace?.length ?? 0) + (n.remove?.length ?? 0)
          + (d.add?.length ?? 0) + (d.replace?.length ?? 0) + (d.remove?.length ?? 0) + (change.processTimes?.length ?? 0);
        if (count === 0) throw invalid('a minor revision must change something');
        const openNotes = new Set(before.notes.map((x) => x.id));
        const openDocs = new Set(before.documents.map((x) => x.id));
        const minor = before.latestMinor + 1;
        const key = { FamilyId: fam.id, Ver: ver };
        await inTxn(async () => {
          await w.insert('MinorRevision', { ...key, Minor: minor, Summary: change.summary });
          const close = async (table: string, id: string, open: Set<string>) => {
            if (!open.has(id)) throw notFound(`${table.toLowerCase()} ${id} is not current in ${fam.base}.${ver}`);
            await w.update(table, { ToMinor: minor }, { Id: id });
          };
          for (const id of d.remove ?? []) await close('Document', id, openDocs);
          for (const x of d.replace ?? []) {
            await close('Document', x.id, openDocs);
            await w.insert('Document', { ...key, ...documentRow(x), Id: newId(), FromMinor: minor });
          }
          for (const x of d.add ?? []) await w.insert('Document', { ...key, ...documentRow(x), Id: x.id ?? newId(), FromMinor: minor });
          for (const id of n.remove ?? []) await close('Note', id, openNotes);
          for (const x of n.replace ?? []) {
            await close('Note', x.id, openNotes);
            await w.insert('Note', { ...key, ...noteRow(x), Id: newId(), FromMinor: minor });
          }
          for (const x of n.add ?? []) await w.insert('Note', { ...key, ...noteRow(x), Id: x.id ?? newId(), FromMinor: minor });
          for (const t of change.processTimes ?? []) {
            const set: Row = {};
            if (t.setupTime !== undefined) set.SetupTime = t.setupTime;
            if (t.laborPerUnit !== undefined) set.LaborPerUnit = t.laborPerUnit;
            if (t.machinePerUnit !== undefined) set.MachinePerUnit = t.machinePerUnit;
            if (!before.processes.some((p) => p.idx === t.idx)) throw notFound(`${fam.base}.${ver} has no process ${t.idx}`);
            await w.update('Process', set, { ...key, Idx: t.idx });
          }
        });
        return minor;
      }),
    },

    parts: {
      get: (ref: PartRef) => op(() => partBy(ref)),

      list: (filter: { familyId?: string; status?: Part['status'] } = {}) => op(async () => {
        const where: string[] = [];
        const params: SqlValue[] = [];
        if (filter.familyId) { where.push('p.FamilyId = ?'); params.push(filter.familyId); }
        if (filter.status) { where.push('p.Status = ?'); params.push(filter.status); }
        return (await rows(db, `${PART_SELECT}${where.length ? ` where ${where.join(' and ')}` : ''} order by f.Base, p.Id`, params)).map(mapPart);
      }),

      canonical: (familyIdOrBase: string, params: string[]) => op(async () => (await canonical(await family(familyIdOrBase), params)) as string[]),

      create: (familyIdOrBase: string, params: string[], fields: Partial<PartFields> = {}) => op(async (w) => {
        const fam = await family(familyIdOrBase);
        const values = (await canonical(fam, params)) as string[];
        const [taken] = await rows(db, `${PART_SELECT} where p.FamilyId = ? and p.Params = ?`, [fam.id, JSON.stringify(values)]);
        if (taken) throw refused('PartCombination', `${formatPartname(fam.base, values)} is already a part`);
        const id = newId();
        await inTxn(() => w.insert('Part', { Id: id, FamilyId: fam.id, Params: JSON.stringify(values), ...partFieldRow(fields) }));
        return partBy({ id });
      }),

      number: (ref: PartRef) => op(async (w) => {
        const part = await partBy(ref);
        if (part.pnum !== null) return part;
        // Highest plus one. A device that took the same number first makes this insert fail
        // (on a strand, when the cohort judges it); then try the next one.
        for (let attempt = 1; ; attempt++) {
          try {
            await inTxn(async () => {
              const [r] = await rows(db, 'select max(Pnum) as M from App.PartNumber');
              await w.insert('PartNumber', { Pnum: (num(r?.M) ?? 0) + 1, PartId: part.id });
            });
            break;
          } catch (err) {
            const now = await partBy({ id: part.id });
            if (now.pnum !== null) return now; // another device numbered this part
            if (toCoreError(err).kind !== 'duplicate' || attempt >= NUMBER_ATTEMPTS) throw err;
          }
        }
        return partBy({ id: part.id });
      }),

      update: (id: string, patch: Partial<PartFields>) => op(async (w) => {
        const part = await partBy({ id });
        const set = partFieldRow(patch);
        if (Object.keys(set).length) await inTxn(() => w.update('Part', set, { Id: part.id }));
        return partBy({ id });
      }),
    },

    packages: {
      list: (familyId?: string) => op(async () => {
        const found = await rows(db, `select * from App.StandardPackage${familyId ? ' where FamilyId = ?' : ''} order by FamilyId, Name`, familyId ? [familyId] : []);
        return found.map(mapPackage);
      }),

      create: (familyIdOrBase: string, name: string, params: Array<string | null>, description: string | null = null) => op(async (w) => {
        const fam = await family(familyIdOrBase);
        const values = await canonical(fam, params, true);
        const id = newId();
        await inTxn(() => w.insert('StandardPackage', { Id: id, FamilyId: fam.id, Name: name, Params: JSON.stringify(values), Description: description }));
        const [r] = await rows(db, 'select * from App.StandardPackage where Id = ?', [id]);
        return mapPackage(r!);
      }),

      remove: (id: string) => op(async () => {
        const [r] = await rows(db, 'select 1 as X from App.StandardPackage where Id = ?', [id]);
        if (!r) throw notFound(`no standard package ${id}`);
        await inTxn(() => run(db, 'delete from App.StandardPackage where Id = ?', [id]));
      }),
    },
  };
}

function mapPackage(r: Row): StandardPackage {
  return { id: String(r.Id), familyId: String(r.FamilyId), name: String(r.Name), params: json<Array<string | null>>(r.Params), description: str(r.Description) };
}

function partFieldRow(fields: Partial<PartFields>): Row {
  const out: Row = {};
  for (const [k, col] of Object.entries(PART_FIELDS)) {
    const v = fields[k as keyof PartFields];
    if (v !== undefined) out[col] = v;
  }
  return out;
}

const documentRow = (d: DocumentDef): Row => ({ Kind: d.kind, Name: d.name, ContentRef: d.contentRef });
const processRow = (p: ProcessDef): Row => ({
  Idx: p.idx, OperationCode: p.operationCode, NextIdx: p.nextIdx, SetupTime: p.setupTime,
  LaborPerUnit: p.laborPerUnit, MachinePerUnit: p.machinePerUnit, Description: p.description,
});
const lineRow = (l: BomLineDef): Row => ({
  Pos: l.pos, Component: l.component, ChildParams: JSON.stringify(l.childParams), Qty: l.qty, WhenExpr: l.when,
  Script: l.script, ProcessIdx: l.processIdx, ChildVer: l.childVer, Comment: l.comment,
});
const noteRow = (n: NoteDef): Row => ({
  ProcessIdx: n.processIdx, Seq: n.seq, Type: n.type, Body: n.body, DocumentId: n.documentId,
  Measure: n.measure === null ? null : JSON.stringify(n.measure),
});

/** Writes with the mutation context (catalog.qsql, "Audit"): every insert and update says who and when. */
class Writer {
  constructor(private readonly db: Database, readonly actor: string, readonly now: string) {}

  async insert(table: string, values: Row): Promise<void> {
    const cols = Object.keys(values);
    await run(this.db,
      `insert into App.${table} (${cols.join(', ')}) with context Actor = :ctx_actor, Now = :ctx_now values (${cols.map((c) => `:v_${c}`).join(', ')})`,
      { ctx_actor: this.actor, ctx_now: this.now, ...prefixed('v_', values) });
  }

  async update(table: string, set: Row, where: Row): Promise<void> {
    const all = { ...set, UpdatedAt: this.now, UpdatedBy: this.actor };
    await run(this.db,
      `update App.${table} with context Actor = :ctx_actor, Now = :ctx_now
         set ${Object.keys(all).map((c) => `${c} = :s_${c}`).join(', ')}
         where ${Object.keys(where).map((c) => `${c} = :w_${c}`).join(' and ')}`,
      { ctx_actor: this.actor, ctx_now: this.now, ...prefixed('s_', all), ...prefixed('w_', where) });
  }
}

function prefixed(prefix: string, values: Row): Row {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [prefix + k, v]));
}
