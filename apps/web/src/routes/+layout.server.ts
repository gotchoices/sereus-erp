import type { LayoutServerLoad } from './$types';
import { backendFor } from '$lib/server/data';

export const load: LayoutServerLoad = async ({ url }) => {
	const { status } = await backendFor(url);
	// In memory mode the variant rides along on every link and form (appeus deep-link variants).
	const keep = status.variant ? `variant=${status.variant}` : '';
	return { status, keep };
};
