/** PartDetail (design/generated/web/screens/PartDetail.md). */
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { PartFields, PartRef, PartStatus, Tracking } from '@wyatt/core/catalog';
import { parseScaled } from '@wyatt/domain';
import { backendFor } from '$lib/server/data';
import { errorText } from '$lib/errors';

/** A part by ID, part number (digits) or partname (has a colon). */
const refOf = (ref: string): PartRef => (/^\d+$/.test(ref) ? { pnum: Number(ref) } : ref.includes(':') ? { partname: ref } : { id: ref });

export const load: PageServerLoad = async ({ params, url }) => {
	const { catalog } = await backendFor(url);
	const part = await catalog.parts.get(refOf(params.ref));
	if (!part.ok) error(part.error.kind === 'not-found' ? 404 : part.error.kind === 'invalid' ? 400 : 503, part.error.message);
	const [family, units] = await Promise.all([catalog.families.get(part.value.familyId), catalog.units.list()]);
	if (!family.ok) error(503, family.error.message);
	const unit = units.ok ? units.value.find((u) => u.code === family.value.unitCode) ?? null : null;
	return { part: part.value, family: family.value, unit };
};

const intOrNull = (v: FormDataEntryValue | null) => {
	const s = String(v ?? '').trim();
	if (s === '') return null;
	const n = Number(s);
	if (!Number.isInteger(n)) throw new Error(`${s} is not a whole number`);
	return n;
};

export const actions: Actions = {
	number: async ({ params, url }) => {
		const { catalog } = await backendFor(url);
		const r = await catalog.parts.number(refOf(params.ref));
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		return { numbered: r.value.pnum };
	},
	save: async ({ params, request, url }) => {
		const form = await request.formData();
		const { catalog } = await backendFor(url);
		const part = await catalog.parts.get(refOf(params.ref));
		if (!part.ok) return fail(404, { error: errorText(part.error) });
		const [family, units] = await Promise.all([catalog.families.get(part.value.familyId), catalog.units.list()]);
		const scale = family.ok && units.ok ? units.value.find((u) => u.code === family.value.unitCode)?.scale ?? 0 : 0;
		let fields: Partial<PartFields>;
		try {
			const qty = (name: string) => {
				const s = String(form.get(name) ?? '').trim();
				return s === '' ? null : parseScaled(s, scale);
			};
			fields = {
				status: String(form.get('status')) as PartStatus,
				tracking: String(form.get('tracking')) as Tracking,
				minLevel: qty('minLevel'), targetLevel: qty('targetLevel'), minBuy: qty('minBuy'),
				shelfLifeDays: intOrNull(form.get('shelfLifeDays')),
				weight: intOrNull(form.get('weight')), length: intOrNull(form.get('length')),
				width: intOrNull(form.get('width')), height: intOrNull(form.get('height')),
				stackFactor: intOrNull(form.get('stackFactor')),
				comment: String(form.get('comment') ?? '').trim() || null,
			};
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		const r = await catalog.parts.update(part.value.id, fields);
		if (!r.ok) return fail(400, { error: errorText(r.error) });
		return { saved: true };
	},
};
