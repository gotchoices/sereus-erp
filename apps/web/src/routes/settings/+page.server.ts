/**
 * Settings (settings-01, -03, -04, -05, -07): this machine, the installation's machines,
 * owner keys, strands and backup. Every change is an Installation call (@wyatt/node), the same
 * the `wyatt` command makes.
 */
import { fail } from '@sveltejs/kit';
import type { InvitationReport, MachineReport, OwnerKeyReport, StatusReport } from '@wyatt/node';
import type { Actions, PageServerLoad } from './$types';
import { dataMode, installationStatus } from '$lib/server/data';
import { installation } from '$lib/server/node';

async function guard<T>(read: () => Promise<T>): Promise<T | null> {
	try {
		return await read();
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ url }) => {
	if (dataMode === 'memory') {
		return { status: null as StatusReport | null, machines: null, invitations: null, ownerKeys: null, error: null as string | null, choose: false };
	}
	try {
		const inst = await installation();
		const status = await installationStatus(true);
		return {
			status,
			machines: await guard<MachineReport[]>(() => inst.machines()),
			invitations: status.owner ? await guard<InvitationReport[]>(() => inst.invitations()) : null,
			ownerKeys: await guard<OwnerKeyReport[]>(() => inst.ownerKeys()),
			error: null,
			choose: url.searchParams.has('choose'),
		};
	} catch (err) {
		return { status: null, machines: null, invitations: null, ownerKeys: null, error: `This machine's node is not running: ${err instanceof Error ? err.message : String(err)}`, choose: false };
	}
};

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Run one change; a refusal comes back to the section that asked, with what was typed. */
async function act<T>(section: string, body: (f: FormData) => Promise<T>, request: Request) {
	const f = await request.formData();
	try {
		const result = await body(f);
		await installationStatus(true);
		return { section, ok: true as const, result };
	} catch (err) {
		return fail(400, { section, ok: false as const, message: message(err) });
	}
}

const DAY = 86_400_000;

export const actions: Actions = {
	nameMachine: ({ request }) => act('machines', async (f) => (await installation()).nameMachine(text(f, 'peerId'), text(f, 'label')), request),
	invite: ({ request }) => act('invite', async (f) => {
		const days = Math.min(30, Math.max(1, Number(text(f, 'days')) || 7));
		return (await installation()).invite({ label: text(f, 'label'), ttlMs: days * DAY });
	}, request),
	withdraw: ({ request }) => act('invitations', async (f) => (await installation()).withdrawInvitation(text(f, 'key')), request),
	removeMachine: ({ request }) => act('machines', async (f) =>
		(await installation()).removeMachine(text(f, 'peerId'), { acceptLoss: f.get('acceptLoss') === 'on' }), request),

	recoveryKey: ({ request }) => act('recovery', async (f) =>
		(await installation()).ownerGrant({ label: text(f, 'label') || 'recovery', backup: true }), request),
	ownerGrant: ({ request }) => act('grant', async (f) =>
		(await installation()).ownerGrant({ label: text(f, 'label'), ttlMs: DAY }), request),
	redeemGrant: ({ request }) => act('redeem', async (f) => (await installation()).redeemOwnerGrant(text(f, 'grant')), request),
	exportKey: ({ request }) => act('export-key', async (f) => {
		const passphrase = text(f, 'passphrase');
		if (passphrase.length < 8) throw new Error('Choose a passphrase of at least 8 characters to lock the export.');
		return (await installation()).exportOwnerKey({ passphrase, label: text(f, 'label') || undefined });
	}, request),
	removeOwnerKey: ({ request }) => act('owner-keys', async (f) => (await installation()).removeOwnerKey(text(f, 'key')), request),

	useStrand: ({ request }) => act('strands', async (f) => (await installation()).useStrand(text(f, 'id')), request),
	about: ({ request }) => act('strands', async (f) =>
		(await installation()).setAbout(text(f, 'id'), { name: text(f, 'name'), purpose: text(f, 'purpose'), company: text(f, 'company') }), request),
	found: ({ request }) => act('found', async (f) =>
		(await installation()).foundCatalog({ name: text(f, 'name'), purpose: text(f, 'purpose'), starter: f.get('starter') === 'on' }), request),

	restore: ({ request }) => act('restore', async (f) => {
		const file = f.get('file');
		if (!(file instanceof File) || file.size === 0) throw new Error('Choose an export file.');
		const yaml = await file.text();
		const inst = await installation();
		if (f.get('confirm') !== 'yes') return { preview: inst.describeExport(yaml), yaml };
		return { restored: (await inst.restoreCatalog(yaml)).counts };
	}, request),
	restoreConfirmed: ({ request }) => act('restore', async (f) => {
		return { restored: (await (await installation()).restoreCatalog(text(f, 'yaml'))).counts };
	}, request),
};
