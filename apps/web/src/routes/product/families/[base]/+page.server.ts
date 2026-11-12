/** FamilyDetail (design/generated/web/screens/FamilyDetail.md). */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { backendFor } from '$lib/server/data';
import { errorText } from '$lib/errors';
import { draftHref, familiesHref } from '$lib/links';
import { approve } from '$lib/server/approve';

const keepOf = (url: URL) => (url.searchParams.get('variant') ? `variant=${url.searchParams.get('variant')}` : '');

export const load: PageServerLoad = async ({ params, url }) => {
	const { catalog } = await backendFor(url);
	const family = await catalog.families.get(params.base);
	if (!family.ok) {
		if (family.error.kind === 'not-found') error(404, `No family ${params.base}`);
		error(503, family.error.message);
	}
	const f = family.value;
	const [versions, parts, usedIn, classes, units] = await Promise.all([
		catalog.versions.list(f.id), catalog.parts.list({ familyId: f.id }), catalog.families.whereUsed(f.base),
		catalog.classes.list(), catalog.units.list(),
	]);
	return {
		family: f,
		versions: versions.ok ? versions.value : [],
		parts: parts.ok ? parts.value : [],
		usedIn: usedIn.ok ? usedIn.value : [],
		cls: classes.ok ? classes.value.find((c) => c.prefix === f.classPrefix) ?? null : null,
		unit: units.ok ? units.value.find((u) => u.code === f.unitCode) ?? null : null,
	};
};

export const actions: Actions = {
	startDraft: async ({ params, url }) => {
		const { catalog } = await backendFor(url);
		const fam = await catalog.families.get(params.base);
		if (!fam.ok) return fail(404, { error: errorText(fam.error) });
		const r = await catalog.versions.startDraft(fam.value.id);
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		redirect(303, draftHref(fam.value.base, keepOf(url)));
	},
	discardDraft: async ({ params, url }) => {
		const { catalog } = await backendFor(url);
		const fam = await catalog.families.get(params.base);
		if (!fam.ok) return fail(404, { error: errorText(fam.error) });
		const r = await catalog.versions.discardDraft(fam.value.id);
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		return { done: `Draft v${fam.value.draftVer} discarded.` };
	},
	approve: ({ request, url }) => approve(request, url),
	remove: async ({ params, url }) => {
		const { catalog } = await backendFor(url);
		const fam = await catalog.families.get(params.base);
		if (!fam.ok) return fail(404, { error: errorText(fam.error) });
		const r = await catalog.families.remove(fam.value.id);
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		redirect(303, familiesHref(keepOf(url)));
	},
};
