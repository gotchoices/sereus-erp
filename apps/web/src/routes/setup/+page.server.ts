/**
 * First run (settings-02): start a new installation, or join an existing one. Also where a
 * joined machine waits for its catalog to arrive, and where a removed machine says so.
 */
import { fail, redirect } from '@sveltejs/kit';
import { InstallationError } from '@wyatt/node';
import type { Actions, PageServerLoad } from './$types';
import { dataMode, installationStatus } from '$lib/server/data';
import { installation } from '$lib/server/node';

export const load: PageServerLoad = async () => {
	if (dataMode === 'memory') redirect(303, '/product');
	const st = await installationStatus(true);
	if (st.phase === 'running' && st.current) redirect(303, '/product');
	return {
		phase: st.phase,
		error: st.error,
		machineLabel: st.machineLabel,
		strands: st.strands.map((x) => ({ name: x.name, state: x.writable ? 'ready' : x.state })),
		needsChoice: st.needsChoice,
	};
};

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export const actions: Actions = {
	start: async ({ request }) => {
		const f = await request.formData();
		const values = { machineLabel: text(f, 'machineLabel'), company: text(f, 'company'), catalogName: text(f, 'catalogName'), purpose: text(f, 'purpose') };
		try {
			await (await installation()).startNew({ ...values, starter: f.get('starter') === 'on' });
		} catch (err) {
			return fail(400, { form: 'start', values, message: err instanceof Error ? err.message : String(err) });
		}
		await installationStatus(true);
		redirect(303, '/product');
	},
	join: async ({ request }) => {
		const f = await request.formData();
		const values = { machineLabel: text(f, 'machineLabel'), invitation: text(f, 'invitation'), ownerGrant: text(f, 'ownerGrant') };
		try {
			await (await installation()).join({
				invitation: values.invitation, machineLabel: values.machineLabel, ...(values.ownerGrant ? { ownerGrant: values.ownerGrant } : {}),
			});
		} catch (err) {
			const retryable = err instanceof InstallationError && err.retryable;
			return fail(400, { form: 'join', values, message: err instanceof Error ? err.message : String(err), retryable });
		}
		await installationStatus(true);
		redirect(303, '/setup');
	},
};
