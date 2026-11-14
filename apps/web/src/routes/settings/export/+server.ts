/** Export the current catalog as a YAML file download (settings-07). */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dataMode } from '$lib/server/data';
import { installation } from '$lib/server/node';

export const GET: RequestHandler = async () => {
	if (dataMode === 'memory') error(404, 'No catalog to export in memory mode.');
	const exp = await (await installation()).exportCatalog();
	const who = (exp.company || exp.name || 'catalog').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
	const date = new Date().toISOString().slice(0, 10);
	return new Response(exp.yaml, {
		headers: {
			'content-type': 'application/yaml; charset=utf-8',
			'content-disposition': `attachment; filename="${who}-catalog-${date}.yaml"`,
			'x-wyatt-counts': `${exp.families} families, ${exp.parts} parts, ${exp.partNumbers} part numbers`,
		},
	});
};
