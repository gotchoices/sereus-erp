<script lang="ts">
	/** NewFamily dialog (design/generated/web/screens/FamilyList.md). */
	import { enhance } from '$app/forms';
	import type { Class, Unit } from '@wyatt/core/catalog';

	let {
		classes, units, action, error = null, values = null, open = $bindable(false),
	}: {
		classes: Class[];
		units: Unit[];
		action: string;
		error?: string | null;
		values?: { base: string; unitCode: string; description: string } | null;
		open?: boolean;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let base = $state('');
	// A refused submit comes back with what was entered; keep showing it.
	$effect(() => {
		if (values) base = values.base;
	});
	let busy = $state(false);

	const prefix = $derived(base.includes(':') ? base.slice(0, base.indexOf(':')) : base.slice(0, 1));
	const cls = $derived(classes.find((c) => c.prefix === prefix));

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="new-family-title">
	<form
		method="POST"
		{action}
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<h2 id="new-family-title">New family</h2>

		<label>
			Name
			<input name="base" class="mono" placeholder="a:chan" bind:value={base} required autocomplete="off" />
		</label>
		<p class="hint">
			{#if !prefix}
				A class letter, a colon, then a short name.
			{:else if cls}
				Class <code>{cls.prefix}</code>: {cls.name}{cls.kind === 'package' ? ' (packages: sold, never stocked)' : ''}
			{:else}
				<span class="error">No class <code>{prefix}</code></span>
			{/if}
		</p>

		<label>
			Unit
			<select name="unitCode" required>
				{#each units as u (u.code)}
					<option value={u.code} selected={values?.unitCode === u.code}>{u.code}: {u.name}</option>
				{/each}
			</select>
		</label>

		<label>
			Description
			<input name="description" value={values?.description ?? ''} required />
		</label>

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<button type="button" onclick={() => (open = false)}>Cancel</button>
			<button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
		</div>
	</form>
</dialog>

<style>
	dialog {
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		min-width: 24rem;
	}
	h2 {
		margin: 0 0 1rem;
		font-size: 1.15rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
	}
	.hint {
		margin: -0.5rem 0 0.75rem;
		font-size: 0.85rem;
		color: var(--text-2);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
