import type { PageServerLoad } from './$types';
import { dataMode } from '$lib/server/data';
import { runningNode } from '$lib/server/node';
import { deviceReport, type DeviceReport } from '$lib/server/device';

export const load: PageServerLoad = async () => {
	if (dataMode === 'memory') return { device: null as DeviceReport | null, error: null as string | null };
	try {
		return { device: await deviceReport(await runningNode()), error: null };
	} catch (err) {
		return { device: null, error: `This device's node is not running: ${err instanceof Error ? err.message : String(err)}` };
	}
};
