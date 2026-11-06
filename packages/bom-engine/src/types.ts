// Interface of the parametric BOM engine (docs/specs/bom-engine.md §2). The engine is pure: it
// reads only the catalog view and providers it is handed, and returns a result.

export type Depth = 'full' | 'to_part' | 'one_level' | 'root_only';
export type Pricing = 'none' | 'history' | 'best' | 'worst' | 'provider';
export type VersionPolicy = 'current' | 'draft' | { as_of: string };

export interface ExplodeRequest {
  /** Family base with parameter values (`a:chan(1200,4)`), or a part number. Either may carry `.N`. */
  root: string;
  /** Quantity of the root (default 1). */
  qty?: number;
  depth?: Depth;
  pricing?: Pricing;
  version_policy?: VersionPolicy;
  /** Overrides of the default limits (§11). */
  limits?: Partial<Limits>;
}

/** Defaults are set by §11; the fields are filled in with the prototype. */
export interface Limits {
  maxDepth: number;
  maxNodes: number;
}

/** Read-only, synchronous view of the catalog (§2). Shape to be defined with the prototype. */
export interface CatalogView {}

/** Optional synchronous callbacks for data the engine does not own (§9). */
export interface Providers {}

/** Explosion result (§10). Shape to be defined with the prototype. */
export interface ExplosionResult {}
