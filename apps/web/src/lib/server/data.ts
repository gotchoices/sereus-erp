/**
 * The web app's data layer: the one place that decides where data comes from (appeus mocking:
 * "Mock mode switch (one setting)"). Screens ask for a `CatalogModel` and never learn which.
 *
 *   WYATT_DATA=strand (default)  the catalog strand on this machine's Sereus node
 *   WYATT_DATA=memory            an in-memory catalog per variant, chosen by `?variant=`:
 *                                happy (the sample catalog), empty, error
 *
 * The in-memory catalog runs the same schema and model as the strand, so a variant can only
 * show what the real system could (design/specs/project.md, Data Strategy).
 */
import { fail, type Result } from '@wyatt/core';
import { loadSampleCatalog, openMemoryCatalog, openStrandCatalog, type CatalogModel } from '@wyatt/core/catalog';
import { runningNode } from './node';

export type DataMode = 'strand' | 'memory';
export type Variant = 'happy' | 'empty' | 'error';

export const dataMode: DataMode = process.env.WYATT_DATA === 'memory' ? 'memory' : 'strand';

export interface Backend {
	catalog: CatalogModel;
	status: BackendStatus;
}

export interface BackendStatus {
	mode: DataMode;
	variant: Variant | null;
	/** This machine's peer ID (strand mode). */
	peerId: string | null;
	/** Whether another machine of the party is connected right now. */
	connected: boolean;
	/** Shown in the top bar when set (WYATT_LABEL), e.g. for the ATI test node. */
	label: string | null;
}

const label = process.env.WYATT_LABEL?.trim() || null;

/** The backend for a request. In memory mode, `?variant=` picks the catalog. */
export async function backendFor(url: URL): Promise<Backend> {
	if (dataMode === 'memory') {
		const variant = variantOf(url);
		return { catalog: await memoryCatalog(variant), status: { mode: 'memory', variant, peerId: null, connected: false, label } };
	}
	const running = await runningNode();
	return {
		// Built per request from the current @wyatt/core, over the long-lived node: a rebuilt
		// model takes effect at once in development (vite.config.ts).
		catalog: openStrandCatalog(running.node, running.catalogStrandId),
		status: {
			mode: 'strand',
			variant: null,
			peerId: running.node.peerId?.toString() ?? null,
			connected: running.node.getControlConnectionCount() > 0,
			label,
		},
	};
}

function variantOf(url: URL): Variant {
	const v = url.searchParams.get('variant');
	return v === 'empty' || v === 'error' ? v : 'happy';
}

// One in-memory catalog per variant, kept for the life of the process (writes persist until restart).
const memory = new Map<Variant, Promise<CatalogModel>>();

function memoryCatalog(variant: Variant): Promise<CatalogModel> {
	let m = memory.get(variant);
	if (!m) {
		m = (async () => {
			if (variant === 'error') return failing();
			const catalog = await openMemoryCatalog({ actor: 'memory' });
			if (variant === 'happy') await loadSampleCatalog(catalog);
			return catalog;
		})();
		memory.set(variant, m);
	}
	return m;
}

/** A catalog whose every operation fails as `unavailable`: the error variant. */
function failing(): CatalogModel {
	const unavailable = async (): Promise<Result<never>> => fail('unavailable', 'The catalog could not be reached (error variant).');
	const group = new Proxy({}, { get: () => unavailable });
	return new Proxy({}, { get: () => group }) as CatalogModel;
}
