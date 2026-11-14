/**
 * A folder the web app made before @wyatt/node (only `party-id`, catalog sApp 0.1.0) opens as a
 * founded installation, and its catalog takes the 0.2.0 schema (About, Machine) in place.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { webSockets } from '@libp2p/websockets';
import { FileRawStorage } from '@optimystic/db-p2p-storage-fs';
import { CadreNode, DEFAULT_IDENTITY_KEY_ID, generateStrandMemberKey, type SAppConfig } from '@serfab/cadre-core';
import { runOwnerGenesis } from '@serfab/cadre-core/edge-node';
import { FileBootstrapPeerStore } from '@serfab/cadre-core/bootstrap-peer-store-file';
import { FileEnrolledMachineStore } from '@serfab/cadre-core/enrolled-machine-store-file';
import { FileKeyStore } from '@serfab/cadre-core/key-store-file';
import { FileStrandNetworkStateStore } from '@serfab/cadre-core/strand-network-state-file';
import { FileTrustedOwnerStore } from '@serfab/cadre-core/trusted-owner-store-file';
import { CATALOG_SAPP_ID, createCatalogModel } from '@wyatt/core/catalog';
import { Installation } from './installation.js';

const homes: string[] = [];
afterAll(async () => { for (const h of homes) await rm(h, { recursive: true, force: true }); });

it('opens a folder from before installation.json and upgrades its catalog', async () => {
  const home = await mkdtemp(join(tmpdir(), 'wyatt-legacy-'));
  homes.push(home);
  const partyId = `wyatt-${randomUUID()}`;
  await writeFile(join(home, 'party-id'), partyId + '\n');
  const keyStore = new FileKeyStore(join(home, 'keys'));
  const storages: FileRawStorage[] = [];
  const node = new CadreNode({
    keyStore, identityKeyId: DEFAULT_IDENTITY_KEY_ID, controlNetwork: { partyId, bootstrapNodes: [] }, profile: 'transaction',
    storage: { provider: (scope: string) => { const s = new FileRawStorage(join(home, 'blocks', scope)); storages.push(s); return s; } },
    network: { transports: [webSockets()] as never, listenAddrs: [], relayAddrs: [], requireRelay: false, connectionGater: { denyDialMultiaddr: () => false } },
    strandFilter: { mode: 'sAppId', sAppId: CATALOG_SAPP_ID }, hibernation: { enabled: false }, requireSignedSchemas: false,
    trustedOwners: { store: await FileTrustedOwnerStore.open(join(home, 'node'), partyId) },
    bootstrapPeers: { store: await FileBootstrapPeerStore.open(join(home, 'node'), partyId) },
    enrolledMachines: { store: await FileEnrolledMachineStore.open(join(home, 'node'), partyId) },
    strandNetworkState: { store: await FileStrandNetworkStateStore.open(join(home, 'node'), partyId) },
  });
  await node.start();
  expect(await runOwnerGenesis(node, { keyStore, label: 'web' })).toBe('enrolled');
  const oldSchema = await readFile(new URL('./testing/catalog-0.1.0.qsql', import.meta.url), 'utf8');
  const sApp = { id: CATALOG_SAPP_ID, version: '0.1.0', schema: oldSchema, signature: '', latencyHint: 'interactive' } as SAppConfig;
  const { instance } = await node.foundStrand({ strandId: randomUUID(), type: 'c', memberPrivateKey: await generateStrandMemberKey(), sAppConfig: sApp });
  const old = createCatalogModel(instance.database!.getDatabase(), { actor: node.peerId!.toString() });
  expect((await old.units.put({ code: 'ea', name: 'each', dimension: 'count', scale: 0, factorNum: 1, factorDen: 1 })).ok).toBe(true);
  await node.stop();
  await Promise.all(storages.map((s) => s.close()));

  const inst = await Installation.open({ home, network: { listen: ['/ip4/127.0.0.1/tcp/0'], announce: [], relays: [], relayServer: false } });
  try {
    const s = await inst.status();
    expect(s).toMatchObject({ phase: 'running', origin: 'founded', owner: true });
    expect(s.current).toBe(instance.strandId);
    const cat = await inst.catalog();
    const units = await cat.units.list();
    expect(units.ok && units.value.map((u) => u.code)).toEqual(['ea']);
    expect((await cat.about.set({ name: 'Catalog', purpose: '', company: 'Old' })).ok).toBe(true);
    expect((await inst.status()).strands[0]?.name).toBe('Catalog');
  } finally {
    await inst.stop();
  }
});
