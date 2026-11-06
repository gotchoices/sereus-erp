// The modules of WyattERP and the strands they live in (docs/specs/architecture.md §2).
// Each module's strand carries one sApp schema. Bonum's strand carries Bonum's sApp, which
// WyattERP uses through Bonum's own control library rather than its own.

export type ModuleKey = 'catalog' | 'parties' | 'ops' | 'ap' | 'ar' | 'books' | 'vendor' | 'shop';

export interface ModuleInfo {
  key: ModuleKey;
  title: string;
  /** Strand name, or a pattern for one strand per party. */
  strand: string;
  /** Which project's sApp defines the strand's schema. */
  sApp: 'wyatt' | 'bonum';
  /** Part of the starting configuration (architecture.md §2). */
  initial: boolean;
}

export const MODULES: readonly ModuleInfo[] = [
  { key: 'catalog', title: 'Catalog', strand: 'catalog', sApp: 'wyatt', initial: true },
  { key: 'parties', title: 'Parties', strand: 'parties', sApp: 'wyatt', initial: true },
  { key: 'ops', title: 'Operations', strand: 'ops', sApp: 'wyatt', initial: true },
  { key: 'books', title: 'Books (Bonum)', strand: 'bonum', sApp: 'bonum', initial: true },
  { key: 'ap', title: 'Payables', strand: 'ap', sApp: 'wyatt', initial: false },
  { key: 'ar', title: 'Receivables', strand: 'ar', sApp: 'wyatt', initial: false },
  { key: 'vendor', title: 'Vendor link', strand: 'vendor:<party>', sApp: 'wyatt', initial: false },
  { key: 'shop', title: 'Shop link', strand: 'shop:<party>', sApp: 'wyatt', initial: false },
];

export function moduleInfo(key: ModuleKey): ModuleInfo {
  const m = MODULES.find((x) => x.key === key);
  if (!m) throw new Error(`unknown module: ${key}`);
  return m;
}
