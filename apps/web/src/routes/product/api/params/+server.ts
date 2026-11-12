/** The parameters of a family's current version, for labeling a BOM line's child inputs (DraftEditor). */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { backendFor } from '$lib/server/data';

export const GET: RequestHandler = async ({ url }) => {
	const base = url.searchParams.get('base') ?? '';
	const { catalog } = await backendFor(url);
	const v = await catalog.versions.get(base);
	if (!v.ok) return json({ ok: false, error: v.error.message, parameters: [] }, { status: v.error.kind === 'not-found' ? 404 : 503 });
	return json({ ok: true, ver: v.value.ver, state: v.value.state, parameters: v.value.parameters.map((p) => ({ var: p.var, type: p.type, description: p.description })) });
};
