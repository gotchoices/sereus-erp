/**
 * An installation's folder on this machine and the settings file in it.
 *
 *   <home>/installation.json  what this machine is (below); written by start-new and join
 *   <home>/keys/              identity and owner key (Sereus FileKeyStore). Private.
 *   <home>/node/              Sereus node-local stores: trusted owners, dial targets, strand routing
 *   <home>/blocks/<scope>/    the strands' and control network's blocks
 *   <home>/admin.json         how to reach the running node's admin channel (wyatt serve). Private.
 *   <home>/lock               the process that has the folder open
 *
 * Nothing here is copied between machines (deployment.md §6): a new machine is admitted by
 * invitation and copies the strands itself.
 */
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const SETTINGS_FILE = 'installation.json';

/** How this machine reaches and is reached by the others (deployment.md §8). */
export interface NetworkSettings {
  /** libp2p listen addresses. Empty: dial out only (reachable through a relay, if one is named). */
  listen: string[];
  /** Addresses to advertise besides the listen addresses: a public name or a forwarded port. */
  announce: string[];
  /** Relays this machine reserves a slot on, so machines that cannot dial it directly still reach it. */
  relays: string[];
  /** Serve as a relay for the party's other machines. On for servers. */
  relayServer: boolean;
}

export interface Settings {
  version: 1;
  /** The party (Sereus cadre) this machine belongs to. */
  partyId: string;
  /** Founded the party here, or joined it by invitation. */
  origin: 'founded' | 'joined';
  /** `joining` until a member admitted this machine; `ready` after. */
  state: 'joining' | 'ready';
  /** The name people know this machine by ("office server"). */
  machineLabel: string;
  network: NetworkSettings;
  /** The strand chosen per module when the party has several (deployment.md §7). */
  current: { catalog?: string };
  /** When this machine was set up. */
  createdAt: string;
}

export interface HomeDirs {
  root: string;
  keys: string;
  node: string;
  blocks: string;
}

export function homeDirs(home: string): HomeDirs {
  const root = resolve(home);
  return { root, keys: join(root, 'keys'), node: join(root, 'node'), blocks: join(root, 'blocks') };
}

export async function ensureHome(dirs: HomeDirs): Promise<void> {
  await mkdir(dirs.root, { recursive: true, mode: 0o700 });
  for (const d of [dirs.keys, dirs.node, dirs.blocks]) await mkdir(d, { recursive: true, mode: 0o700 });
  await chmod(dirs.keys, 0o700).catch(() => {});
}

export async function readSettings(dirs: HomeDirs): Promise<Settings | null> {
  let text: string;
  try {
    text = await readFile(join(dirs.root, SETTINGS_FILE), 'utf8');
  } catch {
    return legacySettings(dirs);
  }
  const s = JSON.parse(text) as Settings;
  if (s.version !== 1 || !s.partyId) throw new Error(`${join(dirs.root, SETTINGS_FILE)} is not a WyattERP installation file`);
  s.network = { ...defaultNetwork('desktop'), ...s.network };
  s.current ??= {};
  return s;
}

export async function writeSettings(dirs: HomeDirs, s: Settings): Promise<void> {
  const file = join(dirs.root, SETTINGS_FILE);
  await writeFile(file + '.tmp', JSON.stringify(s, null, 2) + '\n', { mode: 0o600 });
  await rename(file + '.tmp', file);
}

export async function removeSettings(dirs: HomeDirs): Promise<void> {
  await rm(join(dirs.root, SETTINGS_FILE), { force: true });
}

/**
 * A folder the web app made before installation.json existed: it kept only `party-id`, and
 * always founded. Read as a founded installation, so existing development data keeps working.
 */
async function legacySettings(dirs: HomeDirs): Promise<Settings | null> {
  let partyId: string;
  try {
    partyId = (await readFile(join(dirs.root, 'party-id'), 'utf8')).trim();
  } catch {
    return null;
  }
  const s: Settings = {
    version: 1, partyId, origin: 'founded', state: 'ready', machineLabel: 'web', network: defaultNetwork('desktop'),
    current: {}, createdAt: (await stat(join(dirs.root, 'party-id'))).mtime.toISOString(),
  };
  await writeSettings(dirs, s);
  return s;
}

export type NetworkRole = 'server' | 'desktop';

export interface NetworkOptions {
  /** TCP port (server default 4101; desktop default 0, any free port). */
  port?: number;
  /** WebSocket port (server default port + 1; desktop: none). */
  wsPort?: number | null;
  /** A public name or address others reach this machine at: `erp.example.com` or `203.0.113.7`. */
  publicHost?: string;
  relays?: string[];
  relayServer?: boolean;
}

/**
 * Listen and announce settings for a role. A server listens on fixed ports, announces its public
 * name and relays for the party's machines that cannot be dialed. A desktop (the web app) listens
 * on any free port and is reached directly on its network or through a relay (deployment.md §8).
 */
export function defaultNetwork(role: NetworkRole, o: NetworkOptions = {}): NetworkSettings {
  const port = o.port ?? (role === 'server' ? 4101 : 0);
  const wsPort = o.wsPort === undefined ? (role === 'server' ? port + 1 : null) : o.wsPort;
  const listen = [`/ip4/0.0.0.0/tcp/${port}`];
  if (wsPort !== null) listen.push(`/ip4/0.0.0.0/tcp/${wsPort}/ws`);
  const announce: string[] = [];
  if (o.publicHost) {
    const proto = /^\d+\.\d+\.\d+\.\d+$/.test(o.publicHost) ? 'ip4' : o.publicHost.includes(':') ? 'ip6' : 'dns4';
    if (port !== 0) announce.push(`/${proto}/${o.publicHost}/tcp/${port}`);
    if (wsPort) announce.push(`/${proto}/${o.publicHost}/tcp/${wsPort}/ws`);
  }
  return { listen, announce, relays: o.relays ?? [], relayServer: o.relayServer ?? role === 'server' };
}

/** One process per folder: two nodes over the same stores would corrupt them. */
export async function lockHome(dirs: HomeDirs): Promise<() => Promise<void>> {
  // Within one process too: a dev server that re-imports this module must not open a folder twice.
  const open = ((globalThis as Record<symbol, Set<string>>)[OPEN_HOMES] ??= new Set<string>());
  if (open.has(dirs.root)) throw new HomeInUseError(`${dirs.root} is already open in this process.`, process.pid);
  open.add(dirs.root);
  const file = join(dirs.root, 'lock');
  try {
    const pid = Number((await readFile(file, 'utf8')).trim());
    if (pid && pid !== process.pid && alive(pid)) {
      throw new HomeInUseError(`${dirs.root} is in use by process ${pid}. Stop it first, or use its admin channel (wyatt commands do this when "wyatt serve" runs).`, pid);
    }
  } catch (err) {
    if (err instanceof HomeInUseError) {
      open.delete(dirs.root);
      throw err;
    }
  }
  await writeFile(file, `${process.pid}\n`);
  return async () => {
    open.delete(dirs.root);
    try {
      if (Number((await readFile(file, 'utf8')).trim()) === process.pid) await rm(file, { force: true });
    } catch { /* gone already */ }
  };
}

const OPEN_HOMES = Symbol.for('wyatt.node.open-homes');

export class HomeInUseError extends Error {
  constructor(message: string, readonly pid: number) {
    super(message);
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
