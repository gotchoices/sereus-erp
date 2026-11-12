/**
 * `CatalogModel`: everything an app can read and do in the catalog strand, behind one
 * interface (design/specs/domain/product.md). There is one implementation, written against the
 * strand's Quereus `Database` (`createCatalogModel`). It runs on a real strand
 * (`openStrandCatalog`) or on a local in-memory database built from the same schema
 * (`openMemoryCatalog`), for UI work, demos and tests. Both enforce exactly the rules in
 * catalog.qsql, plus the few checked here in code.
 *
 * Every operation returns `Result<T>` (../result.ts). A refused write names its rule.
 *
 * The write side follows product.md: create a family, edit its draft, release, retire, record
 * minor revisions, approve parts. The read side is kept small on purpose, until UI stories say
 * which queries the screens need (STATUS.md, step C).
 */
import type { Result } from '../result.js';

// ── Reference data ─────────────────────────────────────────────────────────────

export type Dimension = 'count' | 'length' | 'area' | 'volume' | 'mass' | 'time';
export type ClassKind = 'part' | 'package' | 'custom';

export interface Unit {
  code: string;
  name: string;
  dimension: Dimension;
  /** Decimal places stored (architecture.md §7). */
  scale: number;
  /** Exact factor to the dimension's base unit, factorNum / factorDen; both null for none. */
  factorNum: number | null;
  factorDen: number | null;
}

export interface Class {
  prefix: string;
  name: string;
  kind: ClassKind;
  storageNotes: string | null;
  defaultLocationType: string | null;
}

export interface Operation {
  code: string;
  description: string;
}

/** Counts of the records that name each reference entry, by its key. */
export interface ReferenceUsage {
  /** Families counted in the unit, plus parameters measured in it. */
  units: Record<string, number>;
  /** Families in the class. */
  classes: Record<string, number>;
  /** Routing steps using the operation, in any version. */
  operations: Record<string, number>;
}

// ── Families and versions ──────────────────────────────────────────────────────

export type FamilyStatus = 'active' | 'restricted' | 'obsolete';
export type VersionState = 'draft' | 'released' | 'superseded' | 'retired';
export type ExplodeDefault = 'none' | 'to_part' | 'one_level' | 'full';
export type ParameterType = 'num' | 'str' | 'enum';
export type NoteType = 'step' | 'fig' | 'qc';

export interface Family {
  id: string;
  base: string;
  classPrefix: string;
  unitCode: string;
  description: string;
  status: FamilyStatus;
  /** The released version, or null before the first release. */
  currentVer: number | null;
  /** The version in state draft, or null. Derived, not stored (product.md §2). */
  draftVer: number | null;
  versionStrict: boolean;
}

export interface NewFamily {
  base: string;
  unitCode: string;
  description: string;
  versionStrict?: boolean;
}

export interface FamilyPatch {
  /** Only before the first release (FamilyBaseFixed). */
  base?: string;
  unitCode?: string;
  description?: string;
  status?: FamilyStatus;
  versionStrict?: boolean;
}

export interface FamilyFilter {
  classPrefix?: string;
  status?: FamilyStatus;
  /** Case-insensitive match on base or description. */
  text?: string;
}

export interface AllowedValue {
  value: string;
  description: string;
}

export interface ParameterDef {
  pos: number;
  var: string;
  type: ParameterType;
  unitCode: string | null;
  description: string;
  defaultValue: string | null;
  min: number | null;
  max: number | null;
  /** For `enum` only. */
  allowed: AllowedValue[];
}

export interface BomLineDef {
  pos: number;
  /** The child family's base. */
  component: string;
  /** One expression per child parameter, in the child's order. */
  childParams: string[];
  qty: string;
  when: string | null;
  script: string | null;
  processIdx: number | null;
  childVer: number | null;
  comment: string | null;
}

export interface ProcessDef {
  idx: number;
  operationCode: string;
  nextIdx: number | null;
  setupTime: string | null;
  laborPerUnit: string | null;
  machinePerUnit: string | null;
  description: string | null;
}

export type Measure =
  | { name: string; units: string; nominal: number | null; min: number | null; max: number | null }
  | { name: string; passfail: true };

export interface NoteDef {
  /** Assigned when omitted. */
  id?: string;
  processIdx: number;
  seq: number;
  type: NoteType;
  body: string;
  documentId: string | null;
  measure: Measure | null;
}

export interface DocumentDef {
  /** Assigned when omitted. Give one when a note refers to the document. */
  id?: string;
  kind: string;
  name: string;
  contentRef: string;
}

/** The editable definition of a draft (product.md §4 step 2). */
export interface DraftDefinition {
  spec: string | null;
  familyScript: string | null;
  priceFormula: string | null;
  explodeDefault: ExplodeDefault;
  compatNotes: string | null;
  parameters: ParameterDef[];
  lines: BomLineDef[];
  processes: ProcessDef[];
  notes: NoteDef[];
  documents: DocumentDef[];
}

export interface MinorRevisionInfo {
  minor: number;
  summary: string;
  at: string;
  by: string;
}

export interface Version extends DraftDefinition {
  familyId: string;
  ver: number;
  state: VersionState;
  releasedAt: string | null;
  releasedBy: string | null;
  interchangeable: boolean | null;
  changeSummary: string | null;
  /** The minor revision the notes and documents are shown as of. */
  asOfMinor: number;
  /** The latest minor revision (0 = the release itself). */
  latestMinor: number;
  minorRevisions: MinorRevisionInfo[];
  /** Ids of notes and documents are those of the rows valid as of `asOfMinor`. */
  notes: Array<NoteDef & { id: string }>;
  documents: Array<DocumentDef & { id: string }>;
}

export interface Release {
  /** Required from version 2 on. Version 1 has no predecessor and is recorded as true. */
  interchangeable?: boolean;
  changeSummary: string;
  compatNotes?: string | null;
}

/** A change to a released version's documentation (product.md §5). */
export interface MinorChange {
  summary: string;
  notes?: {
    add?: NoteDef[];
    /** Each replaces the note with this id; the old text stays valid for earlier minor revisions. */
    replace?: Array<NoteDef & { id: string }>;
    remove?: string[];
  };
  documents?: {
    add?: DocumentDef[];
    replace?: Array<DocumentDef & { id: string }>;
    remove?: string[];
  };
  /** New times for routing steps. The old times are not kept. */
  processTimes?: Array<{ idx: number; setupTime?: string | null; laborPerUnit?: string | null; machinePerUnit?: string | null }>;
}

export interface WhereUsed {
  familyId: string;
  base: string;
  ver: number;
  state: VersionState;
  pos: number;
  childParams: string[];
  qty: string;
}

// ── Parts and packages ─────────────────────────────────────────────────────────

export type PartStatus = 'proposed' | 'active' | 'restricted' | 'obsolete';
export type Tracking = 'none' | 'run' | 'serial';

export interface PartFields {
  status: PartStatus;
  minLevel: number | null;
  targetLevel: number | null;
  minBuy: number | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  stackFactor: number | null;
  tracking: Tracking;
  shelfLifeDays: number | null;
  comment: string | null;
}

export interface Part extends PartFields {
  /** What other modules reference. */
  id: string;
  /** Issued when the part first needs one (`parts.number`); null until then (product.md §3). */
  pnum: number | null;
  familyId: string;
  base: string;
  /** Canonical values, in parameter order. */
  params: string[];
  /** `base(params)`. */
  partname: string;
}

export type PartRef = { id: string } | { pnum: number } | { partname: string };

export interface StandardPackage {
  id: string;
  familyId: string;
  name: string;
  /** Null leaves a value open, to be filled at order time. */
  params: Array<string | null>;
  description: string | null;
}

// ── The model ──────────────────────────────────────────────────────────────────

export interface CatalogModel {
  units: {
    list(): Promise<Result<Unit[]>>;
    /** Insert or update by code. */
    put(unit: Unit): Promise<Result<Unit>>;
  };
  classes: {
    list(): Promise<Result<Class[]>>;
    put(cls: Class): Promise<Result<Class>>;
  };
  operations: {
    list(): Promise<Result<Operation[]>>;
    put(op: Operation): Promise<Result<Operation>>;
  };
  /** How many records name each unit, class and operation. */
  usage(): Promise<Result<ReferenceUsage>>;

  families: {
    list(filter?: FamilyFilter): Promise<Result<Family[]>>;
    /** By id or base. */
    get(idOrBase: string): Promise<Result<Family>>;
    /** A new family with an empty draft version 1 (or the given definition). */
    create(input: NewFamily, draft?: Partial<DraftDefinition>): Promise<Result<Family>>;
    update(id: string, patch: FamilyPatch): Promise<Result<Family>>;
    /** Only a family never released (FamilyDeleteUnreleased). */
    remove(id: string): Promise<Result<void>>;
    /** Lines in any version that use this family as a component. */
    whereUsed(base: string): Promise<Result<WhereUsed[]>>;
  };

  versions: {
    /** A version's full definition. Defaults: the current version (else the draft), notes as of its latest minor revision. */
    get(familyId: string, ver?: number, opts?: { asOfMinor?: number }): Promise<Result<Version>>;
    list(familyId: string): Promise<Result<Array<Pick<Version, 'familyId' | 'ver' | 'state' | 'releasedAt' | 'changeSummary' | 'latestMinor'>>>>;
    /** Start the next draft as a copy of the current version (product.md §4 step 1). Returns its number. */
    startDraft(familyId: string): Promise<Result<number>>;
    /** Replace the draft's whole definition. */
    saveDraft(familyId: string, def: DraftDefinition): Promise<Result<Version>>;
    discardDraft(familyId: string): Promise<Result<void>>;
    /** Release the draft: it becomes current, the previous version superseded (product.md §4 step 4). */
    release(familyId: string, release: Release): Promise<Result<Version>>;
    retire(familyId: string, ver: number): Promise<Result<void>>;
    /** Record a minor revision of a released version (product.md §5). Returns its number. */
    revise(familyId: string, ver: number, change: MinorChange): Promise<Result<number>>;
  };

  parts: {
    get(ref: PartRef): Promise<Result<Part>>;
    list(filter?: { familyId?: string; status?: PartStatus }): Promise<Result<Part[]>>;
    /**
     * Approve a combination as a part, without a number. Values are checked against the
     * family's current version and stored canonically. Refused (`PartCombination`) when the
     * combination is already a part.
     */
    create(familyIdOrBase: string, params: string[], fields?: Partial<PartFields>): Promise<Result<Part>>;
    /**
     * Give a part the next free part number, or return the one it has. When another device
     * takes the same number first, it moves on to the next one.
     */
    number(ref: PartRef): Promise<Result<Part>>;
    update(id: string, patch: Partial<PartFields>): Promise<Result<Part>>;
    /** Check and canonicalize values against a family's current version, without writing. */
    canonical(familyIdOrBase: string, params: string[]): Promise<Result<string[]>>;
  };

  packages: {
    list(familyId?: string): Promise<Result<StandardPackage[]>>;
    create(familyIdOrBase: string, name: string, params: Array<string | null>, description?: string | null): Promise<Result<StandardPackage>>;
    remove(id: string): Promise<Result<void>>;
  };
}
