/**
 * What this machine's node reports about itself, for Settings
 * (design/generated/web/screens/Settings.md). Every read is guarded: one that fails comes back
 * as null and the rest still render.
 */
import { CATALOG_SAPP_ID } from '@wyatt/core/catalog';
import type { RunningNode } from './node';

export interface DeviceReport {
	peerId: string | null;
	owner: boolean | null;
	home: string;
	machines: MachineRow[] | null;
	strands: StrandRow[];
	connected: number | null;
	addresses: string[] | null;
}

export interface MachineRow {
	peerId: string;
	self: boolean;
	trusted: boolean;
	/** Epoch ms of its last self-published record. */
	lastHeard: number | null;
}

export interface StrandRow {
	id: string;
	sAppId: string | null;
	catalog: boolean;
	inUse: boolean;
	status: string;
	offline: string | null;
	/** Control peer IDs of the party's machines holding it with no connection now. */
	unreached: string[] | null;
}

async function guard<T>(read: () => T | Promise<T>): Promise<T | null> {
	try {
		return await read();
	} catch {
		return null;
	}
}

export async function deviceReport(running: RunningNode): Promise<DeviceReport> {
	const { node } = running;
	const strands: StrandRow[] = [];
	for (const [id, instance] of node.getStrands()) {
		const sAppId = node.getSAppId(id) ?? null;
		strands.push({
			id,
			sAppId,
			catalog: sAppId === CATALOG_SAPP_ID,
			inUse: id === running.catalogStrandId,
			status: instance.status,
			offline: await guard(() => node.getStrandOfflineMode(id)),
			unreached: await guard(() => node.getUnreachedStrandMachines(id).map((m) => m.peerId)),
		});
	}
	return {
		peerId: node.peerId?.toString() ?? null,
		owner: await guard(() => node.isOwner()),
		home: running.home,
		machines: await guard(async () =>
			(await node.listMachines()).map((m) => ({ peerId: m.peerId, self: m.isSelf, trusted: m.trusted, lastHeard: m.lastPublishedAt })),
		),
		strands,
		connected: await guard(() => node.getControlConnectionCount()),
		addresses: await guard(() => node.getMultiaddrs()),
	};
}
