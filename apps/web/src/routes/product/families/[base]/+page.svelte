<script lang="ts">
	/** FamilyDetail (design/generated/web/screens/FamilyDetail.md). */
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import ConfirmButton from '$lib/components/ConfirmButton.svelte';
	import ApprovePart from '$lib/components/ApprovePart.svelte';
	import { draftHref, familiesHref, familyHref, partHref, versionHref } from '$lib/links';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const f = $derived(data.family);
	const keep = $derived(data.keep);
	const act = (name: string) => `?/${name}${keep ? `&${keep}` : ''}`;
	const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
	const approvable = $derived(f.currentVer !== null && f.status !== 'obsolete' && data.cls?.kind !== 'package');
	let approving = $state(false);
	$effect(() => { if (form && 'approveError' in form && form.approveError) approving = true; });
</script>

<svelte:head><title>{f.base} · WyattERP</title></svelte:head>

<p class="crumbs"><a href={familiesHref(keep)}>Families</a> ›</p>

<header>
	<h1 class="mono">{f.base}</h1>
	<p class="desc">{f.description}</p>
	<p class="facts muted">
		{data.cls ? `${data.cls.name} (${data.cls.kind})` : `class ${f.classPrefix}`} ·
		unit <span class="mono">{f.unitCode}</span>{data.unit ? ` (${data.unit.name})` : ''} ·
		{f.status}{f.versionStrict ? ' · version-strict' : ''}
	</p>
</header>

<form method="POST" class="actions" use:enhance>
	{#if f.draftVer !== null}
		<a class="button primary" href={draftHref(f.base, keep)}>Edit draft v{f.draftVer}</a>
		<ConfirmButton label="Discard draft" confirm={`Discard draft v${f.draftVer}?`} formaction={act('discardDraft')} />
	{:else}
		<button type="submit" formaction={act('startDraft')} class="primary">Start draft v{(f.currentVer ?? 0) + 1}</button>
	{/if}
	{#if f.currentVer === null}
		<ConfirmButton label="Delete family" confirm={`Delete ${f.base}${f.draftVer !== null ? ' and its draft' : ''}?`} formaction={act('remove')} />
	{/if}
</form>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
{#if form && 'done' in form && form.done}<p class="muted" role="status">{form.done}</p>{/if}

<section>
	<h2>Versions</h2>
	{#if data.versions.length === 0}
		<p class="muted">No versions. Start a draft to define the family.</p>
	{:else}
		<table>
			<thead><tr><th>Version</th><th>State</th><th>Released</th><th>Change summary</th><th>Minor</th></tr></thead>
			<tbody>
				{#each data.versions as v (v.ver)}
					<tr>
						<td class="mono">
							{#if v.state === 'draft'}<a href={draftHref(f.base, keep)}>v{v.ver}</a>{:else}<a href={versionHref(f.base, v.ver, keep)}>v{v.ver}</a>{/if}
						</td>
						<td>{v.state}{v.ver === f.currentVer ? ' (current)' : ''}</td>
						<td>{day(v.releasedAt)}</td>
						<td>{v.changeSummary ?? ''}</td>
						<td>{v.latestMinor > 0 ? `.${v.latestMinor}` : ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section>
	<div class="section-head">
		<h2>Parts</h2>
		{#if approvable}<button type="button" onclick={() => (approving = true)}>Approve a configuration</button>{/if}
	</div>
	{#if data.cls?.kind === 'package'}
		<p class="muted">A package family: its configurations are sold and exploded on ordering, never stocked or numbered.</p>
	{:else if data.parts.length === 0}
		<p class="muted">No parts approved yet.{f.currentVer === null ? ' Release a version first.' : ''}</p>
	{:else}
		<table>
			<thead><tr><th>Partname</th><th>Part number</th><th>Status</th></tr></thead>
			<tbody>
				{#each data.parts as p (p.id)}
					<tr>
						<td class="mono"><a href={partHref(p.id, keep)}>{p.partname}</a></td>
						<td class="mono">{p.pnum ?? ''}{#if p.pnum === null}<span class="muted">no number yet</span>{/if}</td>
						<td>{p.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<ApprovePart
	families={[]}
	fixedBase={f.base}
	action={act('approve')}
	{keep}
	bind:open={approving}
	error={form && 'approveError' in form ? (form.approveError ?? null) : null}
	existing={form && 'existing' in form ? (form.existing ?? null) : null}
	values={form && 'values' in form ? (form.values ?? null) : null}
/>

<section>
	<h2>Used in</h2>
	{#if data.usedIn.length === 0}
		<p class="muted">Not used in any family.</p>
	{:else}
		<table>
			<thead><tr><th>Family</th><th>Version</th><th>Line</th><th>Child parameters</th><th>Quantity</th></tr></thead>
			<tbody>
				{#each data.usedIn as u (`${u.familyId}.${u.ver}.${u.pos}`)}
					<tr>
						<td class="mono"><a href={familyHref(u.base, keep)}>{u.base}</a></td>
						<td>v{u.ver} {u.state}</td>
						<td>{u.pos}</td>
						<td class="mono">{u.childParams.join(', ')}</td>
						<td class="mono">{u.qty}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.crumbs {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
	}
	header h1 {
		margin-bottom: 0.1rem;
	}
	.desc {
		margin: 0;
		font-size: 1.05rem;
	}
	.facts {
		margin: 0.25rem 0 0.75rem;
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	section {
		margin-top: 1.25rem;
	}
	.section-head {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.section-head h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.4rem;
	}
</style>
