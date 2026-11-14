/** Printing for people: tables and the status summary. `--json` bypasses all of it. */
import { stringify } from 'yaml';
import type { StatusReport } from '@wyatt/node';

export function json(value: unknown): number {
  console.log(JSON.stringify(value, null, 2));
  return 0;
}

export function yaml(value: unknown): void {
  process.stdout.write(stringify(value, { lineWidth: 0 }));
}

export function table(head: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log('(none)');
    return;
  }
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (r: string[]) => r.map((c, i) => (c ?? '').padEnd(width[i]!)).join('  ').trimEnd();
  console.log(line(head));
  console.log(line(width.map((w) => '-'.repeat(w))));
  for (const r of rows) console.log(line(r));
}

export function status(s: StatusReport): void {
  console.log(`machine:   ${s.machineLabel ?? '(not set up)'}${s.peerId ? `  (${s.peerId})` : ''}`);
  console.log(`state:     ${s.phase}${s.error ? `: ${s.error}` : ''}`);
  console.log(`folder:    ${s.home}`);
  if (s.partyId) console.log(`party:     ${s.partyId} (${s.origin === 'founded' ? 'started here' : 'joined'})`);
  console.log(`owner:     ${s.owner ? 'yes, this machine holds an owner key' : 'no'}${s.ownerKeyCount === 1 ? '  (only one owner key: make a recovery key)' : ''}`);
  console.log(`connected: ${s.connected} other machine(s)`);
  for (const a of s.addresses) console.log(`reachable: ${a}`);
  strands(s);
}

export function strands(s: StatusReport): void {
  console.log('');
  table(['', 'strand', 'name', 'company', 'state', 'purpose'], s.strands.map((x) => [
    x.current ? '*' : '', x.id.slice(0, 8), x.name ?? '', x.company ?? '', x.writable ? 'ready' : x.state, x.purpose ?? '',
  ]));
  if (s.needsChoice) console.log('\nSeveral catalogs: choose one with "wyatt use <strand>".');
}
