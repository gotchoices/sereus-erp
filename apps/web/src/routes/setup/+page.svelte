<script lang="ts">
	/** First run (settings-02): two choices, and nothing else works until one is made. */
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let choice: 'start' | 'join' | null = $state(null);
	let busy: 'start' | 'join' | null = $state(null);
	$effect(() => {
		if (form?.form === 'start' || form?.form === 'join') choice = form.form;
	});

	// A joined machine waits for its catalog: look again every few seconds.
	$effect(() => {
		if (data.phase !== 'running') return;
		const t = setInterval(() => invalidateAll(), 3000);
		return () => clearInterval(t);
	});

	const pending = (which: 'start' | 'join') => () => {
		busy = which;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = null;
		};
	};
	const v = (k: string) => (form?.values as Record<string, string> | undefined)?.[k] ?? '';
</script>

<svelte:head><title>Set up · WyattERP</title></svelte:head>

<div class="setup">
	{#if data.phase === 'removed' || data.phase === 'failed'}
		<h1>This machine has stopped</h1>
		<p class="error" role="alert">{data.error}</p>
	{:else if data.phase === 'running'}
		<h1>Joined</h1>
		{#if data.needsChoice}
			<p>This installation has several catalogs. <a href="/settings?choose=1#strands">Choose the one to work in.</a></p>
		{:else if data.strands.length === 0}
			<p>This machine, “{data.machineLabel}”, is part of the installation. Its catalog has not arrived yet; it starts copying as soon as another machine of the installation is reachable.</p>
			<p class="muted">This page moves on by itself when the catalog is ready.</p>
		{:else}
			<p>This machine, “{data.machineLabel}”, is copying the installation's data.</p>
			<ul>{#each data.strands as s, i (i)}<li>{s.name ?? 'Catalog'}: {s.state === 'ready' ? 'ready' : 'copying…'}</li>{/each}</ul>
			<p class="muted">This page moves on by itself when the catalog is ready.</p>
		{/if}
	{:else}
		<h1>Set up WyattERP on this machine</h1>
		<p>
			A WyattERP installation is one company's data, kept on each of its machines and shared between them. This machine is new:
			either it starts a new installation, or it joins the one your company already has.
		</p>

		<div class="choices">
			<button type="button" class="choice" aria-pressed={choice === 'start'} onclick={() => (choice = 'start')}>
				<strong>Start a new installation</strong>
				<span>For a company that has none yet. This machine becomes its first, and holds its owner key.</span>
			</button>
			<button type="button" class="choice" aria-pressed={choice === 'join'} onclick={() => (choice = 'join')}>
				<strong>Join an existing installation</strong>
				<span>Your company already uses WyattERP. You need an invitation from one of its owners.</span>
			</button>
		</div>

		{#if choice === 'start'}
			<form method="POST" action="?/start" use:enhance={pending('start')}>
				<h2>Start a new installation</h2>
				<label>Company <input name="company" required value={v('company')} placeholder="Acme Manufacturing" /></label>
				<label>This machine's name <input name="machineLabel" required value={v('machineLabel') || 'front office'} />
					<small>How the installation's other machines will list this one.</small></label>
				<label>Catalog name <input name="catalogName" value={v('catalogName') || 'Catalog'} /></label>
				<label>What the catalog is for <span class="muted">(optional)</span>
					<input name="purpose" value={v('purpose')} placeholder="Everything we make and buy" /></label>
				<label class="check"><input type="checkbox" name="starter" checked />
					Start with a common set of units (each, meter, kilogram…), product classes and operations, to adjust later</label>
				{#if form?.form === 'start'}<p class="error" role="alert">{form.message}</p>{/if}
				<button class="primary" disabled={busy !== null}>{busy === 'start' ? 'Starting…' : 'Start'}</button>
				<p class="muted small">Afterwards, make a recovery key in Settings: this machine will hold the only owner key.</p>
			</form>
		{:else if choice === 'join'}
			<form method="POST" action="?/join" use:enhance={pending('join')}>
				<h2>Join an existing installation</h2>
				<label>Invitation
					<textarea name="invitation" required rows="4" placeholder="sereus-invite:1.…">{v('invitation')}</textarea>
					<small>An owner makes one in Settings, Machines, or with <code>wyatt invite</code> on a server.</small></label>
				<label>This machine's name <input name="machineLabel" required value={v('machineLabel') || 'front office'} /></label>
				<details>
					<summary>I also have an owner grant</summary>
					<label>Owner grant <textarea name="ownerGrant" rows="3" placeholder="sereus-owner-grant:1.…">{v('ownerGrant')}</textarea>
						<small>With a grant, this machine joins as an owner too: it can invite machines and make recovery keys.</small></label>
				</details>
				{#if form?.form === 'join'}
					<p class="error" role="alert">{form.message}</p>
					{#if form.retryable}<p class="muted">Nothing was set up. You can try again with the same invitation.</p>{/if}
				{/if}
				<button class="primary" disabled={busy !== null}>{busy === 'join' ? 'Joining… (this can take a minute)' : 'Join'}</button>
			</form>
		{/if}
	{/if}
</div>

<style>
	.setup { max-width: 44rem; }
	.choices { display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
	.choice {
		flex: 1 1 18rem; text-align: left; display: flex; flex-direction: column; gap: 0.3rem;
		padding: 0.8rem 1rem; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--text);
	}
	.choice[aria-pressed='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
	.choice span { color: var(--text-2); font-size: 0.9rem; }
	form { display: flex; flex-direction: column; gap: 0.7rem; margin-top: 1rem; }
	h2 { font-size: 1.1rem; margin: 0; }
	label { display: flex; flex-direction: column; gap: 0.2rem; }
	label.check { flex-direction: row; align-items: flex-start; gap: 0.5rem; }
	small { color: var(--text-2); }
	form button.primary { align-self: flex-start; padding: 0.35rem 1rem; }
</style>
