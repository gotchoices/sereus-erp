/**
 * Opening the catalog: on a strand of a running Sereus node, or locally in memory.
 *
 * Only types are imported from cadre-core, so an app that opens the in-memory catalog (a
 * design build, a demo, a test) does not load Sereus at all.
 */
import type { CadreNode } from '@serfab/cadre-core';
import { openMemoryDb } from '../sql.js';
import type { CatalogModel } from './model.js';
import { catalogSAppConfig, CATALOG_SCHEMA } from './sapp.js';
import { createCatalogModel, type CatalogModelOptions } from './sql-model.js';

/**
 * A catalog in a local in-memory database, built from the same schema as the strand. It
 * enforces the same rules, keeps nothing after the process ends, and needs no node.
 */
export async function openMemoryCatalog(opts: Partial<CatalogModelOptions> = {}): Promise<CatalogModel> {
  return createCatalogModel(await openMemoryDb(CATALOG_SCHEMA), { actor: opts.actor ?? 'local', ...(opts.now ? { now: opts.now } : {}) });
}

/**
 * The catalog on a strand this node already runs. The writer recorded on each row is this
 * node's peer ID unless `actor` is given.
 */
export function openStrandCatalog(node: CadreNode, strandId: string, opts: Partial<CatalogModelOptions> = {}): CatalogModel {
  const instance = node.getStrands().get(strandId);
  const db = instance?.database?.getDatabase();
  if (!db) throw new Error(`strand ${strandId} is not running on this node`);
  const actor = opts.actor ?? node.peerId?.toString();
  if (!actor) throw new Error('the node has no peer ID yet; start it first');
  return createCatalogModel(db, { actor, ...(opts.now ? { now: opts.now } : {}) });
}

/** Found a new catalog strand on this node, closed to non-members. Returns its ID. */
export async function foundCatalogStrand(node: CadreNode): Promise<string> {
  const { generateStrandMemberKey } = await import('@serfab/cadre-core');
  const { instance } = await node.foundStrand({
    strandId: crypto.randomUUID(), type: 'c', memberPrivateKey: await generateStrandMemberKey(), sAppConfig: catalogSAppConfig(),
  });
  return instance.strandId;
}
