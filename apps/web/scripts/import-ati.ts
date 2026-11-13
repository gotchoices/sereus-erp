/**
 * Import ATI's 2014 catalog (tools/legacy/ati-catalog.ts) for browsing and volume testing.
 *
 *   yarn import:ati --memory [--only a:,b:]   a dry run into an in-memory catalog: report only
 *   … --sample 5                              each class's 5 richest families and what they use
 *   … --home data/other                       another node folder (default data/wyatt-ati)
 *   yarn import:ati [--only a:,b:]            into the catalog strand of a node kept in
 *                                             data/wyatt-ati/ (git-ignored), then `yarn dev:ati`
 *
 * The node folder is separate from the app's own (.wyatt), so ATI data never lands in the
 * strand used for everyday work, and it has no other members. Stop `yarn dev:ati` first: one
 * process per node folder.
 *
 * Run by Node with type stripping: this file imports .ts sources directly.
 */
import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { importAtiCatalog, type ImportReport } from '../../../tools/legacy/ati-catalog.ts';

const root = resolve(import.meta.dirname, '../../..');
const extract = resolve(root, 'data/ati-2014/pgdata-2014-Jan-03');
const args = process.argv.slice(2);
const memory = args.includes('--memory');
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args[onlyAt + 1]?.split(',').filter(Boolean) : undefined;
const sampleAt = args.indexOf('--sample');
const sample = sampleAt >= 0 ? Number(args[sampleAt + 1]) || 5 : undefined;
const homeAt = args.indexOf('--home');
const home = resolve(root, homeAt >= 0 ? args[homeAt + 1]! : 'data/wyatt-ati');

if (!existsSync(extract)) {
	console.error(`No ATI extract at ${extract}. Re-create it with the recipe in docs/legacy/data-2014.md.`);
	process.exit(1);
}

const log = (line: string) => console.log(`import-ati: ${line}`);
const now = () => new Date().toISOString();
let report: ImportReport;

if (memory) {
	const { openMemoryDb } = await import('@wyatt/core');
	const { CATALOG_SCHEMA, createCatalogModel } = await import('@wyatt/core/catalog');
	const db = await openMemoryDb(CATALOG_SCHEMA);
	const actor = 'ati-import';
	const m = createCatalogModel(db, { actor });
	report = await importAtiCatalog(m, extract, { only, sample, log, issueNumber: (id, pnum) => insertNumber(db, actor, id, pnum) });
} else {
	process.env.WYATT_HOME = home;
	delete process.env.WYATT_SEED;
	log(`node folder ${process.env.WYATT_HOME}`);
	const { runningNode } = await import('../src/lib/server/node.ts');
	const { openStrandCatalog } = await import('@wyatt/core/catalog');
	const running = await runningNode();
	const db = running.node.getStrands().get(running.catalogStrandId)!.database!.getDatabase();
	const actor = running.node.peerId!.toString();
	const m = openStrandCatalog(running.node, running.catalogStrandId);
	try {
		report = await importAtiCatalog(m, extract, { only, sample, log, issueNumber: (id, pnum) => insertNumber(db, actor, id, pnum) });
	} finally {
		await running.stop();
	}
}

const out = resolve(root, `data/ati-import-report${memory ? '-memory' : ''}.json`);
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
log(`done in ${report.seconds}s`);
for (const [k, v] of Object.entries(report.counts)) log(`  ${k}: ${v}`);
log('problems:');
for (const [k, v] of Object.entries(report.problems).sort((a, b) => b[1].count - a[1].count)) log(`  ${v.count}  ${k}`);
log(`report: ${out}`);
process.exit(0);

/** ATI's own part number for an imported part (PartNumber is insert-only, checked like any write). */
async function insertNumber(db: { exec(sql: string, params?: unknown): Promise<unknown> }, actor: string, partId: string, pnum: number): Promise<void> {
	await db.exec(
		'insert into App.PartNumber (Pnum, PartId) with context Actor = :a, Now = :n values (:p, :id)',
		{ a: actor, n: now(), p: pnum, id: partId },
	);
}
