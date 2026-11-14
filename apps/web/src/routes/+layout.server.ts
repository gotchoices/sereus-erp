import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { dataMode, installationStatus, memoryStatus, statusFrom, variantOf } from '$lib/server/data';

/**
 * Every page but the first-run page needs a running installation with a catalog to work in
 * (settings-02): a machine not set up, still joining, or waiting for its catalog goes to /setup;
 * one with several catalogs and none chosen goes to Settings to choose (settings-05).
 */
export const load: LayoutServerLoad = async ({ url }) => {
	if (dataMode === 'memory') {
		const status = memoryStatus(variantOf(url));
		// In memory mode the variant rides along on every link and form (appeus deep-link variants).
		return { status, keep: `variant=${status.variant}`, setup: null };
	}
	const st = await installationStatus();
	const path = url.pathname;
	const ready = st.phase === 'running' && st.current !== null;
	if (!ready && !path.startsWith('/setup')) {
		if (st.phase === 'running' && st.needsChoice) {
			if (!path.startsWith('/settings')) redirect(303, '/settings?choose=1#strands');
		} else {
			redirect(303, '/setup');
		}
	}
	return { status: statusFrom(st), keep: '', setup: { phase: st.phase, ready } };
};
