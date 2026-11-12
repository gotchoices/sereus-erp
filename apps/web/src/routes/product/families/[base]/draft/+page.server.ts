/** DraftEditor (design/generated/web/screens/DraftEditor.md). */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { DraftDefinition } from '@wyatt/core/catalog';
import { backendFor } from '$lib/server/data';
import { errorText } from '$lib/errors';
import { familyHref, versionHref } from '$lib/links';

export const load: PageServerLoad = async ({ params, url }) => {
	const { catalog } = await backendFor(url);
	const family = await catalog.families.get(params.base);
	if (!family.ok) error(family.error.kind === 'not-found' ? 404 : 503, family.error.message);
	const f = family.value;
	const keep = url.searchParams.get('variant') ? `variant=${url.searchParams.get('variant')}` : '';
	if (f.draftVer === null) redirect(307, familyHref(f.base, keep));
	const [draft, units, operations, families, current] = await Promise.all([
		catalog.versions.get(f.id, f.draftVer), catalog.units.list(), catalog.operations.list(), catalog.families.list(),
		f.currentVer === null ? Promise.resolve(null) : catalog.versions.get(f.id, f.currentVer),
	]);
	if (!draft.ok) error(503, draft.error.message);
	return {
		family: f,
		draft: draft.value,
		current: current && current.ok ? current.value : null,
		units: units.ok ? units.value : [],
		operations: operations.ok ? operations.value : [],
		components: families.ok ? families.value.filter((x) => x.currentVer !== null).map((x) => ({ base: x.base, description: x.description })) : [],
	};
};

export const actions: Actions = {
	save: async ({ params, request, url }) => {
		const form = await request.formData();
		let def: DraftDefinition;
		try {
			def = JSON.parse(String(form.get('definition') ?? ''));
		} catch {
			return fail(400, { error: 'The draft could not be read; nothing was saved.' });
		}
		const { catalog } = await backendFor(url);
		const fam = await catalog.families.get(params.base);
		if (!fam.ok) return fail(404, { error: errorText(fam.error) });
		const r = await catalog.versions.saveDraft(fam.value.id, def);
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		return { saved: new Date().toISOString(), version: r.value };
	},
	release: async ({ params, request, url }) => {
		const form = await request.formData();
		const interchangeable = form.get('interchangeable');
		const compat = String(form.get('compatNotes') ?? '').trim();
		const { catalog } = await backendFor(url);
		const fam = await catalog.families.get(params.base);
		if (!fam.ok) return fail(404, { error: errorText(fam.error) });
		const r = await catalog.versions.release(fam.value.id, {
			changeSummary: String(form.get('changeSummary') ?? ''),
			...(interchangeable ? { interchangeable: interchangeable === 'yes' } : {}),
			compatNotes: compat === '' ? null : compat,
		});
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		const keep = url.searchParams.get('variant') ? `variant=${url.searchParams.get('variant')}` : '';
		redirect(303, versionHref(fam.value.base, r.value.ver, keep));
	},
};
