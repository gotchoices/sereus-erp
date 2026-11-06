/**
 * A party's machine for tests: a real cadre-core node in this process, with in-memory
 * block storage, listening on loopback WebSockets. Modeled on
 * ser/chat/packages/core/src/testing/node-host.ts.
 */
import { CadreNode, InMemoryKeyStore } from '@serfab/cadre-core';
import { runOwnerGenesis } from '@serfab/cadre-core/edge-node';
import { MemoryRawStorage } from '@optimystic/db-p2p';
import { generateKeyPair } from '@libp2p/crypto/keys';
import { webSockets } from '@libp2p/websockets';

export interface TestNode {
  tag: string;
  node: CadreNode;
  stop(): Promise<void>;
}

/** Start one party with a single machine, enrolled as the party's owner. */
export async function startTestNode(tag: string): Promise<TestNode> {
  const scopes = new Map<string, MemoryRawStorage>();
  const node = new CadreNode({
    privateKey: await generateKeyPair('Ed25519'),
    controlNetwork: { partyId: `${tag}-${crypto.randomUUID()}`, bootstrapNodes: [] },
    profile: 'transaction',
    // Every strand, whatever its sApp: this machine runs several apps' strands.
    strandFilter: { mode: 'all' },
    storage: {
      provider: (scope: string) => {
        let storage = scopes.get(scope);
        if (!storage) scopes.set(scope, (storage = new MemoryRawStorage()));
        return storage;
      },
    },
    network: {
      transports: [webSockets()] as never,
      listenAddrs: ['/ip4/127.0.0.1/tcp/0/ws'],
      relayAddrs: [],
      requireRelay: false,
      connectionGater: { denyDialMultiaddr: () => false },
    },
    // Test sApps are unsigned (see ser/chat protocol/sapp.ts for why signing needs a key id).
    requireSignedSchemas: false,
  });
  await node.start();
  const genesis = await runOwnerGenesis(node, { keyStore: new InMemoryKeyStore(), label: tag });
  if (genesis !== 'enrolled') throw new Error(`${tag}: owner genesis did not enrol (${String(genesis)})`);
  await until(() => node.getMultiaddrs().length > 0, `${tag} reachable`);
  return { tag, node, stop: () => node.stop() };
}

/** Wait until `check` holds, polling; throws with `what` after `ms`. */
export async function until(check: () => boolean | Promise<boolean>, what: string, ms = 60_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise<void>((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${what}`);
}
