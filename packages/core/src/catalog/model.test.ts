import { openMemoryCatalog } from './open.js';
import { describeCatalogContract } from '../testing/catalog-contract.js';

describeCatalogContract('in memory', async () => ({ model: await openMemoryCatalog({ actor: 'tester' }), actor: 'tester' }));
