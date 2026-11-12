/** ReferenceData (design/generated/web/screens/ReferenceData.md). */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ClassKind, Dimension, ReferenceUsage } from '@wyatt/core/catalog';

const NONE: ReferenceUsage = { units: {}, classes: {}, operations: {} };
import { backendFor } from '$lib/server/data';
import { errorText } from '$lib/errors';

export const load: PageServerLoad = async ({ url }) => {
	const { catalog } = await backendFor(url);
	const [units, classes, operations, usage] = await Promise.all([
		catalog.units.list(), catalog.classes.list(), catalog.operations.list(), catalog.usage(),
	]);
	const failed = [units, classes, operations, usage].find((r) => !r.ok);
	if (failed && !failed.ok) return { error: failed.error.message, units: [], classes: [], operations: [], usage: NONE };
	return {
		error: null,
		units: units.ok ? units.value : [],
		classes: classes.ok ? classes.value : [],
		operations: operations.ok ? operations.value : [],
		usage: usage.ok ? usage.value : NONE,
	};
};

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const optional = (f: FormData, k: string) => text(f, k) || null;
const intOrNull = (f: FormData, k: string) => (text(f, k) === '' ? null : Number(text(f, k)));
/** The Add row never overwrites: put() inserts or updates, so a new entry's code must be free. */
const taken = (f: FormData, keys: string[], key: string) => text(f, 'mode') === 'new' && keys.includes(key);

export const actions: Actions = {
	unit: async ({ request, url }) => {
		const f = await request.formData();
		const { catalog } = await backendFor(url);
		const existing = await catalog.units.list();
		if (existing.ok && taken(f, existing.value.map((u) => u.code), text(f, 'code'))) return fail(400, { error: `A unit ${text(f, 'code')} already exists.`, at: 'unit:new' });
		const r = await catalog.units.put({
			code: text(f, 'code'), name: text(f, 'name'), dimension: text(f, 'dimension') as Dimension,
			scale: Number(text(f, 'scale') || 0), factorNum: intOrNull(f, 'factorNum'), factorDen: intOrNull(f, 'factorDen'),
		});
		return r.ok ? { saved: `unit:${r.value.code}` } : fail(400, { error: errorText(r.error), at: text(f, 'mode') === 'new' ? 'unit:new' : `unit:${text(f, 'code')}` });
	},
	class: async ({ request, url }) => {
		const f = await request.formData();
		const { catalog } = await backendFor(url);
		const existing = await catalog.classes.list();
		if (existing.ok && taken(f, existing.value.map((c) => c.prefix), text(f, 'prefix'))) return fail(400, { error: `A class ${text(f, 'prefix')} already exists.`, at: 'class:new' });
		const r = await catalog.classes.put({
			prefix: text(f, 'prefix'), name: text(f, 'name'), kind: text(f, 'kind') as ClassKind,
			storageNotes: optional(f, 'storageNotes'), defaultLocationType: optional(f, 'defaultLocationType'),
		});
		return r.ok ? { saved: `class:${r.value.prefix}` } : fail(400, { error: errorText(r.error), at: text(f, 'mode') === 'new' ? 'class:new' : `class:${text(f, 'prefix')}` });
	},
	operation: async ({ request, url }) => {
		const f = await request.formData();
		const { catalog } = await backendFor(url);
		const existing = await catalog.operations.list();
		if (existing.ok && taken(f, existing.value.map((o) => o.code), text(f, 'code'))) return fail(400, { error: `An operation ${text(f, 'code')} already exists.`, at: 'operation:new' });
		const r = await catalog.operations.put({ code: text(f, 'code'), description: text(f, 'description') });
		return r.ok ? { saved: `operation:${r.value.code}` } : fail(400, { error: errorText(r.error), at: text(f, 'mode') === 'new' ? 'operation:new' : `operation:${text(f, 'code')}` });
	},
};
