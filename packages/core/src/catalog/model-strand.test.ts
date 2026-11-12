/** The catalog contract on a real strand: Sereus storage, the same schema and model. */
import { foundCatalogStrand, openStrandCatalog } from './open.js';
import { describeCatalogContract } from '../testing/catalog-contract.js';
import { startTestNode } from '../testing/node-host.js';

describeCatalogContract('on a strand', async () => {
  const us = await startTestNode('catalog-model');
  const strandId = await foundCatalogStrand(us.node);
  return { model: openStrandCatalog(us.node, strandId), actor: us.node.peerId!.toString(), teardown: () => us.stop() };
});
