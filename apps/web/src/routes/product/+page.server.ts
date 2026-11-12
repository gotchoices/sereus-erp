/** FamilyList (design/generated/web/screens/FamilyList.md). */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { FamilyFilter, FamilyStatus } from '@wyatt/core/catalog';
import { backendFor } from '$lib/server/data';
import { familyCreateError } from '$lib/errors';

export const load: PageServerLoad = async ({ url }) => {
	const { catalog } = await backendFor(url);
	const text = url.searchParams.get('q') ?? '';
	const classPrefix = url.searchParams.get('class') ?? '';
	const status = url.searchParams.get('status') ?? 'active';
	const filter: FamilyFilter = {};
	if (text) filter.text = text;
	if (classPrefix) filter.classPrefix = classPrefix;
	if (status !== 'all') filter.status = status as FamilyStatus;

	const [families, classes, units, all] = await Promise.all([
		catalog.families.list(filter), catalog.classes.list(), catalog.units.list(), catalog.families.list(),
	]);
	const failed = [families, classes, units, all].find((r) => !r.ok);
	if (failed && !failed.ok) return { error: failed.error.message, families: [], classes: [], units: [], total: 0, filter: { text, classPrefix, status } };
	return {
		error: null,
		families: families.ok ? families.value : [],
		classes: classes.ok ? classes.value : [],
		units: units.ok ? units.value : [],
		total: all.ok ? all.value.length : 0,
		created: url.searchParams.get('created'),
		filter: { text, classPrefix, status },
	};
};

export const actions: Actions = {
	create: async ({ request, url }) => {
		const form = await request.formData();
		const input = {
			base: String(form.get('base') ?? '').trim(),
			unitCode: String(form.get('unitCode') ?? ''),
			description: String(form.get('description') ?? '').trim(),
		};
		const { catalog } = await backendFor(url);
		const r = await catalog.families.create(input);
		if (!r.ok) return fail(400, { error: familyCreateError(r.error, input), values: input });
		const keep = url.searchParams.get('variant');
		redirect(303, `/product?created=${encodeURIComponent(r.value.base)}${keep ? `&variant=${keep}` : ''}`);
	},
};
