/** PartList (design/generated/web/screens/PartList.md). */
import type { Actions, PageServerLoad } from './$types';
import type { PartStatus } from '@wyatt/core/catalog';
import { backendFor } from '$lib/server/data';
import { approve } from '$lib/server/approve';

export const load: PageServerLoad = async ({ url }) => {
	const { catalog } = await backendFor(url);
	const text = (url.searchParams.get('q') ?? '').trim();
	const familyBase = url.searchParams.get('family') ?? '';
	const status = url.searchParams.get('status') ?? '';
	const [families, classes] = await Promise.all([catalog.families.list(), catalog.classes.list()]);
	if (!families.ok) return { error: families.error.message, parts: [], families: [], approvable: [], total: 0, filter: { text, familyBase, status } };
	const fam = families.value.find((f) => f.base === familyBase);
	const [parts, all] = await Promise.all([
		catalog.parts.list({ ...(fam ? { familyId: fam.id } : {}), ...(status ? { status: status as PartStatus } : {}) }),
		catalog.parts.list(),
	]);
	if (!parts.ok) return { error: parts.error.message, parts: [], families: [], approvable: [], total: 0, filter: { text, familyBase, status } };
	const t = text.toLowerCase();
	const desc = new Map(families.value.map((f) => [f.id, f.description]));
	const kinds = new Map((classes.ok ? classes.value : []).map((c) => [c.prefix, c.kind]));
	const shown = parts.value
		.filter((p) => !t || p.partname.toLowerCase().includes(t) || String(p.pnum ?? '') === t)
		.sort((a, b) => a.partname.localeCompare(b.partname))
		.map((p) => ({ ...p, familyDescription: desc.get(p.familyId) ?? '' }));
	return {
		error: null,
		parts: shown,
		total: all.ok ? all.value.length : shown.length,
		families: families.value.filter((f) => (all.ok ? all.value : []).some((p) => p.familyId === f.id)).map((f) => ({ base: f.base, description: f.description })),
		approvable: families.value
			.filter((f) => f.currentVer !== null && f.status !== 'obsolete' && kinds.get(f.classPrefix) !== 'package')
			.map((f) => ({ base: f.base, description: f.description })),
		filter: { text, familyBase, status },
	};
};

export const actions: Actions = {
	approve: ({ request, url }) => approve(request, url),
};
