<script lang="ts">
	/** VersionView (design/generated/web/screens/VersionView.md). */
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import Definition from '$lib/components/Definition.svelte';
	import Revise from '$lib/components/Revise.svelte';
	import { familiesHref, familyHref, versionHref } from '$lib/links';

	let { data }: { data: PageData } = $props();
	const f = $derived(data.family);
	const v = $derived(data.version);
	const keep = $derived(data.keep);
	const isCurrent = $derived(f.currentVer === v.ver);
	const atLatest = $derived(v.asOfMinor === v.latestMinor);
	let revising = $state(false);
	const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
	const short = (id: string | null) => (id && id.length > 16 ? `${id.slice(0, 6)}…${id.slice(-4)}` : (id ?? ''));
</script>

<svelte:head><title>{f.base}.{v.ver} · WyattERP</title></svelte:head>

<p class="crumbs"><a href={familiesHref(keep)}>Families</a> › <a class="mono" href={familyHref(f.base, keep)}>{f.base}</a> ›</p>

<header>
	<h1><span class="mono">{f.base}.{v.ver}{v.asOfMinor > 0 ? `.${v.asOfMinor}` : ''}</span>
		<span class="state">{v.state}{isCurrent ? ', current' : ''}</span></h1>
	<p class="facts muted">
		Released {day(v.releasedAt)} by <span class="mono" title={v.releasedBy ?? ''}>{short(v.releasedBy)}</span>
		{#if v.ver > 1}· {v.interchangeable ? 'interchangeable' : 'not interchangeable'} with v{v.ver - 1}{/if}
	</p>
	{#if v.changeSummary}<p class="summary">{v.changeSummary}</p>{/if}
	{#if v.compatNotes}<p class="muted">Compatibility: {v.compatNotes}</p>{/if}
</header>

<div class="bar">
	{#if v.minorRevisions.length}
		<label>As of
			<select value={v.asOfMinor} onchange={(e) => goto(versionHref(f.base, v.ver, keep, Number(e.currentTarget.value)), { keepFocus: true })}>
				<option value={0}>the release (.0)</option>
				{#each v.minorRevisions as m (m.minor)}<option value={m.minor}>.{m.minor} {day(m.at)}: {m.summary}</option>{/each}
			</select>
		</label>
	{/if}
	{#if v.state !== 'retired' && atLatest}
		<button type="button" onclick={() => (revising = true)}>Revise notes, QC and documents…</button>
	{:else if !atLatest}
		<span class="muted small">Showing an earlier minor revision; revise from the latest.</span>
	{/if}
</div>

{#if v.minorRevisions.length}
	<section>
		<h2>Minor revisions</h2>
		<table>
			<thead><tr><th>Revision</th><th>Date</th><th>By</th><th>Summary</th></tr></thead>
			<tbody>
				{#each v.minorRevisions as m (m.minor)}
					<tr class:shown={m.minor === v.asOfMinor}>
						<td class="mono"><a href={versionHref(f.base, v.ver, keep, m.minor)}>.{m.minor}</a></td>
						<td>{day(m.at)}</td><td class="mono" title={m.by}>{short(m.by)}</td><td>{m.summary}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<Definition {v} base={f.base} />

<Revise {v} action={`?/revise${keep ? `&${keep}` : ''}`} bind:open={revising} />

<style>
	.crumbs { margin: 0 0 0.25rem; font-size: 0.9rem; }
	h1 { margin-bottom: 0.1rem; }
	.state { font-size: 1rem; font-weight: 400; color: var(--text-2); margin-left: 0.5rem; }
	.facts { margin: 0.15rem 0; font-size: 0.9rem; }
	.summary { margin: 0.25rem 0; }
	.bar { display: flex; gap: 1rem; align-items: center; margin: 0.75rem 0; }
	section { margin-top: 1.25rem; }
	h2 { font-size: 1.05rem; margin: 0 0 0.4rem; }
	tr.shown td { background: var(--highlight); }
</style>
