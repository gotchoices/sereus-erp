<script lang="ts">
	/**
	 * Settings (settings-01 this machine, -03 machines, -04 owner keys, -05 strands, -07 backup).
	 * Moving a machine (settings-06) is Invite, an owner grant, then Remove: the help under
	 * Machines says so, and there is no control of its own.
	 */
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { page } from '$app/state';
	import ConfirmButton from '$lib/components/ConfirmButton.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const s = $derived(data.status);
	const variant = $derived(page.data.status?.variant ?? null);
	const owner = $derived(Boolean(s?.owner));
	const others = $derived(data.machines?.filter((m) => !m.self) ?? []);
	const waiting = $derived(data.invitations?.filter((i) => i.live && !i.withdrawn && i.used === 0) ?? []);
	const result = (section: string) => (form?.section === section ? form : null);
	const ok = (section: string) => {
		const r = result(section);
		return r && r.ok ? (r.result as Record<string, unknown>) : null;
	};
	const failed = (section: string) => {
		const r = result(section);
		return r && !r.ok ? (r as { message: string }).message : null;
	};

	const short = (id: string) => (id.length > 12 ? `…${id.slice(-12)}` : id);
	let copied: string | null = $state(null);
	async function copy(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copied = value;
			setTimeout(() => { if (copied === value) copied = null; }, 1500);
		} catch {
			copied = null;
		}
	}
	function ago(ms: number | null): string {
		if (ms === null) return 'not yet';
		const sec = Math.max(0, Math.round((Date.now() - ms) / 1000));
		if (sec < 60) return 'just now';
		if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
		if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
		return `${Math.round(sec / 86400)} days ago`;
	}
	const when = (iso: string | null) => (iso ? new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleString() : 'never');
	let removing: string | null = $state(null);
	let editing: string | null = $state(null);
</script>

<svelte:head><title>Settings · WyattERP</title></svelte:head>

<h1>Settings</h1>

{#snippet copyable(value: string, label = 'Copy')}
	<button type="button" class="small" onclick={() => copy(value)}>{copied === value ? 'Copied' : label}</button>
{/snippet}

{#snippet secret(value: string, warning: string)}
	<div class="secret">
		<p class="warn">{warning}</p>
		<textarea readonly rows="4" class="mono small">{value}</textarea>
		{@render copyable(value, 'Copy text')}
	</div>
{/snippet}

{#if data.error}
	<p class="error" role="alert">{data.error}</p>
{:else if !s}
	<p>This app is running on an in-memory catalog{variant ? ` (variant ${variant})` : ''}. There is no machine, strand or installation.</p>
{:else}
	<nav class="toc">
		<a href="#machine">This machine</a> · <a href="#machines">Machines</a> · <a href="#owner-keys">Owner keys</a> ·
		<a href="#strands">Catalogs</a> · <a href="#backup">Backup</a>
	</nav>

	<!-- settings-01 -->
	<section id="machine">
		<h2>This machine</h2>
		<dl>
			<dt>Name</dt><dd>{s.machineLabel}</dd>
			<dt>ID</dt><dd><span class="mono" title={s.peerId ?? ''}>{short(s.peerId ?? '')}</span>{#if s.peerId}{@render copyable(s.peerId)}{/if}</dd>
			<dt>Role</dt><dd>{s.owner ? 'Owner: holds an owner key of the installation' : 'Member'}</dd>
			<dt>Installation</dt><dd>{s.origin === 'founded' ? 'Started on this machine' : 'Joined by invitation'}</dd>
			<dt>Connected</dt>
			<dd>{#if others.length === 0}No other machines yet.{:else}{s.connected} of {others.length} other {others.length === 1 ? 'machine' : 'machines'}{/if}</dd>
			<dt>Data folder</dt><dd class="mono small">{s.home}</dd>
			<dt>Reachable at</dt>
			<dd class="addresses">
				{#if s.addresses.length === 0}<span class="muted">Not listening: other machines cannot reach this one directly.</span>
				{:else}<ul class="mono small">{#each s.addresses as a (a)}<li>{a}</li>{/each}</ul>{/if}
			</dd>
		</dl>
	</section>

	<!-- settings-03 -->
	<section id="machines">
		<h2>Machines</h2>
		<p class="help">
			The installation's machines each keep a copy of its data. Add one with an invitation; remove one you no longer use.
			To move to a new machine, invite it, wait until its copy shows as ready here, then remove the old one
			(and give the new one owner rights first if the old one was an owner).
		</p>
		{#if failed('machines')}<p class="error" role="alert">{failed('machines')}</p>{/if}
		{#if data.machines === null}
			<p class="muted">The machine list could not be read.</p>
		{:else}
			<table>
				<thead><tr><th>Name</th><th>ID</th><th>Connected</th><th>Last heard from</th><th></th></tr></thead>
				<tbody>
					{#each data.machines as m (m.peerId)}
						<tr>
							<td>{m.label ?? 'unnamed'}{#if m.self}<span class="muted small"> (this machine)</span>{/if}</td>
							<td><span class="mono small" title={m.peerId}>{short(m.peerId)}</span></td>
							<td>{m.self ? '' : m.connected ? 'yes' : 'no'}</td>
							<td>{m.self ? '' : ago(m.lastHeard)}</td>
							<td class="row-tools">
								{#if owner && !m.self}
									{#if removing === m.peerId}
										<form method="POST" action="?/removeMachine" use:enhance class="inline">
											<input type="hidden" name="peerId" value={m.peerId} />
											<span class="small">Remove “{m.label ?? short(m.peerId)}”? It stops syncing. An owner key it holds is removed separately, under Owner keys.</span>
											<label class="small"><input type="checkbox" name="acceptLoss" /> Remove even if it may hold the only copy</label>
											<button class="danger">Remove</button>
											<button type="button" onclick={() => (removing = null)}>Cancel</button>
										</form>
									{:else}
										<button type="button" class="small" onclick={() => (removing = m.peerId)}>Remove…</button>
									{/if}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		{#if owner}
			<h3>Invite a machine</h3>
			<form method="POST" action="?/invite" use:enhance class="row">
				<label>For <input name="label" placeholder="shop laptop" class="mid" /></label>
				<label>Valid for <input name="days" type="number" min="1" max="30" value="7" class="tiny" /> days</label>
				<button class="primary">Make invitation</button>
			</form>
			{#if failed('invite')}<p class="error" role="alert">{failed('invite')}</p>{/if}
			{#if ok('invite')}
				{@const inv = ok('invite') as { invitation: string; expiresAt: string | null; reach: string }}
				{@render secret(inv.invitation, 'Whoever holds this invitation can join the installation. Send it privately, to one machine.')}
				<p class="small">
					On the new machine: open WyattERP and choose <em>Join an existing installation</em>, or on a server run
					<code>wyatt init join '…' --name &lt;machine&gt;</code>. Valid until {when(inv.expiresAt)}.
					{#if inv.reach === 'issuer-only'}<strong>Only this machine can admit it: keep it running until the new machine has joined.</strong>{/if}
				</p>
			{/if}

			{#if waiting.length}
				<h3>Invitations waiting</h3>
				{#if failed('invitations')}<p class="error" role="alert">{failed('invitations')}</p>{/if}
				<table>
					<thead><tr><th>For</th><th>Expires</th><th></th></tr></thead>
					<tbody>
						{#each waiting as i (i.key)}
							<tr>
								<td>{i.label ?? 'any machine'}</td>
								<td>{when(i.expiresAt)}</td>
								<td class="row-tools">
									<form method="POST" use:enhance class="inline">
										<input type="hidden" name="key" value={i.key} />
										<ConfirmButton label="Withdraw" confirm="Withdraw invitation" formaction="?/withdraw" />
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</section>

	<!-- settings-04 -->
	<section id="owner-keys">
		<h2>Owner keys</h2>
		<p class="help">
			Owner keys belong to people. An owner can add and remove machines, make other owners and found catalogs.
			Losing every owner key locks the installation's settings for good, so keep a recovery key offline.
		</p>
		{#if failed('owner-keys')}<p class="error" role="alert">{failed('owner-keys')}</p>{/if}
		{#if data.ownerKeys}
			{#if data.ownerKeys.length === 1}
				<p class="notice">There is only one owner key{data.ownerKeys[0]?.heldHere ? ', on this machine' : ''}. Make a recovery key and keep it somewhere safe.</p>
			{/if}
			<table>
				<thead><tr><th>Label</th><th>Fingerprint</th><th>On this machine</th><th></th></tr></thead>
				<tbody>
					{#each data.ownerKeys as k (k.key)}
						<tr>
							<td>{k.label ?? 'unlabeled'}</td>
							<td class="mono">{k.fingerprint}</td>
							<td>{k.heldHere ? 'yes' : ''}</td>
							<td class="row-tools">
								{#if owner && !k.heldHere && data.ownerKeys.length > 1}
									<form method="POST" use:enhance class="inline">
										<input type="hidden" name="key" value={k.key} />
										<ConfirmButton label="Remove" confirm="Remove owner key" formaction="?/removeOwnerKey" />
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		{#if owner}
			<h3>Make a recovery key</h3>
			<p class="help">A recovery key is an owner grant that never expires: redeemed on any machine, it makes that machine an owner. Nothing secret leaves this machine.</p>
			<form method="POST" action="?/recoveryKey" use:enhance class="row">
				<label>Label <input name="label" value="paper backup" class="mid" /></label>
				<button class="primary">Make recovery key</button>
			</form>
			{#if ok('recovery')}{@render secret((ok('recovery') as { grant: string }).grant, 'Whoever has this text can become an owner of the installation. Print it or store it offline, and do not leave it on this machine.')}{/if}
			{#if failed('recovery')}<p class="error" role="alert">{failed('recovery')}</p>{/if}

			<h3>Give owner rights to another machine</h3>
			<form method="POST" action="?/ownerGrant" use:enhance class="row">
				<label>For <input name="label" placeholder="closet server" class="mid" required /></label>
				<button>Make owner grant (valid 1 day)</button>
			</form>
			{#if ok('grant')}
				{@render secret((ok('grant') as { grant: string }).grant, 'Whoever redeems this becomes an owner. Use it on the other machine:')}
				<p class="small">In its Settings, Owner keys, <em>Redeem an owner grant</em>; or on a server <code>wyatt redeem-grant '…'</code>.</p>
			{/if}
			{#if failed('grant')}<p class="error" role="alert">{failed('grant')}</p>{/if}

			{#if data.ownerKeys?.some((k) => k.heldHere)}
				<h3>Export this machine's owner key</h3>
				<p class="help">Only to move this key to another device you control. The export is locked with a passphrase.</p>
				<form method="POST" action="?/exportKey" use:enhance class="row">
					<label>Passphrase <input name="passphrase" type="password" minlength="8" required class="mid" autocomplete="new-password" /></label>
					<button>Export</button>
				</form>
				{#if ok('export-key')}{@render secret((ok('export-key') as { text: string }).text, 'This is the owner key itself, locked with your passphrase. Keep it offline.')}{/if}
				{#if failed('export-key')}<p class="error" role="alert">{failed('export-key')}</p>{/if}
			{/if}
		{:else}
			<h3>Redeem an owner grant</h3>
			<p class="help">An owner can make this machine an owner too, with an owner grant or a recovery key.</p>
			<form method="POST" action="?/redeemGrant" use:enhance>
				<textarea name="grant" rows="3" class="mono small wide" required placeholder="sereus-owner-grant:…"></textarea>
				<button>Redeem</button>
			</form>
			{#if failed('redeem')}<p class="error" role="alert">{failed('redeem')}</p>{/if}
		{/if}
	</section>

	<!-- settings-05 -->
	<section id="strands">
		<h2>Catalogs</h2>
		<p class="help">Each catalog is shared by every machine of the installation. Usually there is one; a second is a separate catalog, such as one for a separate product line.</p>
		{#if data.choose && s.needsChoice}<p class="notice">This installation has several catalogs. Choose the one to work in on this machine.</p>{/if}
		{#if failed('strands')}<p class="error" role="alert">{failed('strands')}</p>{/if}
		<table>
			<thead><tr><th>Name</th><th>What it is for</th><th>Company</th><th>On this machine</th><th></th></tr></thead>
			<tbody>
				{#each s.strands as x (x.id)}
					<tr>
						{#if editing === x.id}
							<td colspan="5">
								<form method="POST" action="?/about" use:enhance={() => async ({ update }) => { await update(); editing = null; }} class="row">
									<input type="hidden" name="id" value={x.id} />
									<label>Name <input name="name" value={x.name ?? ''} required class="mid" /></label>
									<label>For <input name="purpose" value={x.purpose ?? ''} class="wide" /></label>
									<label>Company <input name="company" value={x.company ?? ''} class="mid" /></label>
									<button class="primary">Save</button>
									<button type="button" onclick={() => (editing = null)}>Cancel</button>
								</form>
							</td>
						{:else}
							<td>{x.name ?? 'Catalog'}{#if x.current}<span class="muted small"> (in use here)</span>{/if}</td>
							<td>{x.purpose || ''}</td>
							<td>{x.company ?? ''}</td>
							<td>{x.writable ? 'ready' : 'copying…'}</td>
							<td class="row-tools">
								{#if x.writable && !x.current}
									<form method="POST" action="?/useStrand" use:enhance class="inline">
										<input type="hidden" name="id" value={x.id} /><button class="small">Work in this one</button>
									</form>
								{/if}
								{#if x.writable}<button type="button" class="small" onclick={() => (editing = x.id)}>Edit</button>{/if}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
		{#if owner}
			{#if s.canFound}
				<details>
					<summary>Found another catalog</summary>
					<form method="POST" action="?/found" use:enhance class="stack">
						<p class="help">A new, separate catalog: nothing is copied from the existing one. Every machine of the installation picks it up.</p>
						<label>Name <input name="name" required class="mid" placeholder="Outdoor line" /></label>
						<label>What it is for <input name="purpose" class="wide" placeholder="Products for the outdoor line, kept apart from the main catalog" /></label>
						<label class="check"><input type="checkbox" name="starter" checked /> Start with the common units, classes and operations</label>
						<button class="primary">Found catalog</button>
					</form>
				</details>
				{#if failed('found')}<p class="error" role="alert">{failed('found')}</p>{/if}
			{:else}
				<p class="muted small">Founding a catalog is offered once this machine has finished joining: the installation's catalogs may still be arriving.</p>
			{/if}
		{/if}
	</section>

	<!-- settings-07 -->
	<section id="backup">
		<h2>Backup</h2>
		<p class="help">
			The other machines' copies are the everyday protection. An export is a readable file of the whole catalog to keep off-site,
			and the way to restore if every machine were lost.
		</p>
		<p><a class="button" href="/settings/export" download>Export the catalog</a></p>
		<h3>Restore from a file</h3>
		<p class="help">Only into a catalog with no families yet: start a new installation, then restore before entering anything.</p>
		{#if ok('restore') && (ok('restore') as { preview?: unknown }).preview}
			{@const r = ok('restore') as { preview: { families: number; parts: number; partNumbers: number; exportedAt: string; name: string | null; company: string | null }; yaml: string }}
			<form method="POST" action="?/restoreConfirmed" use:enhance class="stack">
				<p>The file holds {r.preview.company ?? ''} {r.preview.name ?? 'catalog'}, exported {when(r.preview.exportedAt)}:
					{r.preview.families} families, {r.preview.parts} parts, {r.preview.partNumbers} part numbers. Restore it into “{page.data.status?.strandName}”?</p>
				<textarea name="yaml" hidden>{r.yaml}</textarea>
				<button class="primary">Restore</button>
			</form>
		{:else}
			<form method="POST" action="?/restore" enctype="multipart/form-data" use:enhance class="row">
				<input type="file" name="file" accept=".yaml,.yml,application/yaml,text/yaml" required />
				<button>Read file</button>
			</form>
		{/if}
		{#if ok('restore') && (ok('restore') as { restored?: unknown }).restored}
			<p class="notice">Restored: {Object.entries((ok('restore') as { restored: Record<string, number> }).restored).map(([t, n]) => `${n} ${t}`).join(', ')}.</p>
		{/if}
		{#if failed('restore')}<p class="error" role="alert">{failed('restore')}</p>{/if}
	</section>
{/if}

<style>
	section { margin-top: 1.5rem; max-width: 62rem; }
	h2 { font-size: 1.1rem; margin: 0 0 0.4rem; }
	h3 { font-size: 0.95rem; margin: 1rem 0 0.3rem; }
	.toc { font-size: 0.9rem; }
	.help { color: var(--text-2); margin: 0 0 0.5rem; max-width: 50rem; }
	.notice { background: var(--highlight); padding: 0.4rem 0.6rem; border-radius: 4px; }
	dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 0; }
	dt { color: var(--text-2); }
	dd { margin: 0; display: flex; gap: 0.5rem; align-items: center; }
	dd.addresses ul { margin: 0; padding-left: 1.1rem; }
	button.small { font-size: 0.75rem; padding: 0.05rem 0.4rem; }
	.row { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; }
	.stack { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; margin-top: 0.5rem; }
	.stack label { display: flex; flex-direction: column; }
	label.check { flex-direction: row !important; gap: 0.4rem; }
	form.inline { display: inline-flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
	.secret { margin: 0.5rem 0; display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-start; max-width: 50rem; }
	.secret textarea { width: 100%; }
	.warn { margin: 0; font-weight: 600; }
	.danger { color: var(--danger); }
	textarea.wide { min-width: 30rem; }
</style>
