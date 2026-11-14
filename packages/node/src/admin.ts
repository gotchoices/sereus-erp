/**
 * The admin channel of a running installation: how a `wyatt` command reaches the node that
 * `wyatt serve` runs, since only one process may hold the folder (home.ts, lock).
 *
 * HTTP on 127.0.0.1 only, on a port chosen at start, with a bearer token. Both are written to
 * `<home>/admin.json`, readable only by the folder's owner: whoever can read that file can
 * already read the keys beside it.
 */
import { createServer, type Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describeThrown } from '@serfab/cadre-core';
import { homeDirs } from './home.js';
import { InstallationError, type Installation } from './installation.js';

/** The installation methods a command may call, with their arguments as an array. */
const METHODS = [
  'status', 'useStrand', 'foundCatalog', 'setAbout', 'removeStrand',
  'machines', 'nameMachine', 'invite', 'invitations', 'withdrawInvitation', 'planRemoveMachine', 'removeMachine',
  'ownerKeys', 'ownerGrant', 'redeemOwnerGrant', 'exportOwnerKey', 'importOwnerKey', 'removeOwnerKey',
  'exportCatalog', 'describeExport', 'restoreCatalog',
] as const;
export type AdminMethod = (typeof METHODS)[number];

/** Read-only catalog calls a command may make: `catalog.<group>.<op>`. */
const CATALOG_READS = new Set([
  'units.list', 'classes.list', 'operations.list', 'families.list', 'families.get', 'families.whereUsed',
  'versions.get', 'versions.list', 'parts.get', 'parts.list', 'packages.list', 'about.get', 'machines.list', 'usage',
]);

interface AdminFile {
  port: number;
  token: string;
  pid: number;
}

export interface AdminServer {
  port: number;
  close(): Promise<void>;
}

export async function serveAdmin(inst: Installation): Promise<AdminServer> {
  const token = randomBytes(24).toString('base64url');
  const server: Server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const auth = req.headers.authorization ?? '';
    const given = Buffer.from(auth.replace(/^Bearer /, ''));
    const want = Buffer.from(token);
    if (req.method !== 'POST' || req.url !== '/rpc' || given.length !== want.length || !timingSafeEqual(given, want)) {
      send(403, { error: { code: 'forbidden', message: 'forbidden' } });
      return;
    }
    let body = '';
    req.on('data', (c: Buffer) => { body += c.toString('utf8'); });
    req.on('end', () => {
      void (async () => {
        try {
          const { method, args } = JSON.parse(body) as { method: string; args?: unknown[] };
          send(200, { value: await dispatch(inst, method, args ?? []) });
        } catch (err) {
          const code = err instanceof InstallationError ? err.code : 'failed';
          send(200, { error: { code, message: describeThrown(err), retryable: err instanceof InstallationError ? err.retryable : false } });
        }
      })();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as { port: number }).port;
  const file = join(inst.dirs.root, 'admin.json');
  await writeFile(file, JSON.stringify({ port, token, pid: process.pid } satisfies AdminFile) + '\n', { mode: 0o600 });
  return {
    port,
    close: async () => {
      await new Promise<void>((r) => server.close(() => r()));
      await rm(file, { force: true });
    },
  };
}

async function dispatch(inst: Installation, method: string, args: unknown[]): Promise<unknown> {
  if (method.startsWith('catalog.')) {
    const path = method.slice('catalog.'.length);
    if (!CATALOG_READS.has(path)) throw new InstallationError('unknown-method', `No such command: ${method}`);
    const cat = (await inst.catalog()) as unknown as Record<string, unknown>;
    const parts = path.split('.');
    const target = parts.length === 1 ? cat : (cat[parts[0]!] as Record<string, unknown>);
    const fn = target[parts[parts.length - 1]!] as (...a: unknown[]) => Promise<{ ok: boolean; value?: unknown; error?: { kind: string; message: string } }>;
    const r = await fn(...args);
    if (!r.ok) throw new InstallationError(r.error!.kind, r.error!.message);
    return r.value;
  }
  if (!(METHODS as readonly string[]).includes(method)) throw new InstallationError('unknown-method', `No such command: ${method}`);
  const fn = (inst as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!;
  return fn.apply(inst, args);
}

export class AdminUnavailableError extends Error {}

export interface AdminClient {
  call<T = unknown>(method: string, ...args: unknown[]): Promise<T>;
}

/** The running node's admin channel for `home`, or null when no `wyatt serve` runs there. */
export async function connectAdmin(home: string): Promise<AdminClient | null> {
  let info: AdminFile;
  try {
    info = JSON.parse(await readFile(join(homeDirs(home).root, 'admin.json'), 'utf8')) as AdminFile;
  } catch {
    return null;
  }
  try {
    process.kill(info.pid, 0);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') return null;
  }
  return {
    async call<T>(method: string, ...args: unknown[]): Promise<T> {
      let res: Response;
      try {
        res = await fetch(`http://127.0.0.1:${info.port}/rpc`, {
          method: 'POST', headers: { authorization: `Bearer ${info.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ method, args }),
        });
      } catch (err) {
        throw new AdminUnavailableError(`The running node did not answer on its admin channel: ${describeThrown(err)}`);
      }
      const body = (await res.json()) as { value?: T; error?: { code: string; message: string; retryable?: boolean } };
      if (body.error) throw new InstallationError(body.error.code, body.error.message, body.error.retryable ?? false);
      return body.value as T;
    },
  };
}
