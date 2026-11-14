import type { SAppConfig } from '@serfab/cadre-core';
import { CATALOG_SCHEMA } from '../generated/schemas.js';

export { CATALOG_SCHEMA };

/** The catalog strand's sApp. Unsigned for now (see docs/sereus-requirements.md §2). */
export const CATALOG_SAPP_ID = 'org.wyatterp.catalog';
export const CATALOG_SAPP_VERSION = '0.2.0';

export function catalogSAppConfig(): SAppConfig {
  return {
    id: CATALOG_SAPP_ID,
    version: CATALOG_SAPP_VERSION,
    schema: CATALOG_SCHEMA,
    signature: '',
    latencyHint: 'interactive',
  } as SAppConfig;
}
