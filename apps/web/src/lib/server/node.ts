/**
 * This machine's Sereus node, run inside the web server process (design/generated/web/screens/
 * FamilyList.md, "Data layer"). Built as taleus builds its Node host
 * (ser/taleus/packages/taleus-sereus/src/node/host.ts): file-backed stores in one folder, the
 * transaction profile, and this machine enrolled as its party's owner on every start.
 *
 * One node per process. The dev server re-imports modules on change, so the running node is
 * kept on globalThis and reused.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { webSockets } from '@libp2p/websockets';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { FileRawStorage } from '@optimystic/db-p2p-storage-fs';
import {
	CadreNode, createOwnerKey, DEFAULT_IDENTITY_KEY_ID, loadOwnerSigner, StrandAwaitingFirstSyncError,
	type KeyStore, type StrandInstance, type StrandRow,
} from '@serfab/cadre-core';
import { FileBootstrapPeerStore } from '@serfab/cadre-core/bootstrap-peer-store-file';
import { FileEnrolledMachineStore } from '@serfab/cadre-core/enrolled-machine-store-file';
import { FileKeyStore } from '@serfab/cadre-core/key-store-file';
import { FileStrandNetworkStateStore } from '@serfab/cadre-core/strand-network-state-file';
import { FileTrustedOwnerStore } from '@serfab/cadre-core/trusted-owner-store-file';
import {
	CATALOG_SAPP_ID, catalogSAppConfig, foundCatalogStrand, loadSampleCatalog, openStrandCatalog, type CatalogModel,
} from '@wyatt/core/catalog';

/** How long to wait for the node to offer an existing catalog strand before founding one. */
const DISCOVERY_GRACE_MS = 3_000;
const FIRST_SYNC_PATIENCE_MS = 240_000;

export interface RunningNode {
	node: CadreNode;
	catalog: CatalogModel;
	catalogStrandId: string;
	home: string;
	stop(): Promise<void>;
}

interface Folder {
	root: string;
	keys: string;
	blocks: string;
	node: string;
}

const KEY = Symbol.for('wyatt.web.node');
type Holder = { [KEY]?: Promise<RunningNode> };

/** The running node, started on first use. */
export function runningNode(): Promise<RunningNode> {
	const holder = globalThis as Holder;
	holder[KEY] ??= start().catch((err) => {
		delete holder[KEY];
		throw err;
	});
	return holder[KEY];
}

async function start(): Promise<RunningNode> {
	const home = resolve(process.env.WYATT_HOME ?? '.wyatt');
	const dirs: Folder = { root: home, keys: join(home, 'keys'), blocks: join(home, 'blocks'), node: join(home, 'node') };
	for (const d of [dirs.keys, dirs.blocks, dirs.node]) await mkdir(d, { recursive: true });
	const partyId = await partyIdIn(home);

	const keyStore = new FileKeyStore(dirs.keys);
	const storages: FileRawStorage[] = [];
	const node = new CadreNode({
		keyStore,
		identityKeyId: DEFAULT_IDENTITY_KEY_ID,
		controlNetwork: { partyId, bootstrapNodes: [] },
		profile: 'transaction',
		storage: {
			provider: (scope: string) => {
				const s = new FileRawStorage(join(dirs.blocks, scope));
				storages.push(s);
				return s;
			},
		},
		network: {
			transports: [webSockets(), circuitRelayTransport()] as never,
			listenAddrs: [],
			relayAddrs: [],
			requireRelay: false,
			connectionGater: { denyDialMultiaddr: () => false },
		},
		strandFilter: { mode: 'sAppId', sAppId: CATALOG_SAPP_ID },
		hibernation: { enabled: false },
		requireSignedSchemas: false, // the catalog sApp is unsigned until release
		trustedOwners: { store: await FileTrustedOwnerStore.open(dirs.node, partyId) },
		bootstrapPeers: { store: await FileBootstrapPeerStore.open(dirs.node, partyId) },
		enrolledMachines: { store: await FileEnrolledMachineStore.open(dirs.node, partyId) },
		strandNetworkState: { store: await FileStrandNetworkStateStore.open(dirs.node, partyId) },
	});

	// Catalog strands this node already holds are offered after start; attach them.
	const attached = new Map<string, Promise<StrandInstance>>();
	const attach = (row: StrandRow) => {
		if (!attached.has(row.Id)) attached.set(row.Id, attachWhenWritable(node, row));
		return attached.get(row.Id)!;
	};
	node.on('strand:discovered', ({ strand }) => { void attach(strand).catch((err) => console.warn(`wyatt-web: attaching ${strand.Id} failed:`, err)); });

	await node.start();
	await enrollOwner(node, keyStore);
	for (const row of node.getDiscoveredStrands().values()) void attach(row).catch(() => {});

	let strandId = await firstCatalogStrand(node, attached);
	if (!strandId) {
		strandId = await foundCatalogStrand(node);
		console.info(`wyatt-web: founded catalog strand ${strandId}`);
		if (process.env.WYATT_SEED === 'sample') {
			await loadSampleCatalog(openStrandCatalog(node, strandId));
			console.info('wyatt-web: loaded the sample catalog');
		}
	} else {
		console.info(`wyatt-web: catalog strand ${strandId}`);
	}

	const stop = async () => {
		await node.stop().catch(() => {});
		await Promise.all(storages.map((s) => s.close().catch(() => {})));
	};
	return { node, catalog: openStrandCatalog(node, strandId), catalogStrandId: strandId, home, stop };
}

/** The catalog strand this node runs: one already attached, or one offered within the grace period. */
async function firstCatalogStrand(node: CadreNode, attached: Map<string, Promise<StrandInstance>>): Promise<string | null> {
	const deadline = Date.now() + DISCOVERY_GRACE_MS;
	while (Date.now() < deadline) {
		for (const [id, p] of attached) {
			const instance = await p.catch(() => null);
			if (instance?.database && node.getSAppId(id) === CATALOG_SAPP_ID) return id;
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	return null;
}

async function attachWhenWritable(node: CadreNode, row: StrandRow): Promise<StrandInstance> {
	const running = node.getStrands().get(row.Id);
	if (running?.database) return running;
	try {
		const instance = await node.addStrand({ strandRow: row, sAppConfig: catalogSAppConfig(), founder: false });
		return instance.database ? instance : await node.whenStrandWritable(row.Id, { timeoutMs: FIRST_SYNC_PATIENCE_MS });
	} catch (err) {
		if (!(err instanceof StrandAwaitingFirstSyncError)) throw err;
		return node.whenStrandWritable(row.Id, { timeoutMs: FIRST_SYNC_PATIENCE_MS });
	}
}

/** Enroll this machine as its party's owner, idempotently (taleus `enrollOwner`). */
async function enrollOwner(node: CadreNode, keyStore: KeyStore): Promise<void> {
	const control = node.getControlDatabase();
	if (!control) throw new Error('control database unavailable after start');
	const held = await loadOwnerSigner(keyStore);
	if (await control.hasOwnerKey()) {
		if (held) await node.wireOwnKeyIfOwner(held);
		return;
	}
	const founding = held ?? (await createOwnerKey(keyStore));
	if (!(await control.ensureOwnerKey(founding.publicKey, 'web'))) {
		await node.wireOwnKeyIfOwner(founding);
		return;
	}
	await node.useOwnerSigner(founding);
}

/** The party's ID, created once and kept in the folder. */
async function partyIdIn(home: string): Promise<string> {
	const file = join(home, 'party-id');
	try {
		return (await readFile(file, 'utf8')).trim();
	} catch {
		const id = `wyatt-${randomUUID()}`;
		await writeFile(file, id + '\n');
		return id;
	}
}

/** Stop the node and close its stores when the process ends. */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => {
		const running = (globalThis as Holder)[KEY];
		void (running ? running.then((r) => r.stop()) : Promise.resolve()).finally(() => process.exit(0));
	});
}
