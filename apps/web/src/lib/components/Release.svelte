<script lang="ts">
	/** Release dialog on DraftEditor (design/generated/web/screens/VersionView.md). */
	import { enhance } from '$app/forms';

	let {
		ver, action, compatNotes, changeList, open = $bindable(false),
	}: { ver: number; action: string; compatNotes: string | null; changeList: string[] | null; open?: boolean } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let error: string | null = $state(null);
	let busy = $state(false);
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="release-title">
	<form
		method="POST"
		{action}
		use:enhance={() => {
			busy = true;
			error = null;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') error = String(result.data?.error ?? 'Not released.');
				else await update();
			};
		}}
	>
		<h2 id="release-title">Release version {ver}</h2>
		{#if changeList}
			<h3>Changes from version {ver - 1}</h3>
			{#if changeList.length === 0}
				<p class="muted">No changes to the definition.</p>
			{:else}
				<ul class="changes">{#each changeList as c, i (i)}<li>{c}</li>{/each}</ul>
			{/if}
		{/if}
		<label>Change summary <textarea name="changeSummary" rows="2" required placeholder="What changed and why"></textarea></label>
		{#if ver > 1}
			<fieldset>
				<legend>Interchangeable with version {ver - 1}? (same form, fit and function)</legend>
				<label class="inline"><input type="radio" name="interchangeable" value="yes" required /> Yes</label>
				<label class="inline"><input type="radio" name="interchangeable" value="no" /> No</label>
			</fieldset>
		{/if}
		<label>Compatibility notes <textarea name="compatNotes" rows="2" placeholder="Consequences of mixing versions (optional)">{compatNotes ?? ''}</textarea></label>
		<p class="muted small">Once released, the definition cannot be edited. Notes, QC, documents and times can still be revised.</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button type="button" onclick={() => (open = false)}>Cancel</button>
			<button type="submit" class="primary" disabled={busy}>{busy ? 'Releasing…' : `Release version ${ver}`}</button>
		</div>
	</form>
</dialog>

<style>
	dialog { border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); width: 34rem; }
	h2 { margin: 0 0 0.75rem; font-size: 1.15rem; }
	h3 { margin: 0 0 0.25rem; font-size: 0.95rem; }
	.changes { margin: 0 0 0.75rem; padding-left: 1.2rem; font-size: 0.9rem; max-height: 12rem; overflow: auto; }
	label { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.6rem; }
	label.inline { display: inline-flex; flex-direction: row; gap: 0.3rem; margin-right: 1rem; }
	fieldset { border: none; padding: 0; margin: 0 0 0.6rem; }
	legend { padding: 0; margin-bottom: 0.25rem; }
	.actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
