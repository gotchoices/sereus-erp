/** VersionView (design/generated/web/screens/VersionView.md). */
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { MinorChange } from '@wyatt/core/catalog';
import { backendFor } from '$lib/server/data';
import { errorText } from '$lib/errors';

export const load: PageServerLoad = async ({ params, url }) => {
	const { catalog } = await backendFor(url);
	const family = await catalog.families.get(params.base);
	if (!family.ok) error(family.error.kind === 'not-found' ? 404 : 503, family.error.message);
	const ver = Number(params.ver);
	const minorParam = url.searchParams.get('minor');
	const v = await catalog.versions.get(family.value.id, ver, minorParam === null ? {} : { asOfMinor: Number(minorParam) });
	if (!v.ok) error(v.error.kind === 'not-found' ? 404 : 503, v.error.message);
	if (v.value.state === 'draft') error(404, `Version ${ver} of ${family.value.base} is still a draft`);
	return { family: family.value, version: v.value };
};

export const actions: Actions = {
	revise: async ({ params, request, url }) => {
		const form = await request.formData();
		let change: MinorChange;
		try {
			change = JSON.parse(String(form.get('change') ?? ''));
		} catch {
			return fail(400, { error: 'The revision could not be read; nothing was recorded.' });
		}
		const { catalog } = await backendFor(url);
		const fam = await catalog.families.get(params.base);
		if (!fam.ok) return fail(404, { error: errorText(fam.error) });
		const r = await catalog.versions.revise(fam.value.id, Number(params.ver), change);
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		return { minor: r.value };
	},
};
