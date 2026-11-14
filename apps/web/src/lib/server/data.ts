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
import type { StatusReport } from '@wyatt/node';
import { installation } from './node';

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
	/** The catalog this machine works in, and whose it is (strand mode). */
	strandName: string | null;
	company: string | null;
	/** This machine's name. */
	machineLabel: string | null;
}

const label = process.env.WYATT_LABEL?.trim() || null;

/** The backend for a request. In memory mode, `?variant=` picks the catalog. */
export async function backendFor(url: URL): Promise<Backend> {
	if (dataMode === 'memory') {
		const variant = variantOf(url);
		return { catalog: await memoryCatalog(variant), status: memoryStatus(variant) };
	}
	const inst = await installation();
	return { catalog: await inst.catalog(), status: statusFrom(await installationStatus()) };
}

/** The top bar's view of the installation. */
export function statusFrom(st: StatusReport): BackendStatus {
	const current = st.strands.find((x) => x.current) ?? null;
	return {
		mode: 'strand',
		variant: null,
		peerId: st.peerId,
		connected: st.connected > 0,
		label,
		strandName: current?.name ?? null,
		company: current?.company ?? null,
		machineLabel: st.machineLabel,
	};
}

/**
 * The installation's status, read at most every two seconds: the layout asks on every request,
 * and a status read touches every strand.
 */
let cached: { at: number; value: Promise<StatusReport> } | null = null;
export async function installationStatus(fresh = false): Promise<StatusReport> {
	if (fresh || !cached || Date.now() - cached.at > 2_000) {
		const value = installation().then((i) => i.status());
		cached = { at: Date.now(), value };
		value.catch(() => { cached = null; });
	}
	return cached.value;
}

export function memoryStatus(variant: Variant): BackendStatus {
	return { mode: 'memory', variant, peerId: null, connected: false, label, strandName: null, company: null, machineLabel: null };
}

export function variantOf(url: URL): Variant {
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
