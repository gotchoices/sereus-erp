/**
 * Machines of one installation, each a real Sereus node with its own folder, on loopback
 * (STATUS.md slice 7, Q36's common arrangements): a server that starts the installation and a
 * desktop that joins it by invitation; both see each other's writes; owner rights by grant; a
 * third machine joining while the first is offline; removal.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Installation, InstallationError } from './installation.js';
import type { NetworkSettings } from './home.js';

const loopback = (relayServer: boolean): NetworkSettings => ({ listen: ['/ip4/127.0.0.1/tcp/0'], announce: [], relays: [], relayServer });

const homes: string[] = [];
const open: Installation[] = [];
async function machine(name: string, relayServer = false, home?: string): Promise<Installation> {
  const dir = home ?? (await mkdtemp(join(tmpdir(), `wyatt-${name}-`)));
  if (!home) homes.push(dir);
  const inst = await Installation.open({ home: dir, network: loopback(relayServer), log: (l) => console.info(`[${name}] ${l}`) });
  open.push(inst);
  return inst;
}

async function until<T>(read: () => Promise<T | null | undefined | false>, what: string, ms = 120_000): Promise<T> {
  const deadline = Date.now() + ms;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const v = await read();
      if (v) return v;
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${String(last)}` : ''}`);
}

afterAll(async () => {
  for (const i of open) await i.stop().catch(() => {});
  for (const h of homes) await rm(h, { recursive: true, force: true });
});

describe('an installation of several machines', () => {
  let server: Installation;
  let desk: Installation;

  it('starts new with a named catalog and the starting set', async () => {
    server = await machine('server', true);
    expect(server.phase).toBe('new');
    const s = await server.startNew({ machineLabel: 'office server', company: 'Acme', purpose: 'Everything we make' });
    expect(s.phase).toBe('running');
    expect(s.owner).toBe(true);
    expect(s.strands).toHaveLength(1);
    expect(s.strands[0]).toMatchObject({ name: 'Catalog', company: 'Acme', purpose: 'Everything we make', writable: true, current: true });
    const units = await (await server.catalog()).units.list();
    expect(units.ok && units.value.map((u) => u.code)).toContain('mm');
    await expect(server.startNew({ machineLabel: 'again', company: 'x' })).rejects.toBeInstanceOf(InstallationError);
  });

  it('refuses a malformed invitation without setting anything up', async () => {
    desk = await machine('desk');
    await expect(desk.join({ invitation: 'sereus-invite:1.nonsense', machineLabel: 'desk' })).rejects.toMatchObject({ code: 'malformed' });
    expect(desk.phase).toBe('new');
  });

  it('admits a desktop by invitation, which copies the catalog', async () => {
    const inv = await server.invite({ label: 'front desk' });
    expect(inv.invitation).toMatch(/^sereus-invite:/);
    expect((await server.invitations()).find((i) => i.key === inv.key)).toMatchObject({ label: 'front desk', live: true });

    const joined = await desk.join({ invitation: inv.invitation, machineLabel: 'front desk' });
    expect(joined).toMatchObject({ phase: 'running', origin: 'joined', owner: false, canFound: false });
    const status = await until(async () => {
      const s = await desk.status();
      return s.current ? s : null;
    }, 'the catalog on the desktop');
    expect(status.strands[0]).toMatchObject({ name: 'Catalog', company: 'Acme' });

    // Each sees the other's writes.
    const onServer = await server.catalog();
    const fam = await onServer.families.create({ base: 'a:frame', unitCode: 'ea', description: 'Frame' });
    expect(fam.ok).toBe(true);
    const onDesk = await desk.catalog();
    await until(async () => (await onDesk.families.get('a:frame')).ok, 'the server\'s family on the desktop');
    expect((await onDesk.families.create({ base: 'b:bolt', unitCode: 'ea', description: 'Bolt' })).ok).toBe(true);
    await until(async () => (await onServer.families.get('b:bolt')).ok, 'the desktop\'s family on the server');

    // Both machines are listed, by name.
    const machines = await until(async () => {
      const m = await server.machines();
      return m.length === 2 && m.every((x) => x.label) ? m : null;
    }, 'both machines named');
    expect(machines.map((m) => m.label).sort()).toEqual(['front desk', 'office server']);
  });

  it('makes the desktop an owner with a grant', async () => {
    const { grant } = await server.ownerGrant({ label: 'front desk' });
    const keys = await desk.redeemOwnerGrant(grant);
    expect(keys.filter((k) => k.heldHere)).toHaveLength(1);
    expect((await desk.status()).owner).toBe(true);
    expect((await server.ownerKeys()).length).toBe(2);
  });

  it('admits a third machine while the first is offline, and removes it', async () => {
    const inv = await desk.invite({ label: 'laptop' });
    await server.stop();
    const serverHome = server.dirs.root;
    const laptop = await machine('laptop');
    console.info('[test] laptop joining');
    await laptop.join({ invitation: inv.invitation, machineLabel: 'laptop' });
    console.info('[test] laptop joined');
    await until(async () => (await laptop.status()).current, 'the catalog on the laptop');
    await until(async () => (await (await laptop.catalog()).families.get('b:bolt')).ok, 'catalog contents on the laptop');

    console.info('[test] laptop has the catalog');
    // The server comes back and sees the laptop.
    server = await machine('server', true, serverHome);
    expect(server.phase).toBe('running');
    await until(async () => (await server.status()).current, 'the server\'s catalog after its restart');
    const laptopId = (await laptop.status()).peerId!;
    await until(async () => (await server.machines()).some((m) => m.peerId === laptopId), 'the laptop listed on the server');

    console.info('[test] server sees laptop');
    await expect(server.removeMachine((await server.status()).peerId!)).rejects.toMatchObject({ code: 'self' });
    const removed = await server.removeMachine(laptopId);
    expect(removed.removed).toBe(true);
    console.info('[test] laptop removed');
    await until(async () => !(await server.machines()).some((m) => m.peerId === laptopId), 'the laptop gone from the list');
    // The laptop hears of its removal only if the news reaches it before it is cut off (Sereus:
    // "Removing a machine", best effort). Either way it is no longer a member the others trust.
    await until(async () => (await laptop.status()).phase === 'removed' || !(await desk.machines()).some((m) => m.peerId === laptopId), 'the desk to drop the laptop');
    console.info(`[test] laptop phase after removal: ${laptop.phase}`);
  }, 600_000);
});
