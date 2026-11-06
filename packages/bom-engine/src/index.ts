import type { CatalogView, ExplodeRequest, ExplosionResult, Providers } from './types.js';

export type * from './types.js';

/** Explode a family or part into its bill of materials (docs/specs/bom-engine.md §3). */
export function explode(
  _request: ExplodeRequest,
  _catalog: CatalogView,
  _providers: Providers = {},
): ExplosionResult {
  throw new Error('explode: not implemented yet (engine prototype, docs/STATUS.md)');
}
