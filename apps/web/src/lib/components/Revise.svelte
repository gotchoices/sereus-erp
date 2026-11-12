<script lang="ts">
	/** Revise dialog on VersionView: a minor revision of notes, QC, documents and times (VersionView consolidation). */
	import { enhance } from '$app/forms';
	import type { DocumentDef, MinorChange, NoteDef, ProcessDef, Version } from '@wyatt/core/catalog';
	import Notes from './draft/Notes.svelte';
	import Documents from './draft/Documents.svelte';

	let { v, action, open = $bindable(false) }: { v: Version; action: string; open?: boolean } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let notes: NoteDef[] = $state([]);
	let documents: DocumentDef[] = $state([]);
	let processes: ProcessDef[] = $state([]);
	let summary = $state('');
	let error: string | null = $state(null);
	let busy = $state(false);

	// Each opening starts from the version as it is now.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			notes = structuredClone(v.notes);
			documents = structuredClone(v.documents);
			processes = structuredClone(v.processes);
			summary = '';
			error = null;
			dialog.showModal();
		}
		if (!open && dialog.open) dialog.close();
	});

	const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
	const stripId = <T extends { id?: string }>({ id: _, ...rest }: T) => rest;

	function changeOf(): MinorChange {
		const oldNotes = new Map(v.notes.map((n) => [n.id, n]));
		const oldDocs = new Map(v.documents.map((d) => [d.id, d]));
		const keptNotes = new Set(notes.map((n) => n.id).filter(Boolean));
		const keptDocs = new Set(documents.map((d) => d.id).filter(Boolean));
		const seq = new Map<number, number>();
		const numbered = notes.map((n) => {
			const s = (seq.get(n.processIdx) ?? 0) + 1;
			seq.set(n.processIdx, s);
			return { ...n, seq: s, measure: n.type === 'qc' ? n.measure : null };
		});
		const change: MinorChange = {
			summary,
			notes: {
				add: numbered.filter((n) => !n.id || !oldNotes.has(n.id)).map((n) => stripId(n)),
				replace: numbered.filter((n) => n.id && oldNotes.has(n.id) && !same(stripId(n), stripId(oldNotes.get(n.id)!))) as Array<NoteDef & { id: string }>,
				remove: v.notes.filter((n) => !keptNotes.has(n.id)).map((n) => n.id),
			},
			documents: {
				add: documents.filter((d) => !d.id || !oldDocs.has(d.id)),
				replace: documents.filter((d) => d.id && oldDocs.has(d.id) && !same(d, oldDocs.get(d.id))) as Array<DocumentDef & { id: string }>,
				remove: v.documents.filter((d) => !keptDocs.has(d.id)).map((d) => d.id),
			},
			processTimes: processes
				.filter((p) => { const o = v.processes.find((q) => q.idx === p.idx)!; return o.setupTime !== p.setupTime || o.laborPerUnit !== p.laborPerUnit || o.machinePerUnit !== p.machinePerUnit; })
				.map((p) => ({ idx: p.idx, setupTime: p.setupTime || null, laborPerUnit: p.laborPerUnit || null, machinePerUnit: p.machinePerUnit || null })),
		};
		return change;
	}
	const empty = (c: MinorChange) =>
		!c.notes!.add!.length && !c.notes!.replace!.length && !c.notes!.remove!.length &&
		!c.documents!.add!.length && !c.documents!.replace!.length && !c.documents!.remove!.length && !c.processTimes!.length;
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="revise-title">
	<form
		method="POST"
		{action}
		use:enhance={({ formData, cancel }) => {
			const change = changeOf();
			if (empty(change)) {
				error = 'Nothing to record: no note, document or time was changed.';
				cancel();
				return;
			}
			formData.set('change', JSON.stringify(change));
			busy = true;
			error = null;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') error = String(result.data?.error ?? 'Not recorded.');
				else {
					open = false;
					await update();
				}
			};
		}}
	>
		<h2 id="revise-title">Revise version {v.ver} (minor revision {v.latestMinor + 1})</h2>
		<p class="muted small">Notes, QC, documents and times. The text as of every earlier minor revision is kept.</p>

		<h3>Times</h3>
		<table class="edit">
			<thead><tr><th>Step</th><th>Setup</th><th>Labor / unit</th><th>Machine / unit</th></tr></thead>
			<tbody>
				{#each processes as p (p.idx)}
					<tr>
						<td class="order">{p.idx} {p.operationCode}</td>
						<td><input class="mono short" bind:value={p.setupTime} aria-label="Setup minutes" /></td>
						<td><input class="mono short" bind:value={p.laborPerUnit} aria-label="Labor minutes per unit" /></td>
						<td><input class="mono short" bind:value={p.machinePerUnit} aria-label="Machine minutes per unit" /></td>
					</tr>
				{/each}
			</tbody>
		</table>

		<h3>Notes and QC</h3>
		<Notes bind:notes {processes} {documents} />

		<h3>Documents</h3>
		<Documents bind:documents />

		<label>Summary of this revision <textarea name="summary" rows="2" required bind:value={summary}></textarea></label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button type="button" onclick={() => (open = false)}>Cancel</button>
			<button type="submit" class="primary" disabled={busy}>{busy ? 'Recording…' : 'Record revision'}</button>
		</div>
	</form>
</dialog>

<style>
	dialog { border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); width: min(60rem, 95vw); }
	h2 { margin: 0 0 0.25rem; font-size: 1.15rem; }
	h3 { margin: 1rem 0 0.3rem; font-size: 0.95rem; }
	label { display: flex; flex-direction: column; gap: 0.25rem; margin: 1rem 0 0.6rem; }
	.actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
