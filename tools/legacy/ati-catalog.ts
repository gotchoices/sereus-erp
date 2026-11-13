/**
 * Load ATI's 2014 product tables (the local, git-ignored extract: docs/legacy/data-2014.md) into
 * a WyattERP catalog, through `CatalogModel`, so every row passes the same rules as an engineer's
 * edit. This file holds no ATI data; it reads the extract at run time.
 *
 * It is a volume and browse test, never working data (STATUS.md C3). Its mapping decisions are
 * listed in tools/legacy/README.md. In short:
 *   - units: ATI's spellings folded into a few codes (pc., .pc, pc → ea); parameter units with
 *     no dimension in the catalog (V, AWG, tpi…) are imported as `count` units and reported;
 *   - families: created with parameters and routing, then BOM lines, then released in
 *     dependency order; a family whose lines cannot be released (a child not released, a
 *     child-parameter count that does not match, a cycle) stays a draft;
 *   - expressions and scripts stay as written: they are Tcl, which the BOM engine does not run yet;
 *   - parts keep ATI's part numbers.
 *
 * Re-running against the same catalog skips what is already there.
 *
 * Only types are imported, so Node runs this file with type stripping and no build.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
	BomLineDef, CatalogModel, ClassKind, Dimension, DraftDefinition, FamilyStatus, ParameterDef, PartFields, PartStatus, ProcessDef,
} from '@wyatt/core/catalog';

type Row = Record<string, string | null>;

/** The rows of a `pg_dump` `COPY … FROM stdin` data file (tools/legacy/pgcopy.py). */
export function* copyRows(path: string): Generator<Row> {
	const text = readFileSync(path, 'latin1');
	let cols: string[] | null = null;
	for (const line of text.split('\n')) {
		if (!cols) {
			if (line.startsWith('COPY ')) cols = line.slice(line.indexOf('(') + 1, line.indexOf(')')).split(',').map((c) => c.trim());
			continue;
		}
		if (line.startsWith('\\.')) return;
		const cells = line.split('\t');
		const row: Row = {};
		cols.forEach((c, i) => (row[c] = unescape(cells[i] ?? null)));
		yield row;
	}
}

const ESC: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', b: '\b', f: '\f', v: '\v' };
function unescape(s: string | null): string | null {
	if (s === null || s === '\\N') return null;
	return s.includes('\\') ? s.replace(/\\(.)/g, (_, c: string) => ESC[c] ?? c) : s;
}

// ── Units ─────────────────────────────────────────────────────────────────────

interface UnitPlan { code: string; name: string; dimension: Dimension; scale: number; factor: string | null }

/** ATI spellings (lowercased, trailing dots dropped) → a catalog unit. Factor: one unit in the dimension's base (m, m², m³, kg, s). */
const KNOWN: Record<string, UnitPlan> = {};
const known = (spellings: string[], plan: UnitPlan) => spellings.forEach((s) => (KNOWN[s] = plan));
known(['pc', '.pc', 'p', 'ea', 'each', '1', 'na', '', 'typ', '12', '50'], { code: 'ea', name: 'each', dimension: 'count', scale: 0, factor: null });
known(['pkg', 'pack'], { code: 'pkg', name: 'package', dimension: 'count', scale: 0, factor: null });
known(['box'], { code: 'box', name: 'box', dimension: 'count', scale: 0, factor: null });
known(['case'], { code: 'case', name: 'case', dimension: 'count', scale: 0, factor: null });
known(['roll'], { code: 'roll', name: 'roll', dimension: 'count', scale: 0, factor: null });
known(['pair'], { code: 'pair', name: 'pair', dimension: 'count', scale: 0, factor: null });
known(['set'], { code: 'set', name: 'set', dimension: 'count', scale: 0, factor: null });
known(['sht'], { code: 'sht', name: 'sheet', dimension: 'count', scale: 0, factor: null });
known(['in', 'inch'], { code: 'in', name: 'inch', dimension: 'length', scale: 3, factor: '0.0254' });
known(['ft', 'lnft', 'feet'], { code: 'ft', name: 'foot', dimension: 'length', scale: 3, factor: '0.3048' });
known(['m'], { code: 'm', name: 'meter', dimension: 'length', scale: 3, factor: '1' });
known(['mm'], { code: 'mm', name: 'millimeter', dimension: 'length', scale: 1, factor: '0.001' });
known(['sqft'], { code: 'sqft', name: 'square foot', dimension: 'area', scale: 3, factor: '0.09290304' });
known(['sqyd'], { code: 'sqyd', name: 'square yard', dimension: 'area', scale: 3, factor: '0.83612736' });
known(['gal'], { code: 'gal', name: 'US gallon', dimension: 'volume', scale: 3, factor: '0.003785411784' });
known(['qt', 'quart'], { code: 'qt', name: 'US quart', dimension: 'volume', scale: 3, factor: '0.000946352946' });
known(['pt'], { code: 'pt', name: 'US pint', dimension: 'volume', scale: 3, factor: '0.000473176473' });
known(['cuft'], { code: 'cuft', name: 'cubic foot', dimension: 'volume', scale: 3, factor: '0.028316846592' });
known(['lb', 'lbs'], { code: 'lb', name: 'pound', dimension: 'mass', scale: 3, factor: '0.45359237' });
known(['g'], { code: 'g', name: 'gram', dimension: 'mass', scale: 1, factor: '0.001' });
known(['volts', 'volt', 'v'], { code: 'V', name: 'volt', dimension: 'count', scale: 3, factor: null });
known(['amps', 'amp', 'a'], { code: 'A', name: 'ampere', dimension: 'count', scale: 3, factor: null });
known(['watts', 'watt', 'w'], { code: 'W', name: 'watt', dimension: 'count', scale: 3, factor: null });

/** The decimal `factor` as an exact fraction. */
function fraction(dec: string): [number, number] {
	const [i, f = ''] = dec.split('.');
	let num = Number(i + f), den = 10 ** f.length;
	const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
	const g = gcd(num, den);
	return [num / g, den / g];
}

// ── Classes ───────────────────────────────────────────────────────────────────

/** ATI's class letters (docs/legacy/ati-mfg-model.md). Unknown letters are imported by letter. */
const CLASS_NAMES: Record<string, string> = {
	'@': 'Packages', a: 'Assemblies', b: 'Hardware', e: 'Electronic', i: 'Sheet metal', m: 'Motion', p: 'Pneumatic',
	r: 'Reeled', s: 'Steel', u: 'Shop supplies', o: 'Other', K: 'Custom',
};
const classKind = (prefix: string): ClassKind => (prefix === '@' ? 'package' : prefix === 'K' ? 'custom' : 'part');

// ── The report ────────────────────────────────────────────────────────────────

export interface ImportReport {
	counts: Record<string, number>;
	/** Problem kind → count, and a few examples (bases or partnames). */
	problems: Record<string, { count: number; examples: string[] }>;
	seconds: number;
}

export interface ImportOptions {
	/** Write a part number as ATI had it. Called once per imported part with a number. */
	issueNumber(partId: string, pnum: number): Promise<void>;
	/** Import only families whose base starts with one of these prefixes, plus everything they use. */
	only?: string[];
	/**
	 * Import a sample for browsing: from each class, the `sample` richest active families (BOM
	 * lines, routing, parameters, parts, documents), plus everything they use. A family whose
	 * use would add more than 40 families is passed over.
	 */
	sample?: number;
	log?(line: string): void;
}

/** Load the extract at `dir` (…/pgdata-2014-Jan-03) into `m`. */
export async function importAtiCatalog(m: CatalogModel, dir: string, opts: ImportOptions): Promise<ImportReport> {
	const started = Date.now();
	const say = opts.log ?? (() => {});
	let lap = Date.now();
	const log = (line: string) => { say(`${line} (${((Date.now() - lap) / 1000).toFixed(1)}s)`); lap = Date.now(); };
	const counts: Record<string, number> = {};
	const problems: ImportReport['problems'] = {};
	const count = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
	const problem = (kind: string, example: string) => {
		const p = (problems[kind] ??= { count: 0, examples: [] });
		p.count++;
		if (p.examples.length < 8) p.examples.push(example);
	};
	const table = (name: string) => [...copyRows(join(dir, `${name}.d`))];

	// Read the tables.
	const bases = new Map(table('prd_base').map((r) => [r.base!, r]));
	const params = group(table('prd_parm'), 'base', 'pos');
	const spread = group(table('prd_spread'), 'base', 'pos');
	const routing = group(table('prd_base_oper'), 'base', 'seq');
	const opers = table('prd_oper');
	const parts = table('prd_part');
	const stdpkg = table('prd_stdpkg');

	// Which families: all, or the chosen prefixes and everything below them.
	const chosen = new Set<string>();
	if (opts.only?.length) {
		const add = (b: string) => {
			if (chosen.has(b) || !bases.has(b)) return;
			chosen.add(b);
			for (const l of spread.get(b) ?? []) add(l.cbase!);
		};
		for (const b of bases.keys()) if (opts.only.some((p) => b.startsWith(p))) add(b);
	} else if (opts.sample) {
		const docs = group(table('prd_doc'), 'base', 'type');
		const partsOf = group(parts, 'base', 'base');
		const cap = (n: number, max: number) => Math.min(n, max);
		const score = (b: string) =>
			3 * cap(spread.get(b)?.length ?? 0, 10) + 2 * cap(routing.get(b)?.length ?? 0, 6)
			+ cap(params.get(b)?.length ?? 0, 4) + cap(partsOf.get(b)?.length ?? 0, 10) + 2 * cap(docs.get(b)?.length ?? 0, 3);
		const closure = (root: string) => {
			const out = new Set<string>();
			const walk = (b: string) => {
				if (out.has(b) || chosen.has(b) || !bases.has(b) || out.size > 40) return;
				out.add(b);
				for (const l of spread.get(b) ?? []) walk(l.cbase!);
			};
			walk(root);
			return out;
		};
		const byClass = new Map<string, string[]>();
		for (const [b, r] of bases) if (r.status !== 'o' && r.status !== 'd') (byClass.get(b[0]!) ?? byClass.set(b[0]!, []).get(b[0]!)!).push(b);
		for (const list of byClass.values()) {
			let taken = 0;
			for (const b of list.sort((x, y) => score(y) - score(x) || x.localeCompare(y))) {
				if (taken >= opts.sample) break;
				if (chosen.has(b)) { taken++; continue; }
				const add = closure(b);
				if (add.size > 40) continue;
				for (const x of add) chosen.add(x);
				taken++;
			}
		}
	} else for (const b of bases.keys()) chosen.add(b);
	for (const b of [...chosen]) {
		if (b.length < 3 || b[1] !== ':' || !/^[A-Za-z0-9_]+$/.test(b.slice(2))) {
			problem('family base not in the catalog format', b);
			chosen.delete(b);
		}
	}

	// 1. Units, classes, operations.
	const unitPlans = new Map<string, UnitPlan>();
	const unitFor = (ati: string | null, fallback: string | null): string | null => {
		const key = (ati ?? '').trim().toLowerCase().replace(/\.+$/, '').replace(/^\.+(?=\D)/, '.');
		if (key === '' && fallback === null) return null;
		let plan = KNOWN[key];
		if (!plan) {
			const code = (ati ?? '').trim().replace(/\.+$/, '').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 12) || 'ea';
			plan = { code, name: `${(ati ?? '').trim()} (from ATI)`, dimension: 'count', scale: 3, factor: null };
			KNOWN[key] = plan;
			problem('unit with no catalog dimension, imported as a count', ati ?? '');
		}
		unitPlans.set(plan.code, plan);
		return plan.code;
	};
	const familyUnit = new Map<string, string>();
	for (const b of chosen) familyUnit.set(b, unitFor(bases.get(b)!.units, 'ea')!);
	const paramDefs = new Map<string, ParameterDef[]>();
	for (const b of chosen) paramDefs.set(b, (params.get(b) ?? []).map((p, i) => parameter(p, i, unitFor, problem, b)));

	const have = await must(m.units.list(), 'units');
	for (const u of unitPlans.values()) {
		if (have.some((h) => h.code === u.code)) continue;
		const [num, den] = u.factor ? fraction(u.factor) : [null, null];
		await must(m.units.put({ code: u.code, name: u.name, dimension: u.dimension, scale: u.scale, factorNum: num, factorDen: den }), `unit ${u.code}`);
		count('units');
	}
	const prefixes = new Set([...chosen].map((b) => b[0]));
	for (const p of prefixes) {
		await must(m.classes.put({ prefix: p, name: CLASS_NAMES[p] ?? `Class ${p} (from ATI)`, kind: classKind(p), storageNotes: null, defaultLocationType: null }), `class ${p}`);
		count('classes');
	}
	const operations = new Map(opers.map((o) => [o.oper!, o.descr ?? o.oper!]));
	for (const b of chosen) for (const l of spread.get(b) ?? []) if (l.oper && !operations.has(l.oper)) operations.set(l.oper, l.oper);
	for (const b of chosen) for (const r of routing.get(b) ?? []) if (r.oper && !operations.has(r.oper)) operations.set(r.oper, r.oper);
	for (const [code, description] of operations) {
		await must(m.operations.put({ code, description }), `operation ${code}`);
		count('operations');
	}
	log(`reference data: ${unitPlans.size} units, ${prefixes.size} classes, ${operations.size} operations`);

	// 2. Families, with parameters and routing (no lines yet: a line names its child, which must exist).
	const existing = new Map((await must(m.families.list(), 'families')).map((f) => [f.base, f]));
	const ids = new Map<string, string>();
	const processes = new Map<string, ProcessDef[]>();
	let n = 0;
	for (const b of chosen) {
		const r = bases.get(b)!;
		const procs = routingOf(routing.get(b) ?? []);
		processes.set(b, procs);
		const found = existing.get(b);
		if (found) { ids.set(b, found.id); continue; }
		const def: Partial<DraftDefinition> = {
			spec: r.spec || null,
			priceFormula: r.price || null,
			explodeDefault: b[0] === '@' ? 'to_part' : 'none',
			parameters: paramDefs.get(b)!,
			processes: procs,
		};
		const res = await m.families.create({ base: b, unitCode: familyUnit.get(b)!, description: r.descr?.trim() || b }, def);
		if (!res.ok) { problem(`family refused: ${res.error.rule ?? res.error.kind}`, `${b}: ${res.error.message}`); continue; }
		ids.set(b, res.value.id);
		count('families');
		if (++n % 500 === 0) log(`families: ${n}`);
	}
	log(`families: ${ids.size} in the catalog`);

	// 3. BOM lines, saved into each draft.
	n = 0;
	for (const b of chosen) {
		const id = ids.get(b);
		const lines = spread.get(b) ?? [];
		if (!id || lines.length === 0) continue;
		const fam = await must(m.families.get(id), b);
		if (fam.draftVer === null) continue; // already released by an earlier run
		const current = await must(m.versions.get(id, fam.draftVer), `${b} draft`);
		if (current.lines.length > 0) continue;
		const procs = [...current.processes];
		const defs: BomLineDef[] = [];
		for (const l of lines) {
			if (!ids.has(l.cbase!)) { problem('line names a family not imported', `${b} → ${l.cbase}`); continue; }
			let processIdx: number | null = null;
			if (l.oper) {
				let p = procs.find((x) => x.operationCode === l.oper);
				if (!p) {
					p = { idx: Math.max(0, ...procs.map((x) => x.idx)) + 1, operationCode: l.oper, nextIdx: null, setupTime: null, laborPerUnit: null, machinePerUnit: null, description: 'From ATI line tags' };
					procs.push(p);
					count('routing steps added for line tags');
				}
				processIdx = p.idx;
			}
			defs.push({
				pos: defs.length + 1, component: l.cbase!, childParams: splitParams(l.cparm), qty: l.quant ?? '1',
				when: null, script: l.script || null, processIdx, childVer: null, comment: l.cmt || null,
			});
		}
		const res = await m.versions.saveDraft(id, { ...current, processes: procs, lines: defs, notes: [], documents: [] });
		if (!res.ok) { problem(`lines refused: ${res.error.rule ?? res.error.kind}`, `${b}: ${res.error.message}`); continue; }
		count('lines', defs.length);
		if (++n % 500 === 0) log(`families with lines: ${n}`);
	}
	log(`lines: ${counts.lines ?? 0}`);

	// 4. Release, children first. A family that cannot be released stays a draft.
	const children = new Map([...chosen].map((b) => [b, new Set((spread.get(b) ?? []).map((l) => l.cbase!).filter((c) => ids.has(c)))]));
	const released = new Set<string>();
	const blocked = new Set<string>();
	for (const [b, f] of existing) if (f.currentVer !== null && chosen.has(b)) released.add(b);
	let progress = true;
	n = 0;
	while (progress) {
		progress = false;
		for (const b of chosen) {
			if (released.has(b) || blocked.has(b) || !ids.has(b)) continue;
			const kids = [...children.get(b)!];
			if (kids.some((c) => blocked.has(c) || !ids.has(c))) { blocked.add(b); problem('not released: a child is not released', b); progress = true; continue; }
			if (kids.some((c) => !released.has(c))) continue;
			const res = await m.versions.release(ids.get(b)!, { changeSummary: 'Imported from ATI (2014)' });
			if (res.ok) { released.add(b); count('released'); if (++n % 500 === 0) log(`released: ${n}`); }
			else { blocked.add(b); problem(`not released: ${res.error.rule ?? res.error.kind}`, `${b}: ${res.error.message}`); }
			progress = true;
		}
	}
	for (const b of chosen) if (ids.has(b) && !released.has(b) && !blocked.has(b)) problem('not released: in a cycle', b);
	log(`released: ${released.size} of ${ids.size}`);

	// 5. Parts, keeping ATI's numbers.
	n = 0;
	for (const p of parts) {
		const b = p.base!;
		if (!chosen.has(b)) continue;
		const name = `${b}(${p.parm ?? ''})`;
		if (!released.has(b)) { problem('part skipped: its family is not released', name); continue; }
		const values = (paramDefs.get(b)?.length ?? 0) === 0 ? [] : (p.parm ?? '').split(',');
		const res = await m.parts.create(b, values, partFields(p));
		if (!res.ok) {
			if (res.error.rule !== 'PartCombination') problem(`part refused: ${res.error.rule ?? res.error.kind}`, `${name}: ${res.error.message}`);
			continue;
		}
		count('parts');
		if (p.pnum) {
			try { await opts.issueNumber(res.value.id, Number(p.pnum)); count('part numbers'); }
			catch (err) { problem('part number refused', `${p.pnum} ${name}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`); }
		}
		if (++n % 1000 === 0) log(`parts: ${n}`);
	}
	log(`parts: ${counts.parts ?? 0}`);

	// 6. Standard packages, then family statuses (last: an obsolete family still releases).
	for (const s of stdpkg) {
		const b = s.base!;
		if (!chosen.has(b)) continue;
		if (!released.has(b)) { problem('standard package skipped: its family is not released', b); continue; }
		const values = (s.parm ?? '').split(',').map((v) => (v === '' ? null : v));
		const res = await m.packages.create(b, s.parm_descr?.trim() || s.parm || b, values, null);
		if (res.ok) count('standard packages');
		else problem(`standard package refused: ${res.error.rule ?? res.error.kind}`, `${b}(${s.parm}): ${res.error.message}`);
	}
	for (const b of chosen) {
		const status = familyStatus(bases.get(b)!.status);
		if (status === 'active' || !ids.has(b)) continue;
		const res = await m.families.update(ids.get(b)!, { status });
		if (res.ok) count(`families ${status}`);
		else problem(`status refused: ${res.error.rule ?? res.error.kind}`, b);
	}

	return { counts, problems, seconds: Math.round((Date.now() - started) / 1000) };
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

function group(rows: Row[], key: string, order: string): Map<string, Row[]> {
	const out = new Map<string, Row[]>();
	for (const r of rows) {
		const k = r[key];
		if (k === null) continue;
		if (!out.has(k)) out.set(k, []);
		out.get(k)!.push(r);
	}
	for (const list of out.values()) list.sort((a, b) => Number(a[order]) - Number(b[order]));
	return out;
}

function parameter(p: Row, i: number, unitFor: (u: string | null, fb: string | null) => string | null, problem: (k: string, e: string) => void, base: string): ParameterDef {
	// eng (engineering notation, 4k7) is kept as text: its values are not plain numbers.
	const type = p.ptyp === 'num' ? 'num' : 'str';
	if (p.ptyp === 'eng') problem('eng parameter imported as text', `${base} ${p.var}`);
	const unitCode = type === 'num' ? unitFor(p.units, 'ea') : null;
	return {
		pos: i + 1, var: p.var || `P${i + 1}`, type, unitCode,
		description: [p.descr?.trim(), type === 'str' && p.units?.trim() ? `(${p.units.trim()})` : ''].filter(Boolean).join(' ') || (p.var ?? ''),
		defaultValue: null, min: null, max: null, allowed: [],
	};
}

/** ATI's routing rows in sequence, numbered 1… with `nxt` mapped to the new numbers. */
function routingOf(rows: Row[]): ProcessDef[] {
	const idx = new Map(rows.map((r, i) => [r.seq!, i + 1]));
	return rows.map((r, i) => ({
		idx: i + 1, operationCode: r.oper!,
		nextIdx: r.nxt && idx.has(r.nxt) ? idx.get(r.nxt)! : null,
		setupTime: r.setuptme ?? null, laborPerUnit: r.runtme_unit ?? null, machinePerUnit: r.machtme_unit ?? null,
		description: r.comments || null,
	}));
}

/** Split a child-parameter list on top-level commas (Tcl `[…]`, `{…}` and `(…)` may hold commas). */
export function splitParams(s: string | null): string[] {
	if (s === null || s.trim() === '') return [];
	const out: string[] = [];
	let depth = 0, cur = '';
	for (const ch of s) {
		if ('([{'.includes(ch)) depth++;
		else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
		if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
	}
	out.push(cur);
	return out.map((x) => x.trim());
}

const familyStatus = (s: string | null): FamilyStatus => (s === 'o' ? 'obsolete' : s === 'd' ? 'restricted' : 'active');

function partFields(p: Row): Partial<PartFields> {
	const num = (v: string | null) => (v === null || v === '' ? null : Number(v));
	const level = Number(p.elevel);
	const status: PartStatus = level < 0 ? 'obsolete' : level === 1 ? 'proposed' : 'active';
	return {
		status, minLevel: num(p.buylev), targetLevel: num(p.reclev), minBuy: num(p.recbuy) || null, // ATI kept 0 for "no minimum"
		weight: num(p.weight), length: num(p.length), width: num(p.width), height: num(p.height),
		stackFactor: num(p.stack), comment: p.cmt || null,
	};
}

async function must<T>(r: Promise<{ ok: true; value: T } | { ok: false; error: { kind: string; rule?: string; message: string } }>, what: string): Promise<T> {
	const res = await r;
	if (!res.ok) throw new Error(`${what}: ${res.error.rule ?? res.error.kind}: ${res.error.message}`);
	return res.value;
}
