#!/usr/bin/env node
/**
 * `wyatt`: set up and run a WyattERP machine without a browser (a server, a closet machine), and
 * manage the installation from a terminal. The same rules as the web app's Settings
 * (design/specs/domain/deployment.md); the same installation code (@wyatt/node).
 *
 * While `wyatt serve` runs, every other command goes to it over its admin channel; otherwise the
 * command opens the folder itself for as long as it runs. See apps/cli/README.md.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES } from '@wyatt/core';
import {
  connectAdmin, defaultNetwork, fingerprint, Installation, InstallationError, serveAdmin,
  type MachineReport, type NetworkSettings, type StatusReport,
} from '@wyatt/node';
import { parseArgs, type Parsed } from './args.js';
import * as out from './output.js';

const HELP = `wyatt: run and manage a WyattERP installation from a terminal

usage: wyatt [--home <dir>] <command> [options]

  --home <dir>   this machine's WyattERP folder (default: $WYATT_HOME, else ~/.wyatt)
  --json         print results as JSON

Set up this machine (once):
  init new --name <machine> --company <name> [--catalog <name>] [--purpose <text>]
           [--no-starter] [--public <host>] [--port <n>] [--desktop]
                               start a new installation: this machine founds it and holds an
                               owner key; the catalog gets a starting set of units and classes
  init join <invitation> --name <machine> [--owner-grant <grant>] [--public <host>] [--port <n>]
                               join an existing installation with an invitation from an owner

Run:
  serve                        run this machine's node until stopped (Ctrl-C)
  service [--system]           print a service definition that runs "wyatt serve" at boot

See and manage:
  status                       this machine, its connections and strands
  machines                     the installation's machines
  invite [--label <name>] [--days <n>]
                               an invitation for another machine (default 7 days)
  invitations                  invitations made here, and whether they were used
  withdraw <key>               withdraw an invitation
  remove-machine <name|id> [--accept-loss]
                               remove a machine from the installation
  name-machine <name|id> <new name>
  owner-keys                   the owner keys
  owner-grant --label <text> [--backup]
                               a grant that makes whoever redeems it an owner; --backup never
                               expires, a recovery key to keep offline
  redeem-grant <grant>         make this machine an owner with a grant
  export-owner-key [--passphrase-file <file>]
                               this machine's owner key as text, on stdout
  import-owner-key [--passphrase-file <file>] < key.txt
  remove-owner-key <fingerprint>
  strands                      the catalogs this machine holds
  found --name <name> [--purpose <text>] [--no-starter]
                               found another catalog strand
  use <strand>                 choose the catalog this machine works in
  export [<file>]              export the catalog to a YAML file (default stdout)
  restore <file> [--yes]       restore an export into this (empty) catalog

Read the catalog:
  units | classes | operations | families | family <base> | parts [<base>]
  modules                      the modules of WyattERP and their strands
`;

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const home = resolve(String(args.opts.home ?? process.env.WYATT_HOME ?? `${homedir()}/.wyatt`));
  const json = Boolean(args.opts.json);
  const [command = 'help', ...rest] = args.positional;
  switch (command) {
    case 'help': case '--help': case '-h':
      process.stdout.write(HELP);
      return 0;
    case 'modules':
      for (const m of MODULES) console.log(`${m.key.padEnd(8)} ${m.strand.padEnd(15)} ${m.sApp.padEnd(6)} ${m.initial ? 'start' : 'later'}  ${m.title}`);
      return 0;
    case 'init':
      return init(home, rest, args, json);
    case 'serve':
      return serve(home);
    case 'service':
      return service(home, args);
    default:
      return command in COMMANDS ? withInstallation(home, (call) => COMMANDS[command]!(call, rest, args, json)) : unknown(command);
  }
}

function unknown(command: string): number {
  console.error(`wyatt: unknown command "${command}". Run "wyatt help".`);
  return 2;
}

// ── Setting up ─────────────────────────────────────────────────────────────────

async function init(home: string, rest: string[], args: Parsed, json: boolean): Promise<number> {
  const [how, credential] = rest;
  if (await connectAdmin(home)) throw new InstallationError('running', `wyatt serve is running on ${home}; this machine is already set up.`);
  const network = networkFrom(args);
  const inst = await Installation.open({ home, network, log: (l) => console.error(`• ${l}`) });
  try {
    if (inst.phase !== 'new') throw new InstallationError('already-set-up', `${home} is already set up. "wyatt status" shows it; to start over, delete that folder.`);
    let status: StatusReport;
    if (how === 'new') {
      status = await inst.startNew({
        machineLabel: need(args, 'name'), company: need(args, 'company'),
        catalogName: str(args, 'catalog') ?? 'Catalog', purpose: str(args, 'purpose') ?? '', starter: !args.opts['no-starter'],
      });
      if (json) return out.json(status);
      console.log(`Started a new installation in ${home}.`);
      console.log(`This machine, "${status.machineLabel}", holds its only owner key. Make a recovery key now and keep it offline:`);
      console.log('  wyatt owner-grant --label "recovery" --backup > recovery.txt');
    } else if (how === 'join') {
      if (!credential) throw new InstallationError('invalid', 'Give the invitation: wyatt init join "<invitation>" --name <machine>');
      console.error('• joining; this waits for a machine of the installation to answer (up to 3 minutes)');
      status = await inst.join({ invitation: credential, machineLabel: need(args, 'name'), ...(str(args, 'owner-grant') ? { ownerGrant: str(args, 'owner-grant')! } : {}) });
      if (json) return out.json(status);
      console.log(`Joined the installation${status.owner ? ' as an owner' : ''}. The catalog copies when the node runs.`);
    } else {
      throw new InstallationError('invalid', 'wyatt init new … or wyatt init join <invitation> …');
    }
    console.log('Next: run "wyatt serve" (or install it as a service: "wyatt service").');
    return 0;
  } finally {
    await inst.stop();
  }
}

function networkFrom(args: Parsed): NetworkSettings {
  const role = args.opts.desktop ? 'desktop' : 'server';
  const port = args.opts.port !== undefined ? Number(args.opts.port) : undefined;
  return defaultNetwork(role, {
    ...(port !== undefined ? { port } : {}),
    ...(args.opts['no-ws'] ? { wsPort: null } : {}),
    ...(str(args, 'public') ? { publicHost: str(args, 'public')! } : {}),
  });
}

// ── Running ────────────────────────────────────────────────────────────────────

async function serve(home: string): Promise<number> {
  const inst = await Installation.open({ home, log: (l) => console.log(`${new Date().toISOString()} ${l}`) });
  if (inst.phase === 'new') {
    await inst.stop();
    throw new InstallationError('not-set-up', `${home} is not set up. Run "wyatt init new …" or "wyatt init join …" first.`);
  }
  const admin = await serveAdmin(inst);
  const s = await inst.status();
  console.log(`WyattERP machine "${s.machineLabel}" (${s.peerId}) is running.`);
  console.log(`  folder:    ${home}`);
  console.log(`  party:     ${s.partyId}${s.owner ? ' (this machine is an owner)' : ''}`);
  for (const a of s.addresses) console.log(`  reachable: ${a}`);
  if (s.network?.announce.length === 0 && s.network.relayServer) {
    console.log('  note: no public address is announced; machines elsewhere reach this one only if they can dial the addresses above (see "--public").');
  }
  let lastLine = '';
  const timer = setInterval(() => {
    void inst.status().then((st) => {
      const line = `${st.phase}; ${st.connected} machine(s) connected; ${st.strands.map((x) => `${x.name ?? x.id.slice(0, 8)} ${x.writable ? 'ready' : x.state}`).join(', ') || 'no strands yet'}`;
      if (line !== lastLine) console.log(`${new Date().toISOString()} ${line}`);
      lastLine = line;
    }).catch(() => {});
  }, 5_000);
  await new Promise<void>((done) => {
    for (const sig of ['SIGINT', 'SIGTERM'] as const) process.once(sig, () => done());
  });
  clearInterval(timer);
  console.log('stopping…');
  await admin.close();
  await inst.stop();
  return 0;
}

function service(home: string, args: Parsed): number {
  const main = fileURLToPath(import.meta.url);
  const node = process.execPath;
  if (process.platform === 'darwin') {
    console.log(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>org.wyatterp.node</string>
  <key>ProgramArguments</key><array><string>${node}</string><string>${main}</string><string>--home</string><string>${home}</string><string>serve</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${home}/serve.log</string>
  <key>StandardErrorPath</key><string>${home}/serve.log</string>
</dict></plist>`);
    console.error('\nInstall: wyatt service > ~/Library/LaunchAgents/org.wyatterp.node.plist && launchctl load ~/Library/LaunchAgents/org.wyatterp.node.plist');
    return 0;
  }
  const system = Boolean(args.opts.system);
  console.log(`[Unit]
Description=WyattERP machine (${home})
After=network-online.target
Wants=network-online.target

[Service]
${system ? `User=${process.env.USER ?? 'wyatt'}\n` : ''}ExecStart=${node} ${main} --home ${home} serve
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=${system ? 'multi-user.target' : 'default.target'}`);
  console.error(system
    ? '\nInstall: wyatt service --system | sudo tee /etc/systemd/system/wyatt.service >/dev/null && sudo systemctl daemon-reload && sudo systemctl enable --now wyatt'
    : '\nInstall: mkdir -p ~/.config/systemd/user && wyatt service > ~/.config/systemd/user/wyatt.service && systemctl --user daemon-reload && systemctl --user enable --now wyatt && sudo loginctl enable-linger $USER');
  return 0;
}

// ── Commands over a running or opened installation ─────────────────────────────

type Call = <T = unknown>(method: string, ...args: unknown[]) => Promise<T>;
type Command = (call: Call, rest: string[], args: Parsed, json: boolean) => Promise<number>;

/** Run a command through `wyatt serve`'s admin channel, or on the folder opened for the command. */
async function withInstallation(home: string, run: (call: Call) => Promise<number>): Promise<number> {
  const admin = await connectAdmin(home);
  if (admin) return run((method, ...a) => admin.call(method, ...a));
  const inst = await Installation.open({ home, log: (l) => console.error(`• ${l}`) });
  try {
    if (inst.phase === 'new') throw new InstallationError('not-set-up', `${home} is not set up. Run "wyatt init new …" or "wyatt init join …".`);
    console.error('• (wyatt serve is not running; this command started the node for itself)');
    const local: Call = async <T>(method: string, ...a: unknown[]): Promise<T> => {
      if (method.startsWith('catalog.')) {
        const [group, op] = method.slice(8).split('.');
        const cat = (await inst.catalog()) as unknown as Record<string, Record<string, (...x: unknown[]) => Promise<{ ok: boolean; value?: T; error?: { kind: string; message: string } }>>>;
        const fn = op ? cat[group!]![op]! : (cat[group!] as unknown as (...x: unknown[]) => Promise<{ ok: boolean; value?: T; error?: { kind: string; message: string } }>);
        const r = await fn(...a);
        if (!r.ok) throw new InstallationError(r.error!.kind, r.error!.message);
        return r.value as T;
      }
      return (inst as unknown as Record<string, (...x: unknown[]) => Promise<T>>)[method]!(...a);
    };
    return await run(local);
  } finally {
    await inst.stop();
  }
}

async function machineId(call: Call, ref: string | undefined): Promise<MachineReport> {
  if (!ref) throw new InstallationError('invalid', 'Name the machine (its name or peer ID).');
  const all = await call<MachineReport[]>('machines');
  const hit = all.filter((m) => m.peerId === ref || m.label === ref || m.peerId.endsWith(ref));
  if (hit.length !== 1) throw new InstallationError('unknown-machine', hit.length ? `"${ref}" names several machines; use the peer ID.` : `No machine "${ref}". "wyatt machines" lists them.`);
  return hit[0]!;
}

const COMMANDS: Record<string, Command> = {
  async status(call, _r, _a, json) {
    const s = await call<StatusReport>('status');
    if (json) return out.json(s);
    out.status(s);
    return 0;
  },

  async machines(call, _r, _a, json) {
    const m = await call<MachineReport[]>('machines');
    if (json) return out.json(m);
    out.table(['', 'name', 'peer ID', 'connected', 'last heard'], m.map((x) => [
      x.self ? '*' : '', x.label ?? '(unnamed)', x.peerId, x.connected ? 'yes' : 'no', x.lastHeard ? new Date(x.lastHeard).toISOString() : '',
    ]));
    return 0;
  },

  async invite(call, _r, args, json) {
    const days = Number(args.opts.days ?? 7);
    const inv = await call<{ invitation: string; expiresAt: string | null; reach: string }>('invite', { label: str(args, 'label'), ttlMs: days * 86_400_000 });
    if (json) return out.json(inv);
    process.stdout.write(inv.invitation + '\n');
    console.error(`\nAn invitation for one machine${str(args, 'label') ? ` ("${str(args, 'label')}")` : ''}, valid until ${inv.expiresAt ?? 'used'}.`);
    console.error('Whoever holds it can join this installation: send it privately.');
    console.error('Use it on the new machine: the web app\'s "Join an existing installation" page, or "wyatt init join \'<invitation>\' --name <machine>".');
    if (inv.reach === 'issuer-only') console.error('Only this machine can admit it: keep it running until the new machine has joined.');
    return 0;
  },

  async invitations(call, _r, _a, json) {
    const list = await call<Array<{ key: string; label: string | null; expiresAt: string | null; live: boolean; withdrawn: boolean; used: number }>>('invitations');
    if (json) return out.json(list);
    out.table(['key', 'for', 'expires', 'state'], list.map((i) => [
      i.key.slice(0, 12), i.label ?? '', i.expiresAt ?? '', i.withdrawn ? 'withdrawn' : i.used ? 'used' : i.live ? 'waiting' : 'expired',
    ]));
    return 0;
  },

  async withdraw(call, rest) {
    const list = await call<Array<{ key: string }>>('invitations');
    const key = list.find((i) => i.key.startsWith(rest[0] ?? '\u0000'))?.key;
    if (!key) throw new InstallationError('unknown', 'No such invitation. "wyatt invitations" lists them.');
    console.log((await call<boolean>('withdrawInvitation', key)) ? 'Withdrawn.' : 'It was already withdrawn.');
    return 0;
  },

  async 'remove-machine'(call, rest, args) {
    const m = await machineId(call, rest[0]);
    const r = await call<{ removed: boolean; pending: string[] }>('removeMachine', m.peerId, { acceptLoss: Boolean(args.opts['accept-loss']) });
    console.log(r.removed ? `Removed "${m.label ?? m.peerId}". Its owner key, if it held one, stays until removed with "wyatt remove-owner-key".` : 'It was already removed.');
    return 0;
  },

  async 'name-machine'(call, rest) {
    const m = await machineId(call, rest[0]);
    if (!rest[1]) throw new InstallationError('invalid', 'Give the new name.');
    await call('nameMachine', m.peerId, rest[1]);
    console.log(`Named "${rest[1]}".`);
    return 0;
  },

  async 'owner-keys'(call, _r, _a, json) {
    const keys = await call<Array<{ key: string; fingerprint: string; label: string | null; heldHere: boolean }>>('ownerKeys');
    if (json) return out.json(keys);
    out.table(['fingerprint', 'label', 'held here'], keys.map((k) => [k.fingerprint, k.label ?? '', k.heldHere ? 'yes' : '']));
    if (keys.length === 1) console.error('\nThere is only one owner key. Make a recovery key: wyatt owner-grant --label "recovery" --backup');
    return 0;
  },

  async 'owner-grant'(call, _r, args, json) {
    const g = await call<{ grant: string; expires: string; reach: string }>('ownerGrant', { label: need(args, 'label'), backup: Boolean(args.opts.backup) });
    if (json) return out.json(g);
    process.stdout.write(g.grant + '\n');
    console.error(`\nWhoever redeems this becomes an owner of the installation. Expires: ${g.expires}.`);
    console.error(args.opts.backup ? 'Keep it offline, as carefully as a key.' : 'Redeem it with "wyatt redeem-grant" on a member machine, or with "wyatt init join" on a new one.');
    return 0;
  },

  async 'redeem-grant'(call, rest) {
    if (!rest[0]) throw new InstallationError('invalid', 'Give the grant.');
    await call('redeemOwnerGrant', rest[0]);
    console.log('This machine is now an owner.');
    return 0;
  },

  async 'export-owner-key'(call, _r, args) {
    const passphrase = await passphraseFrom(args);
    const r = await call<{ text: string; fingerprint: string }>('exportOwnerKey', { ...(passphrase ? { passphrase } : {}) });
    process.stdout.write(r.text + '\n');
    console.error(`\nOwner key ${r.fingerprint}. Whoever holds this text is an owner${passphrase ? ' (it is locked with your passphrase)' : ''}.`);
    return 0;
  },

  async 'import-owner-key'(call, rest, args) {
    const text = rest[0] && rest[0] !== '-' ? rest[0] : await readStdin();
    const r = await call<{ fingerprint: string; wired: boolean }>('importOwnerKey', text, await passphraseFrom(args));
    console.log(`Imported owner key ${r.fingerprint}${r.wired ? '; this machine now signs as an owner.' : '; it is not (yet) an owner of this installation.'}`);
    return 0;
  },

  async 'remove-owner-key'(call, rest) {
    const keys = await call<Array<{ key: string }>>('ownerKeys');
    const key = keys.find((k) => k.key === rest[0] || fingerprint(k.key) === rest[0])?.key;
    if (!key) throw new InstallationError('unknown', 'No such owner key. "wyatt owner-keys" lists them.');
    await call('removeOwnerKey', key);
    console.log('Removed.');
    return 0;
  },

  async strands(call, _r, _a, json) {
    const s = await call<StatusReport>('status');
    if (json) return out.json(s.strands);
    out.strands(s);
    return 0;
  },

  async found(call, _r, args, json) {
    const s = await call('foundCatalog', { name: need(args, 'name'), purpose: str(args, 'purpose') ?? '', starter: !args.opts['no-starter'] });
    if (json) return out.json(s);
    console.log('Founded. Every machine of the installation picks it up. "wyatt use <strand>" to work in it here.');
    return 0;
  },

  async use(call, rest) {
    const s = await call<StatusReport>('status');
    const hit = s.strands.filter((x) => x.id.startsWith(rest[0] ?? '\u0000') || x.name === rest[0]);
    if (hit.length !== 1) throw new InstallationError('unknown-strand', 'Name one strand (its name or the start of its ID). "wyatt strands" lists them.');
    await call('useStrand', hit[0]!.id);
    console.log(`This machine now works in "${hit[0]!.name ?? hit[0]!.id}".`);
    return 0;
  },

  async export(call, rest) {
    const r = await call<{ yaml: string; families: number; parts: number; partNumbers: number }>('exportCatalog');
    if (rest[0] && rest[0] !== '-') {
      await writeFile(rest[0], r.yaml, { mode: 0o600 });
      console.log(`Wrote ${rest[0]}: ${r.families} families, ${r.parts} parts, ${r.partNumbers} part numbers.`);
    } else {
      process.stdout.write(r.yaml);
    }
    return 0;
  },

  async restore(call, rest, args) {
    if (!rest[0]) throw new InstallationError('invalid', 'Give the export file.');
    const text = await readFile(rest[0], 'utf8');
    const d = await call<{ families: number; parts: number; partNumbers: number; exportedAt: string; name: string | null; company: string | null }>('describeExport', text);
    console.log(`${rest[0]}: ${d.company ?? ''} ${d.name ?? ''}, exported ${d.exportedAt}: ${d.families} families, ${d.parts} parts, ${d.partNumbers} part numbers.`);
    if (!args.opts.yes) {
      console.log('Restore goes only into a catalog with no families yet. Run again with --yes to restore.');
      return 1;
    }
    const r = await call<{ counts: Record<string, number> }>('restoreCatalog', text);
    console.log(`Restored: ${Object.entries(r.counts).map(([t, n]) => `${n} ${t}`).join(', ')}.`);
    return 0;
  },

  async units(call, _r, _a, json) {
    const u = await call<Array<{ code: string; name: string; dimension: string; scale: number; factorNum: number | null; factorDen: number | null }>>('catalog.units.list');
    if (json) return out.json(u);
    out.table(['code', 'name', 'dimension', 'decimals', 'factor'], u.map((x) => [x.code, x.name, x.dimension, String(x.scale), x.factorNum ? `${x.factorNum}/${x.factorDen}` : '']));
    return 0;
  },

  async classes(call, _r, _a, json) {
    const c = await call<Array<{ prefix: string; name: string; kind: string }>>('catalog.classes.list');
    if (json) return out.json(c);
    out.table(['prefix', 'name', 'kind'], c.map((x) => [x.prefix, x.name, x.kind]));
    return 0;
  },

  async operations(call, _r, _a, json) {
    const o = await call<Array<{ code: string; description: string }>>('catalog.operations.list');
    if (json) return out.json(o);
    out.table(['code', 'description'], o.map((x) => [x.code, x.description]));
    return 0;
  },

  async families(call, _r, _a, json) {
    const f = await call<Array<{ base: string; description: string; currentVer: number | null; draftVer: number | null; status: string }>>('catalog.families.list');
    if (json) return out.json(f);
    out.table(['family', 'description', 'current', 'draft', 'status'], f.map((x) => [x.base, x.description, x.currentVer ? `v${x.currentVer}` : '', x.draftVer ? `v${x.draftVer}` : '', x.status]));
    return 0;
  },

  async family(call, rest, _a, json) {
    if (!rest[0]) throw new InstallationError('invalid', 'Give the family, for example a:frame.');
    const f = await call<{ id: string; base: string }>('catalog.families.get', rest[0]);
    const v = await call('catalog.versions.get', f.id);
    if (json) return out.json({ family: f, version: v });
    out.yaml({ family: f, version: v });
    return 0;
  },

  async parts(call, rest, _a, json) {
    let filter: { familyId?: string } = {};
    if (rest[0]) filter = { familyId: (await call<{ id: string }>('catalog.families.get', rest[0])).id };
    const p = await call<Array<{ partname: string; pnum: number | null; status: string }>>('catalog.parts.list', filter);
    if (json) return out.json(p);
    out.table(['part number', 'partname', 'status'], p.map((x) => [x.pnum ? String(x.pnum) : '(none yet)', x.partname, x.status]));
    return 0;
  },
};

// ── Small helpers ──────────────────────────────────────────────────────────────

function str(args: Parsed, name: string): string | undefined {
  const v = args.opts[name];
  return typeof v === 'string' ? v : undefined;
}

function need(args: Parsed, name: string): string {
  const v = str(args, name);
  if (!v?.trim()) throw new InstallationError('invalid', `--${name} is required.`);
  return v;
}

async function passphraseFrom(args: Parsed): Promise<string | undefined> {
  const file = str(args, 'passphrase-file');
  if (file) return (await readFile(file, 'utf8')).trim();
  return process.env.WYATT_PASSPHRASE?.trim() || undefined;
}

async function readStdin(): Promise<string> {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text.trim();
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    if (err instanceof InstallationError) console.error(`wyatt: ${err.message}`);
    else console.error('wyatt:', err instanceof Error ? (process.env.WYATT_DEBUG ? err.stack : err.message) : err);
    process.exit(1);
  },
);
