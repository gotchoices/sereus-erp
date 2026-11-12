/** The approve action shared by PartList and FamilyDetail (design/generated/web/screens/PartList.md). */
import { fail, redirect } from '@sveltejs/kit';
import { formatPartname } from '@wyatt/domain';
import { backendFor } from './data';
import { partHref } from '$lib/links';

export async function approve(request: Request, url: URL) {
	const form = await request.formData();
	const base = String(form.get('base') ?? '');
	const values = form.getAll('value').map(String);
	const { catalog } = await backendFor(url);
	const r = await catalog.parts.create(base, values);
	const keep = url.searchParams.get('variant') ? `variant=${url.searchParams.get('variant')}` : '';
	if (r.ok) redirect(303, partHref(r.value.id, keep));
	const e = r.error;
	let error = e.message;
	let existing: string | null = null;
	if (e.kind === 'refused' && e.rule === 'PartCombination') {
		const canon = await catalog.parts.canonical(base, values);
		const name = canon.ok ? formatPartname(base, canon.value) : formatPartname(base, values);
		const found = await catalog.parts.get({ partname: name });
		existing = found.ok ? found.value.id : null;
		error = `${name} is already a part.`;
	} else if (e.kind === 'refused' && e.rule === 'PartKind') {
		error = 'Packages are sold, not stocked: they are not approved as parts.';
	} else if (e.kind === 'refused' && e.rule === 'NoCurrentVersion') {
		error = 'Release a version of the family first.';
	}
	return fail(400, { approveError: error, existing, base, values });
}
