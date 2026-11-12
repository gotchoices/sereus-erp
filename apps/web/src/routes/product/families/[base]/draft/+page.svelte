<script lang="ts">
	/** DraftEditor (design/generated/web/screens/DraftEditor.md). */
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import type { DraftDefinition, Version } from '@wyatt/core/catalog';
	import type { PageData } from './$types';
	import Parameters from '$lib/components/draft/Parameters.svelte';
	import Lines from '$lib/components/draft/Lines.svelte';
	import Routing from '$lib/components/draft/Routing.svelte';
	import Notes from '$lib/components/draft/Notes.svelte';
	import Documents from '$lib/components/draft/Documents.svelte';
	import Release from '$lib/components/Release.svelte';
	import { changes } from '$lib/diff';
	import { definitionOf, normalized } from '$lib/draft';
	import { familiesHref, familyHref } from '$lib/links';

	let { data }: { data: PageData } = $props();
	const f = $derived(data.family);
	const keep = $derived(data.keep);

	let def = $state<DraftDefinition>(untrack(() => definitionOf(data.draft)));
	let saved = $state(untrack(() => JSON.stringify(normalized(definitionOf(data.draft)))));
	// Another draft opened in this same page (a different family): start from its saved state.
	let shown = untrack(() => `${data.draft.familyId}.${data.draft.ver}`);
	$effect(() => {
		const key = `${data.draft.familyId}.${data.draft.ver}`;
		if (key === shown) return;
		shown = key;
		def = definitionOf(data.draft);
		saved = JSON.stringify(normalized(def));
		message = null;
	});
	const dirty = $derived(JSON.stringify(normalized(def)) !== saved);
	let message: { kind: 'ok' | 'error'; text: string } | null = $state(null);
	let busy = $state(false);
	let more = $state(false);
	let releasing = $state(false);
	const changeList = $derived(data.current ? changes(definitionOf(data.current), normalized(def)) : null);

	// Leaving with unsaved changes: the browser's own prompt on reload or close; a navigation
	// inside the app is held, and a banner offers to leave anyway (no JS dialogs).
	let held: URL | null = $state(null);
	let leaving = false;
	beforeNavigate((nav) => {
		if (!dirty || leaving || nav.type === 'form' || nav.type === 'leave') return;
		nav.cancel();
		held = nav.to?.url ?? null;
	});
	function leaveAnyway(): void {
		if (!held) return;
		leaving = true;
		void goto(held);
	}
	$effect(() => {
		const onUnload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});

	const action = $derived(`?/save${keep ? `&${keep}` : ''}`);
	const time = (iso: string) => new Date(iso).toLocaleTimeString();
</script>

<svelte:head><title>{f.base} draft · WyattERP</title></svelte:head>

<p class="crumbs"><a href={familiesHref(keep)}>Families</a> › <a href={familyHref(f.base, keep)} class="mono">{f.base}</a> ›</p>

<form
	method="POST"
	{action}
	class="bar"
	use:enhance={({ formData }) => {
		busy = true;
		formData.set('definition', JSON.stringify(normalized(def)));
		return async ({ result }) => {
			busy = false;
			if (result.type === 'success' && result.data?.version) {
				def = definitionOf(result.data.version as Version);
				saved = JSON.stringify(normalized(def));
				message = { kind: 'ok', text: `Saved at ${time(String(result.data.saved))}.` };
			} else if (result.type === 'failure') {
				message = { kind: 'error', text: String(result.data?.error ?? 'The draft was not saved.') };
			} else if (result.type === 'error') {
				message = { kind: 'error', text: result.error?.message ?? 'The draft was not saved.' };
			}
		};
	}}
>
	<h1><span class="mono">{f.base}</span> draft <span class="muted">(version {data.draft.ver})</span></h1>
	<span class="state">
		{#if message}<span class={message.kind === 'error' ? 'error' : 'muted'} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</span>{/if}
		{#if dirty}<span class="dirty">Unsaved changes</span>{/if}
	</span>
	<button type="submit" class="primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save draft'}</button>
	<button type="button" onclick={() => (releasing = true)} disabled={dirty || busy} title={dirty ? 'Save first' : ''}>Release…</button>
</form>
<Release ver={data.draft.ver} action={`?/release${keep ? `&${keep}` : ''}`} compatNotes={def.compatNotes} {changeList} bind:open={releasing} />
{#if held && dirty}
	<p class="held" role="alert">
		This draft has unsaved changes.
		<button type="button" onclick={leaveAnyway}>Leave without saving</button>
		<button type="button" onclick={() => (held = null)}>Stay</button>
	</p>
{/if}
<p class="muted desc">{f.description}</p>

<section>
	<h2>Specification</h2>
	<textarea class="spec" rows="4" bind:value={def.spec} placeholder="What the family is, in markdown"></textarea>
	<button type="button" class="link" onclick={() => (more = !more)}>{more ? 'Less' : 'More: explosion default, family script, price formula'}</button>
	{#if more}
		<div class="more">
			<label>Explode on orders
				<select bind:value={def.explodeDefault}>
					<option value="none">no (a part)</option><option value="to_part">to parts</option>
					<option value="one_level">one level</option><option value="full">fully</option>
				</select>
			</label>
			<label>Family script <textarea class="mono" rows="3" bind:value={def.familyScript}></textarea></label>
			<label>Price formula <input class="mono wide" bind:value={def.priceFormula} /></label>
		</div>
	{/if}
</section>

<section>
	<h2>Parameters</h2>
	<Parameters bind:parameters={def.parameters} units={data.units} base={f.base} />
</section>

<section>
	<h2>BOM lines</h2>
	<Lines bind:lines={def.lines} processes={def.processes} components={data.components} {keep} />
</section>

<section>
	<h2>Routing</h2>
	<Routing bind:processes={def.processes} operations={data.operations} />
</section>

<section>
	<h2>Notes and QC</h2>
	<Notes bind:notes={def.notes} processes={def.processes} documents={def.documents} />
</section>

<section>
	<h2>Documents</h2>
	<Documents bind:documents={def.documents} />
</section>

<style>
	.crumbs { margin: 0 0 0.25rem; font-size: 0.9rem; }
	.bar {
		position: sticky; top: 0; z-index: 1; background: var(--bg);
		display: flex; align-items: center; gap: 1rem; padding: 0.25rem 0; border-bottom: 1px solid var(--border);
	}
	.bar h1 { margin: 0; flex: 1; }
	.state { display: flex; gap: 0.75rem; font-size: 0.9rem; }
	.dirty { color: var(--accent); }
	.desc { margin: 0.25rem 0 0; }
	.held { background: var(--highlight); padding: 0.4rem 0.6rem; display: flex; gap: 0.6rem; align-items: center; }
	section { margin-top: 1.25rem; }
	h2 { font-size: 1.05rem; margin: 0 0 0.4rem; }
	.spec { width: 100%; box-sizing: border-box; }
	.more { display: grid; gap: 0.5rem; max-width: 40rem; margin-top: 0.5rem; }
	.more label { display: flex; flex-direction: column; gap: 0.2rem; }
	button.link { background: none; border: none; color: var(--accent); padding: 0; font-size: 0.9rem; }
</style>
