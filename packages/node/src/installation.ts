/**
 * One WyattERP installation on this machine (design/specs/domain/deployment.md): its Sereus node,
 * its folder, its keys and the strands it holds. The web app and the `wyatt` command both run
 * one, so whatever either does, the strands record only its effect (deployment.md §3).
 *
 * A machine is set up once, by one of two acts, and never by accident (deployment.md §4):
 *   startNew  founds a party (owner key on this machine) and its first catalog strand;
 *   join      redeems a machine invitation (or an owner grant) and copies the party's strands.
 * After that `open` starts it as it was.
 *
 * Every method returns plain data, so the `wyatt` command can call it over the admin channel
 * of a running `wyatt serve` (admin.ts).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { FileRawStorage } from '@optimystic/db-p2p-storage-fs';
import {
  CadreInviteRejectedError, CadreInviteUnreachableError, CadreNode, createOwnerKey, decodeCadreInvitation, decodeOwnerGrant,
  DEFAULT_IDENTITY_KEY_ID, describeThrown, exportOwnerKey, importOwnerKeyInto, loadOwnerSigner, MachineRemovalRefusedError,
  OwnerGrantRejectedError, OwnerGrantUnreachableError, OwnerKeyRemovalRefusedError, StrandAwaitingFirstSyncError,
  type CadreInvitation, type KeyStore, type OwnerGrantBundle, type StrandInstance, type StrandRow,
} from '@serfab/cadre-core';
import { runOwnerGenesis } from '@serfab/cadre-core/edge-node';
import { FileBootstrapPeerStore } from '@serfab/cadre-core/bootstrap-peer-store-file';
import { FileEnrolledMachineStore } from '@serfab/cadre-core/enrolled-machine-store-file';
import { FileKeyStore } from '@serfab/cadre-core/key-store-file';
import { FileStrandNetworkStateStore } from '@serfab/cadre-core/strand-network-state-file';
import { FileTrustedOwnerStore } from '@serfab/cadre-core/trusted-owner-store-file';
import type { Database } from '@quereus/quereus';
import {
  CATALOG_SAPP_ID, catalogExportToYaml, catalogSAppConfig, describeExport, exportCatalog, foundCatalogStrand, loadSampleCatalog,
  loadStarterCatalog, openStrandCatalog, parseCatalogExport, restoreCatalog, type About, type CatalogModel, type RestoreProgress,
  type RestoreReport, type StarterResult,
} from '@wyatt/core/catalog';
import {
  defaultNetwork, ensureHome, homeDirs, lockHome, readSettings, removeSettings, writeSettings,
  type HomeDirs, type NetworkSettings, type Settings,
} from './home.js';

const FIRST_SYNC_PATIENCE_MS = 10 * 60_000;
const JOIN_PATIENCE_MS = 3 * 60_000;
const DAY = 24 * 60 * 60_000;
const RESUME_DISCOVERY_MS = 8_000;
const RESUME_PATIENCE_MS = 20_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type Phase = 'new' | 'joining' | 'starting' | 'running' | 'removed' | 'failed';

export interface StrandReport {
  id: string;
  module: 'catalog';
  /** From the strand's About record; null until the copy has arrived (or on an old strand). */
  name: string | null;
  purpose: string | null;
  company: string | null;
  /** `syncing` while this machine's copy is arriving; `active` once it can be used. */
  state: string;
  writable: boolean;
  /** The one this machine works in. */
  current: boolean;
  /** Machines of the party holding this strand that are not connected now. */
  unreached: string[];
  createdAt: string | null;
}

export interface MachineReport {
  peerId: string;
  label: string | null;
  self: boolean;
  /** This machine accepts it as a member of the party now. */
  trusted: boolean;
  /** Epoch ms of its last self-published record. */
  lastHeard: number | null;
  /** Connected to this machine now. */
  connected: boolean;
}

export interface StatusReport {
  phase: Phase;
  error: string | null;
  home: string;
  partyId: string | null;
  origin: 'founded' | 'joined' | null;
  machineLabel: string | null;
  peerId: string | null;
  /** This machine holds an owner key of the party, wired for signing. */
  owner: boolean;
  /** The party's owner keys; a recovery key is suggested while there is one (deployment.md §5). */
  ownerKeyCount: number | null;
  /** Other machines of the party connected now. */
  connected: number;
  /** Addresses others can reach this machine at. */
  addresses: string[];
  network: NetworkSettings | null;
  strands: StrandReport[];
  /** The catalog strand this machine works in, or null (none yet, or several and none chosen). */
  current: string | null;
  /** Several catalog strands and none chosen: the client asks which (deployment.md §7). */
  needsChoice: boolean;
  /** Founding a strand is offered: an owner, and not still waiting for a joined party's strands. */
  canFound: boolean;
}

export interface InvitationReport {
  key: string;
  label: string | null;
  peerId: string | null;
  expiresAt: string | null;
  live: boolean;
  withdrawn: boolean;
  used: number;
}

export interface OwnerKeyReport {
  key: string;
  fingerprint: string;
  label: string | null;
  heldHere: boolean;
  trusted: boolean;
}

export interface StartNewInput {
  /** This machine's name ("office server"). */
  machineLabel: string;
  company: string;
  /** The first catalog's name; default "Catalog". */
  catalogName?: string;
  purpose?: string;
  /** Give the catalog the starting set of units, classes and operations; default true. */
  starter?: boolean;
  /** The illustrative sample catalog (development and demos only). */
  sample?: boolean;
  /** The owner key's label; default the machine's name. */
  ownerLabel?: string;
}

export interface JoinInput {
  /** The machine invitation text (`sereus-invite:1.…`), or an owner grant to join as an owner too. */
  invitation: string;
  machineLabel: string;
  /** An owner grant redeemed with the invitation, making this machine an owner as well. */
  ownerGrant?: string;
  /** How long to keep trying when no member answers; default 3 minutes. */
  patienceMs?: number;
}

export class InstallationError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = false) {
    super(message);
  }
}

export interface InstallationOptions {
  home: string;
  /** Network settings for a new installation (start new, join). Existing ones keep theirs. */
  network?: NetworkSettings;
  log?: (line: string) => void;
}

interface LiveNode {
  node: CadreNode;
  keyStore: KeyStore;
  storages: FileRawStorage[];
}

export class Installation {
  readonly dirs: HomeDirs;
  #phase: Phase = 'new';
  #error: string | null = null;
  #settings: Settings | null = null;
  #live: LiveNode | null = null;
  #attached = new Map<string, Promise<StrandInstance>>();
  #unlock: (() => Promise<void>) | null = null;
  #busy: Promise<unknown> = Promise.resolve();
  readonly #log: (line: string) => void;
  readonly #network: NetworkSettings | undefined;

  private constructor(opts: InstallationOptions) {
    this.dirs = homeDirs(opts.home);
    this.#log = opts.log ?? ((l) => console.info(`wyatt: ${l}`));
    this.#network = opts.network;
  }

  /**
   * Open the installation in `home`, starting its node when it has been set up. A folder never
   * set up opens in phase `new`, waiting for startNew or join.
   */
  static async open(opts: InstallationOptions): Promise<Installation> {
    const inst = new Installation(opts);
    await ensureHome(inst.dirs);
    inst.#unlock = await lockHome(inst.dirs);
    inst.#settings = await readSettings(inst.dirs);
    if (inst.#settings?.state === 'ready') await inst.#run(() => inst.#startExisting());
    else if (inst.#settings?.state === 'joining') {
      // A join that did not finish: nothing was admitted that this machine knows of.
      await removeSettings(inst.dirs);
      inst.#settings = null;
    }
    return inst;
  }

  get phase(): Phase { return this.#phase; }
  get node(): CadreNode | null { return this.#live?.node ?? null; }
  get settings(): Settings | null { return this.#settings; }

  /** Run state changes one at a time. */
  #run<T>(body: () => Promise<T>): Promise<T> {
    const next = this.#busy.then(body, body);
    this.#busy = next.catch(() => {});
    return next;
  }

  // ── Setting up ─────────────────────────────────────────────────────────────

  /** Found a new party and its first catalog strand on this machine (deployment.md §4). */
  startNew(input: StartNewInput): Promise<StatusReport> {
    return this.#run(async () => {
      this.#requireNew();
      const machineLabel = label(input.machineLabel, 'machine name');
      const partyId = `wyatt-${randomUUID()}`;
      const settings: Settings = {
        version: 1, partyId, origin: 'founded', state: 'ready', machineLabel,
        network: this.#network ?? defaultNetwork('desktop'), current: {}, createdAt: new Date().toISOString(),
      };
      this.#phase = 'starting';
      try {
        const live = await this.#build(settings);
        await live.node.start();
        const genesis = await runOwnerGenesis(live.node, { keyStore: live.keyStore, label: label(input.ownerLabel ?? machineLabel, 'owner key label') });
        if (genesis !== 'enrolled') throw new InstallationError('genesis', `Could not make this machine the party's owner (${genesis}).`);
        const strandId = await foundCatalogStrand(live.node);
        await this.#describeNewStrand(live.node, strandId, {
          name: input.catalogName?.trim() || 'Catalog', purpose: input.purpose?.trim() ?? '', company: input.company.trim(),
        }, machineLabel, input.starter ?? true, input.sample ?? false);
        settings.current.catalog = strandId;
        await writeSettings(this.dirs, settings);
        this.#settings = settings;
        this.#watch(live.node);
        this.#phase = 'running';
        this.#log(`started a new installation: party ${partyId}, catalog ${strandId}`);
      } catch (err) {
        await this.#teardown();
        this.#phase = 'new';
        throw err;
      }
      return this.#status();
    });
  }

  /**
   * Join the party an invitation names (deployment.md §4). Never founds anything: if no member
   * can be reached, or the invitation is refused, this machine is left as it was, unset.
   */
  join(input: JoinInput): Promise<StatusReport> {
    return this.#run(async () => {
      this.#requireNew();
      const machineLabel = label(input.machineLabel, 'machine name');
      const { invitation, grant } = decodeCredentials(input.invitation, input.ownerGrant);
      const partyId = (invitation ?? grant)!.partyId;
      const members = (invitation ?? grant)!.members ?? [];
      const network = this.#network ?? defaultNetwork('desktop');
      if (network.relays.length === 0 && !network.relayServer) network.relays = relayCandidates(members);
      const settings: Settings = {
        version: 1, partyId, origin: 'joined', state: 'joining', machineLabel, network, current: {}, createdAt: new Date().toISOString(),
      };
      await writeSettings(this.dirs, settings);
      this.#settings = settings;
      this.#phase = 'joining';
      try {
        const live = await this.#build(settings, members);
        this.#watchStrands(live.node);
        await live.node.start();
        const signal = AbortSignal.timeout(input.patienceMs ?? JOIN_PATIENCE_MS);
        if (grant) {
          const signer = (await loadOwnerSigner(live.keyStore)) ?? (await createOwnerKey(live.keyStore));
          const joined = await live.node.joinWithOwnerGrant(grant, signer, { waitForMember: true, signal });
          this.#log(`joined party ${partyId} as an owner${joined.peerId ? ` through ${joined.peerId}` : ''}`);
        } else {
          const joined = await live.node.redeemCadreInvitation(invitation!, { waitForMember: true, signal });
          this.#log(`joined party ${partyId}${joined.peerId ? ` through ${joined.peerId}` : ''}`);
        }
        settings.state = 'ready';
        await writeSettings(this.dirs, settings);
        this.#watchRemoval(live.node);
        this.#phase = 'running';
        for (const row of live.node.getDiscoveredStrands().values()) void this.#attach(row);
      } catch (err) {
        await this.#teardown();
        await removeSettings(this.dirs);
        this.#settings = null;
        this.#phase = 'new';
        throw joinFailure(err);
      }
      return this.#status();
    });
  }

  #requireNew(): void {
    if (this.#settings) throw new InstallationError('already-set-up', `This machine is already set up (${this.dirs.root}). To set it up again, stop it and delete that folder.`);
  }

  // ── Running ────────────────────────────────────────────────────────────────

  async #startExisting(): Promise<void> {
    const s = this.#settings!;
    this.#phase = 'starting';
    try {
      const live = await this.#build(s);
      this.#watchStrands(live.node);
      await live.node.start();
      if (live.node.removedFromCadre()) return this.#removed();
      const held = await loadOwnerSigner(live.keyStore);
      if (s.origin === 'founded') {
        const genesis = await runOwnerGenesis(live.node, { keyStore: live.keyStore, label: s.machineLabel });
        if (genesis === 'failed' || genesis === 'timed-out') this.#log(`owner key not wired this start (${genesis})`);
      } else if (held) {
        await live.node.wireOwnKeyIfOwner(held).catch((err) => this.#log(`owner key not wired: ${describeThrown(err)}`));
      }
      this.#watchRemoval(live.node);
      await this.#resumeStrands(live.node);
      this.#phase = 'running';
    } catch (err) {
      this.#phase = 'failed';
      this.#error = describeThrown(err);
      throw err;
    }
  }

  async #build(s: Settings, bootstrap: string[] = []): Promise<LiveNode> {
    await ensureHome(this.dirs);
    const keyStore = new FileKeyStore(this.dirs.keys);
    const storages: FileRawStorage[] = [];
    const n = s.network;
    const node = new CadreNode({
      keyStore,
      identityKeyId: DEFAULT_IDENTITY_KEY_ID,
      controlNetwork: { partyId: s.partyId, bootstrapNodes: bootstrap },
      profile: 'transaction',
      storage: {
        provider: (scope: string) => {
          const st = new FileRawStorage(join(this.dirs.blocks, scope));
          storages.push(st);
          return st;
        },
      },
      network: {
        transports: [tcp(), webSockets(), circuitRelayTransport()] as never,
        listenAddrs: n.listen,
        appendAnnounceAddrs: n.announce,
        relayAddrs: n.relays,
        requireRelay: false,
        enableRelay: n.relayServer,
        connectionGater: { denyDialMultiaddr: () => false },
      },
      strandFilter: { mode: 'sAppId', sAppId: CATALOG_SAPP_ID },
      hibernation: { enabled: false },
      requireSignedSchemas: false, // the catalog sApp is unsigned until release (docs/sereus-requirements.md §2)
      trustedOwners: { store: await FileTrustedOwnerStore.open(this.dirs.node, s.partyId) },
      bootstrapPeers: { store: await FileBootstrapPeerStore.open(this.dirs.node, s.partyId) },
      enrolledMachines: { store: await FileEnrolledMachineStore.open(this.dirs.node, s.partyId) },
      strandNetworkState: { store: await FileStrandNetworkStateStore.open(this.dirs.node, s.partyId) },
    });
    this.#live = { node, keyStore, storages };
    return this.#live;
  }

  /** Attach every catalog strand this node is offered, now and later. */
  #watchStrands(node: CadreNode): void {
    node.on('strand:discovered', ({ strand }) => { void this.#attach(strand); });
  }

  #watchRemoval(node: CadreNode): void {
    node.on('cadre:removed', () => { void this.#run(() => this.#removed()); });
  }

  #watch(node: CadreNode): void {
    this.#watchStrands(node);
    this.#watchRemoval(node);
  }

  async #removed(): Promise<void> {
    this.#log('an owner removed this machine from the party; it has stopped');
    this.#phase = 'removed';
    this.#error = 'An owner removed this machine from the party. It no longer syncs. To use it again, delete its folder and set it up anew.';
    const live = this.#live;
    this.#live = null;
    if (live) await stopLive(live);
  }

  /**
   * On a restart, the strands this machine already holds come back from its own storage within
   * seconds: wait for them, so the first request finds the catalog open. A strand still copying
   * from another machine is left to arrive in the background.
   */
  async #resumeStrands(node: CadreNode): Promise<void> {
    const deadline = Date.now() + RESUME_DISCOVERY_MS;
    while (node.getDiscoveredStrands().size === 0 && Date.now() < deadline) await sleep(200);
    for (const row of node.getDiscoveredStrands().values()) void this.#attach(row);
    await Promise.race([Promise.allSettled([...this.#attached.values()]), sleep(RESUME_PATIENCE_MS)]);
  }

  #attach(row: StrandRow): Promise<StrandInstance> {
    let p = this.#attached.get(row.Id);
    if (!p) {
      const node = this.#live!.node;
      p = attachWhenWritable(node, row).then(async (instance) => {
        await this.#nameSelf(node, row.Id).catch((err) => this.#log(`could not record this machine's name in ${row.Id}: ${describeThrown(err)}`));
        return instance;
      });
      p.catch((err) => {
        if (this.#live?.node !== node) return; // stopped meanwhile
        this.#attached.delete(row.Id);
        this.#log(`strand ${row.Id} not attached: ${describeThrown(err)}`);
      });
      this.#attached.set(row.Id, p);
    }
    return p;
  }

  /** Each machine names itself in each catalog it holds, once. */
  async #nameSelf(node: CadreNode, strandId: string): Promise<void> {
    const s = this.#settings;
    const peerId = node.peerId?.toString();
    if (!s || !peerId) return;
    const cat = openStrandCatalog(node, strandId);
    const names = ok(await cat.machines.list());
    if (names.some((m) => m.peerId === peerId)) return;
    ok(await cat.machines.name(peerId, s.machineLabel));
  }

  async #describeNewStrand(node: CadreNode, strandId: string, about: About, machineLabel: string, starter: boolean, sample: boolean): Promise<StarterResult | null> {
    const cat = openStrandCatalog(node, strandId);
    ok(await cat.about.set(about));
    ok(await cat.machines.name(node.peerId!.toString(), machineLabel));
    this.#attached.set(strandId, Promise.resolve(node.getStrands().get(strandId)!));
    if (sample) {
      await loadSampleCatalog(cat);
      return null;
    }
    return starter ? loadStarterCatalog(cat) : null;
  }

  /** Stop the node and release the folder. */
  stop(): Promise<void> {
    return this.#run(async () => {
      await this.#teardown();
      await this.#unlock?.();
      this.#unlock = null;
    });
  }

  async #teardown(): Promise<void> {
    const live = this.#live;
    this.#live = null;
    this.#attached.clear();
    if (live) await stopLive(live);
  }

  #requireNode(): CadreNode {
    const node = this.#live?.node;
    if (!node || this.#phase !== 'running') {
      throw new InstallationError(this.#phase === 'new' ? 'not-set-up' : 'not-running',
        this.#phase === 'new' ? 'This machine is not set up yet: start a new installation or join one.' : `This machine's node is not running (${this.#phase}).`);
    }
    return node;
  }

  async #requireOwner(): Promise<CadreNode> {
    const node = this.#requireNode();
    if (!(await node.isOwner())) throw new InstallationError('not-an-owner', 'Only an owner can do this, and this machine holds no owner key of the party.');
    return node;
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  status(): Promise<StatusReport> {
    return this.#status();
  }

  async #status(): Promise<StatusReport> {
    if (this.#phase === 'running' && this.#live?.node.removedFromCadre()) await this.#run(() => this.#removed());
    const s = this.#settings;
    const node = this.#live?.node ?? null;
    const running = node && this.#phase === 'running';
    const strands = running ? await this.#strands(node) : [];
    const owner = running ? await guard(() => node.isOwner(), false) : false;
    const writable = strands.filter((x) => x.writable);
    const current = this.#currentId(strands);
    return {
      phase: this.#phase,
      error: this.#error,
      home: this.dirs.root,
      partyId: s?.partyId ?? null,
      origin: s?.origin ?? null,
      machineLabel: s?.machineLabel ?? null,
      peerId: node?.peerId?.toString() ?? null,
      owner,
      ownerKeyCount: running ? await guard(async () => (await node.listOwnerKeys()).length, null) : null,
      connected: running ? await guard(async () => {
        const peers = new Set((node.getControlNode()?.getConnections() ?? []).map((c) => c.remotePeer.toString()));
        return (await node.listMachines()).filter((m) => !m.isSelf && peers.has(m.peerId)).length;
      }, 0) : 0,
      addresses: running ? await guard(() => node.getMultiaddrs(), []) : [],
      network: s?.network ?? null,
      strands,
      current,
      needsChoice: current === null && writable.length > 1,
      canFound: owner && (s?.origin === 'founded' || strands.length > 0),
    };
  }

  #currentId(strands: StrandReport[]): string | null {
    const chosen = this.#settings?.current.catalog;
    if (chosen && strands.some((x) => x.id === chosen && x.writable)) return chosen;
    const writable = strands.filter((x) => x.writable);
    return writable.length === 1 ? writable[0]!.id : null;
  }

  async #strands(node: CadreNode): Promise<StrandReport[]> {
    const ids = new Set<string>([...node.getStrands().keys(), ...node.getDiscoveredStrands().keys()]);
    const chosen = this.#settings?.current.catalog;
    const out: StrandReport[] = [];
    for (const id of ids) {
      const sApp = node.getSAppId(id);
      if (sApp && sApp !== CATALOG_SAPP_ID) continue;
      const instance = node.getStrands().get(id);
      const writable = Boolean(instance?.database);
      const about = writable ? await guard(async () => ok(await openStrandCatalog(node, id).about.get()), null) : null;
      out.push({
        id, module: 'catalog', name: about?.name ?? null, purpose: about?.purpose ?? null, company: about?.company ?? null,
        state: instance?.status ?? 'syncing', writable, current: false,
        unreached: await guard(() => node.getUnreachedStrandMachines(id).map((m) => m.peerId), []),
        createdAt: about?.createdAt ?? null,
      });
    }
    out.sort((a, b) => (a.createdAt ?? '~').localeCompare(b.createdAt ?? '~') || a.id.localeCompare(b.id));
    const current = chosen && out.some((x) => x.id === chosen && x.writable) ? chosen : out.filter((x) => x.writable).length === 1 ? out.find((x) => x.writable)!.id : null;
    for (const x of out) x.current = x.id === current;
    return out;
  }

  // ── The catalog ────────────────────────────────────────────────────────────

  /** The catalog this machine works in. */
  async catalogStrandId(): Promise<string> {
    const node = this.#requireNode();
    const strands = await this.#strands(node);
    const id = this.#currentId(strands);
    if (id) return id;
    if (strands.some((x) => x.writable)) throw new InstallationError('choose-strand', 'This party has several catalogs; choose the one to work in.');
    throw new InstallationError('syncing', strands.length ? 'The catalog is still being copied to this machine.' : 'This machine has no catalog yet; it may still be arriving.', true);
  }

  async catalog(strandId?: string): Promise<CatalogModel> {
    const node = this.#requireNode();
    return openStrandCatalog(node, strandId ?? (await this.catalogStrandId()));
  }

  database(strandId: string): Database {
    const db = this.#requireNode().getStrands().get(strandId)?.database?.getDatabase();
    if (!db) throw new InstallationError('syncing', `Strand ${strandId} is not ready on this machine.`, true);
    return db;
  }

  /** Choose the catalog this machine works in; remembered per machine. */
  async useStrand(strandId: string): Promise<StatusReport> {
    const node = this.#requireNode();
    if (!(await this.#strands(node)).some((x) => x.id === strandId && x.writable)) {
      throw new InstallationError('unknown-strand', `No catalog ${strandId} is ready on this machine.`);
    }
    this.#settings!.current.catalog = strandId;
    await writeSettings(this.dirs, this.#settings!);
    return this.#status();
  }

  /** Found another catalog strand (deployment.md §7): deliberate, named, with a note of intent. */
  foundCatalog(input: { name: string; purpose?: string; company?: string; starter?: boolean }): Promise<StrandReport> {
    return this.#run(async () => {
      const node = await this.#requireOwner();
      const status = await this.#status();
      if (!status.canFound) throw new InstallationError('still-joining', 'This machine has not finished joining; the party\'s strands may still be arriving.', true);
      const name = label(input.name, 'name', 80);
      const company = input.company?.trim() || (await this.#company(node)) || '';
      const id = await foundCatalogStrand(node);
      await this.#describeNewStrand(node, id, { name, purpose: input.purpose?.trim() ?? '', company }, this.#settings!.machineLabel, input.starter ?? true, false);
      this.#log(`founded catalog ${id} (${name})`);
      return (await this.#strands(node)).find((x) => x.id === id)!;
    });
  }

  async #company(node: CadreNode): Promise<string | null> {
    for (const x of await this.#strands(node)) if (x.company) return x.company;
    return null;
  }

  async setAbout(strandId: string, about: { name: string; purpose: string; company: string }): Promise<StrandReport> {
    const node = this.#requireNode();
    ok(await openStrandCatalog(node, strandId).about.set({ ...about, name: label(about.name, 'name', 80) }));
    return (await this.#strands(node)).find((x) => x.id === strandId)!;
  }

  /** Remove a strand from every machine of the party (deployment.md §7). Irreversible for a closed strand. */
  removeStrand(strandId: string, confirm: boolean): Promise<void> {
    return this.#run(async () => {
      const node = await this.#requireOwner();
      if (!confirm) throw new InstallationError('confirm', 'Removing a strand takes it off every machine of the party, and a closed strand removed can never admit anyone again. Confirm to go ahead.');
      await node.unpublishStrand(strandId);
      if (this.#settings?.current.catalog === strandId) {
        delete this.#settings.current.catalog;
        await writeSettings(this.dirs, this.#settings);
      }
    });
  }

  // ── Machines ───────────────────────────────────────────────────────────────

  async machines(): Promise<MachineReport[]> {
    const node = this.#requireNode();
    const names = new Map<string, string>();
    try {
      for (const m of ok(await (await this.catalog()).machines.list())) names.set(m.peerId, m.label);
    } catch { /* no catalog yet */ }
    const connected = new Set((node.getControlNode()?.getConnections() ?? []).map((c) => c.remotePeer.toString()));
    return (await node.listMachines()).map((m) => ({
      peerId: m.peerId, label: names.get(m.peerId) ?? null, self: m.isSelf, trusted: m.isSelf || m.trusted,
      lastHeard: m.lastPublishedAt, connected: m.isSelf || connected.has(m.peerId),
    }));
  }

  async nameMachine(peerId: string, name: string): Promise<void> {
    ok(await (await this.catalog()).machines.name(peerId, label(name, 'machine name')));
    if (peerId === this.#requireNode().peerId?.toString() && this.#settings) {
      this.#settings.machineLabel = name.trim();
      await writeSettings(this.dirs, this.#settings);
    }
  }

  /** A machine invitation (deployment.md §4): admits one machine, expires, can be withdrawn. */
  async invite(input: { label?: string; ttlMs?: number; peerId?: string } = {}): Promise<{ invitation: string; key: string; expiresAt: string | null; reach: string }> {
    const node = await this.#requireOwner();
    const ttl = Math.min(input.ttlMs ?? 7 * DAY, 30 * DAY);
    const made = await node.createCadreInvitation({ expiresInMs: ttl, uses: 1, ...(input.peerId ? { peerId: input.peerId } : {}) });
    const key = made.invitation.invite.key;
    if (input.label?.trim()) await this.#rememberInviteLabel(key, input.label.trim());
    return { invitation: made.encoded, key, expiresAt: made.invitation.invite.expiresAt, reach: made.reach };
  }

  async invitations(): Promise<InvitationReport[]> {
    const node = await this.#requireOwner();
    const labels = await this.#inviteLabels();
    return (await node.listCadreInvitations()).map((i) => ({
      key: i.invite.key, label: labels[i.invite.key] ?? null, peerId: i.invite.peerId, expiresAt: i.invite.expiresAt,
      live: i.live, withdrawn: i.withdrawn, used: i.usesRecorded,
    }));
  }

  async withdrawInvitation(key: string): Promise<boolean> {
    return (await this.#requireOwner()).withdrawCadreInvitation(key);
  }

  /**
   * What removing a machine would do, for the confirmation (deployment.md §4, §6): refused for
   * this machine itself and for a non-owner, and a warning when this machine cannot vouch that
   * another copy of every strand exists.
   */
  async planRemoveMachine(peerId: string): Promise<{ refusal: string | null; label: string | null; onlyCopyRisk: string[] }> {
    const node = this.#requireNode();
    const plan = await node.planMachineRemoval(peerId);
    const machine = (await this.machines()).find((m) => m.peerId === peerId);
    const strands = await this.#strands(node);
    return {
      refusal: plan.refusal,
      label: machine?.label ?? null,
      // This machine holds a usable copy of every strand it knows; anything else may live only there.
      onlyCopyRisk: strands.filter((x) => !x.writable).map((x) => x.name ?? x.id),
    };
  }

  removeMachine(peerId: string, opts: { acceptLoss?: boolean } = {}): Promise<{ removed: boolean; pending: string[] }> {
    return this.#run(async () => {
      const node = await this.#requireOwner();
      const plan = await this.planRemoveMachine(peerId);
      if (plan.refusal === 'self') throw new InstallationError('self', 'A machine cannot remove itself. Remove it from another machine of the party.');
      if (plan.onlyCopyRisk.length && !opts.acceptLoss) {
        throw new InstallationError('only-copy',
          `This machine has not finished copying ${plan.onlyCopyRisk.join(', ')}; the machine being removed may hold the only copy. Wait, or confirm that the data may be lost.`);
      }
      try {
        const result = await node.removeMachine(peerId);
        return { removed: result.removedPeer, pending: result.strands.filter((x) => x.outcome !== 'rotated').map((x) => x.strandId) };
      } catch (err) {
        if (err instanceof MachineRemovalRefusedError) throw new InstallationError(err.code, err.message);
        throw err;
      }
    });
  }

  // ── Owner keys and recovery (deployment.md §5) ─────────────────────────────

  async ownerKeys(): Promise<OwnerKeyReport[]> {
    const node = this.#requireNode();
    return (await node.listOwnerKeys()).map((k) => ({ key: k.key, fingerprint: fingerprint(k.key), label: k.label, heldHere: k.heldHere, trusted: k.trusted }));
  }

  /**
   * An owner grant: whoever redeems it gets an owner key of their own. `backup` makes one that
   * never expires, to keep offline as a recovery key.
   */
  async ownerGrant(input: { label: string; backup?: boolean; ttlMs?: number }): Promise<{ grant: string; reach: string; expires: string }> {
    const node = await this.#requireOwner();
    const made = await node.createOwnerGrant({ label: label(input.label, 'label'), expiresInMs: input.backup ? null : (input.ttlMs ?? DAY), uses: 1 });
    return { grant: made.encoded, reach: made.reach, expires: input.backup ? 'never' : new Date(Date.now() + (input.ttlMs ?? DAY)).toISOString() };
  }

  /** Redeem an owner grant on this machine, which is already a member: it becomes an owner. */
  async redeemOwnerGrant(text: string): Promise<OwnerKeyReport[]> {
    const node = this.#requireNode();
    const grant = decodeOwnerGrant(text.trim());
    const keyStore = this.#live!.keyStore;
    const signer = (await loadOwnerSigner(keyStore)) ?? (await createOwnerKey(keyStore));
    try {
      await node.redeemOwnerGrant(grant, signer);
    } catch (err) {
      throw joinFailure(err);
    }
    await node.wireOwnKeyIfOwner(signer);
    return this.ownerKeys();
  }

  /** This machine's owner key as text, locked with a passphrase when one is given. */
  async exportOwnerKey(input: { passphrase?: string; label?: string } = {}): Promise<{ text: string; fingerprint: string }> {
    this.#requireNode();
    const exp = await exportOwnerKey(this.#live!.keyStore, {
      ...(input.passphrase ? { passphrase: input.passphrase } : {}), ...(input.label ? { label: input.label } : {}),
    });
    return { text: exp.exportText, fingerprint: fingerprint(exp.publicKey) };
  }

  async importOwnerKey(text: string, passphrase?: string): Promise<{ fingerprint: string; wired: boolean }> {
    const node = this.#requireNode();
    const r = await importOwnerKeyInto(this.#live!.keyStore, node, text.trim(), passphrase);
    return { fingerprint: fingerprint(r.publicKey), wired: r.wired };
  }

  async removeOwnerKey(key: string): Promise<void> {
    const node = await this.#requireOwner();
    try {
      await node.removeOwner(key);
    } catch (err) {
      if (err instanceof OwnerKeyRemovalRefusedError) throw new InstallationError(err.code, err.message);
      throw err;
    }
  }

  // ── Backup and restore (deployment.md §9) ──────────────────────────────────

  async exportCatalog(strandId?: string): Promise<{ yaml: string; families: number; parts: number; partNumbers: number; name: string | null; company: string | null }> {
    const id = strandId ?? (await this.catalogStrandId());
    const exp = await exportCatalog(this.database(id));
    return { yaml: catalogExportToYaml(exp), ...describeExport(exp) };
  }

  /** What an export file holds, before restoring it. */
  describeExport(text: string): ReturnType<typeof describeExport> {
    return describeExport(parseCatalogExport(text));
  }

  restoreCatalog(text: string, strandId?: string, onProgress?: (p: RestoreProgress) => void): Promise<RestoreReport> {
    return this.#run(async () => {
      const exp = parseCatalogExport(text);
      const id = strandId ?? (await this.catalogStrandId());
      this.#log(`restoring ${describeExport(exp).families} families into ${id}`);
      return restoreCatalog(this.database(id), exp, onProgress);
    });
  }

  // ── Invitation labels (kept on this machine only) ──────────────────────────

  async #inviteLabels(): Promise<Record<string, string>> {
    try {
      return JSON.parse(await readFile(join(this.dirs.root, 'invitations.json'), 'utf8')) as Record<string, string>;
    } catch {
      return {};
    }
  }

  async #rememberInviteLabel(key: string, text: string): Promise<void> {
    const all = await this.#inviteLabels();
    all[key] = text;
    await writeFile(join(this.dirs.root, 'invitations.json'), JSON.stringify(all, null, 2) + '\n', { mode: 0o600 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function stopLive(live: LiveNode): Promise<void> {
  await live.node.stop().catch(() => {});
  await Promise.all(live.storages.map((s) => s.close().catch(() => {})));
}

async function attachWhenWritable(node: CadreNode, row: StrandRow): Promise<StrandInstance> {
  const running = node.getStrands().get(row.Id);
  if (running?.database) return running;
  try {
    const instance = running ?? (await node.addStrand({ strandRow: row, sAppConfig: catalogSAppConfig(), founder: false }));
    return instance.database ? instance : await node.whenStrandWritable(row.Id, { timeoutMs: FIRST_SYNC_PATIENCE_MS });
  } catch (err) {
    if (!(err instanceof StrandAwaitingFirstSyncError)) throw err;
    return node.whenStrandWritable(row.Id, { timeoutMs: FIRST_SYNC_PATIENCE_MS });
  }
}

function decodeCredentials(text: string, grantText?: string): { invitation: CadreInvitation | null; grant: OwnerGrantBundle | null } {
  const t = text.trim();
  try {
    if (t.startsWith('sereus-invite:')) {
      const invitation = decodeCadreInvitation(t);
      const grant = grantText?.trim() ? decodeOwnerGrant(grantText.trim()) : null;
      if (grant && grant.partyId !== invitation.partyId) throw new InstallationError('mismatch', 'The owner grant is for a different installation than the invitation.');
      // An owner grant alone joins as a machine and an owner (Sereus joinWithOwnerGrant).
      return grant ? { invitation: null, grant } : { invitation, grant: null };
    }
    return { invitation: null, grant: decodeOwnerGrant(t) };
  } catch (err) {
    if (err instanceof InstallationError) throw err;
    throw new InstallationError('malformed', `That is not a machine invitation or owner grant: ${describeThrown(err)}`);
  }
}

/** Members an invitation names that may serve as relays: any but loopback, for a machine that cannot be dialed. */
function relayCandidates(members: string[]): string[] {
  return members.filter((a) => a.includes('/p2p/') && !a.includes('/p2p-circuit') && !/\/ip4\/127\./.test(a) && !a.includes('/ip6/::1/')).slice(0, 2);
}

function joinFailure(err: unknown): InstallationError {
  if (err instanceof InstallationError) return err;
  if (err instanceof CadreInviteRejectedError || err instanceof OwnerGrantRejectedError) {
    return new InstallationError(err.code, `The invitation was refused (${err.code}): ${err.message}`, err.retryable);
  }
  if (err instanceof CadreInviteUnreachableError || err instanceof OwnerGrantUnreachableError || (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError'))) {
    return new InstallationError('unreachable', 'No machine named in the invitation could be reached. Check that one is running and reachable, then try again.', true);
  }
  return new InstallationError('failed', describeThrown(err));
}

function label(text: string, what: string, max = 64): string {
  const t = (text ?? '').trim();
  if (!t) throw new InstallationError('invalid', `A ${what} is required.`);
  if (t.length > max) throw new InstallationError('invalid', `The ${what} is longer than ${max} characters.`);
  return t;
}

/** The 8-character fingerprint the Sereus apps show for a key. */
export function fingerprint(key: string): string {
  return key.slice(0, 8);
}

function ok<T>(r: { ok: true; value: T } | { ok: false; error: { message: string; kind: string } }): T {
  if (!r.ok) throw new InstallationError(r.error.kind, r.error.message);
  return r.value;
}

async function guard<T>(read: () => T | Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}
