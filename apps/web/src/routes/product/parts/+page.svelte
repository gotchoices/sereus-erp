<script lang="ts">
	/** PartList (design/generated/web/screens/PartList.md). */
	import type { ActionData, PageData } from './$types';
	import ApprovePart from '$lib/components/ApprovePart.svelte';
	import { partHref } from '$lib/links';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const keep = $derived(data.keep);
	let approving = $state(false);
	$effect(() => { if (form?.approveError) approving = true; });

	let filters: HTMLFormElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const apply = () => filters?.requestSubmit();
	const applySoon = () => { clearTimeout(timer); timer = setTimeout(apply, 250); };
	const filtered = $derived(data.filter.text !== '' || data.filter.familyBase !== '' || data.filter.status !== '');
	const tracking = { none: '', run: 'by run', serial: 'by serial' } as const;
</script>

<svelte:head><title>Parts · WyattERP</title></svelte:head>

<div class="head">
	<h1>Parts</h1>
	<button class="primary" onclick={() => (approving = true)} disabled={!!data.error || data.approvable.length === 0}>Approve a configuration</button>
</div>

{#if data.error}
	<p class="error" role="alert">{data.error}</p>
{:else}
	<form method="GET" class="filters" bind:this={filters} data-sveltekit-keepfocus data-sveltekit-replacestate>
		{#if data.status.variant}<input type="hidden" name="variant" value={data.status.variant} />{/if}
		<input type="search" name="q" value={data.filter.text} placeholder="Partname or part number" aria-label="Search" oninput={applySoon} />
		<select name="family" aria-label="Family" onchange={apply}>
			<option value="">All families</option>
			{#each data.families as f (f.base)}<option value={f.base} selected={f.base === data.filter.familyBase}>{f.base}</option>{/each}
		</select>
		<select name="status" aria-label="Status" onchange={apply}>
			{#each [['', 'Any status'], ['proposed', 'Proposed'], ['active', 'Active'], ['restricted', 'Restricted'], ['obsolete', 'Obsolete']] as [v, label] (v)}
				<option value={v} selected={v === data.filter.status}>{label}</option>
			{/each}
		</select>
		<noscript><button type="submit">Filter</button></noscript>
	</form>

	{#if data.total === 0}
		<p>No parts approved yet.</p>
	{:else if data.parts.length === 0}
		<p>No parts match. <a href={keep ? `?${keep}` : '?'}>Clear filters</a></p>
	{:else}
		<table>
			<thead><tr><th>Partname</th><th>Part number</th><th>Family</th><th>Status</th><th>Tracking</th></tr></thead>
			<tbody>
				{#each data.parts as p (p.id)}
					<tr>
						<td class="mono"><a href={partHref(p.id, keep)}>{p.partname}</a></td>
						<td class="mono">{#if p.pnum !== null}{p.pnum}{:else}<span class="muted">no number yet</span>{/if}</td>
						<td>{p.familyDescription}</td>
						<td>{p.status}</td>
						<td>{tracking[p.tracking]}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="muted count">{data.parts.length} of {data.total}{filtered ? ' (filtered)' : ''}</p>
	{/if}
{/if}

<ApprovePart
	families={data.approvable}
	action={`?/approve${keep ? `&${keep}` : ''}`}
	{keep}
	bind:open={approving}
	error={form?.approveError ?? null}
	existing={form?.existing ?? null}
	values={form?.values ?? null}
	returnedBase={form?.base ?? null}
/>

<style>
	.head { display: flex; align-items: center; justify-content: space-between; }
	.filters { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
	.filters input[type='search'] { flex: 1; max-width: 24rem; }
	.count { font-size: 0.85rem; }
</style>
