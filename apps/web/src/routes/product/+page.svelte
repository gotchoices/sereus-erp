<script lang="ts">
	/** FamilyList (design/generated/web/screens/FamilyList.md). */
	import type { ActionData, PageData } from './$types';
	import type { Family } from '@wyatt/core/catalog';
	import NewFamily from '$lib/components/NewFamily.svelte';
	import { familyHref } from '$lib/links';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);
	$effect(() => {
		if (form?.error) creating = true;
	});

	const keep = $derived(data.keep);
	const action = $derived(`?/create${keep ? `&${keep}` : ''}`);
	const className = (prefix: string) => data.classes.find((c) => c.prefix === prefix)?.name ?? prefix;
	const filtered = $derived(data.filter.text !== '' || data.filter.classPrefix !== '' || data.filter.status !== 'active');

	// Filters apply as they change: selects at once, the search box after a pause.
	let filters: HTMLFormElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const apply = () => filters?.requestSubmit();
	const applySoon = () => {
		clearTimeout(timer);
		timer = setTimeout(apply, 250);
	};

	function versionState(f: Family): string {
		if (f.currentVer === null) return f.draftVer === null ? 'no versions' : `draft v${f.draftVer}, never released`;
		return f.draftVer === null ? `v${f.currentVer} current` : `v${f.currentVer} current, draft v${f.draftVer}`;
	}
</script>

<svelte:head><title>Families · WyattERP</title></svelte:head>

<div class="head">
	<h1>Families</h1>
	<button onclick={() => (creating = true)} disabled={!!data.error}>New family</button>
</div>

{#if data.error}
	<p class="error" role="alert">{data.error}</p>
{:else}
	<form method="GET" class="filters" bind:this={filters} data-sveltekit-keepfocus data-sveltekit-replacestate>
		{#if data.status.variant}<input type="hidden" name="variant" value={data.status.variant} />{/if}
		<input type="search" name="q" value={data.filter.text} placeholder="Search name or description" aria-label="Search" oninput={applySoon} />
		<select name="class" aria-label="Class" onchange={apply}>
			<option value="">All classes</option>
			{#each data.classes as c (c.prefix)}
				<option value={c.prefix} selected={c.prefix === data.filter.classPrefix}>{c.prefix}: {c.name}</option>
			{/each}
		</select>
		<select name="status" aria-label="Status" onchange={apply}>
			{#each [['active', 'Active'], ['restricted', 'Restricted'], ['obsolete', 'Obsolete'], ['all', 'Any status']] as [v, label] (v)}
				<option value={v} selected={v === data.filter.status}>{label}</option>
			{/each}
		</select>
		<noscript><button type="submit">Filter</button></noscript>
	</form>

	{#if data.total === 0}
		<div class="empty">
			<p>No families yet.</p>
			{#if data.classes.length === 0 || data.units.length === 0}
				<p class="muted">Families need a class and a unit. Set up classes and units first (Units, classes and operations, a later screen).</p>
			{:else}
				<button onclick={() => (creating = true)}>Start the first family</button>
			{/if}
		</div>
	{:else if data.families.length === 0}
		<p>No families match. <a href={keep ? `?${keep}` : '?'}>Clear filters</a></p>
	{:else}
		<table>
			<thead>
				<tr><th>Family</th><th>Description</th><th>Class</th><th>Unit</th><th>Versions</th><th>Status</th></tr>
			</thead>
			<tbody>
				{#each data.families as f (f.id)}
					<tr class:created={f.base === data.created}>
						<td class="mono"><a href={familyHref(f.base, keep)}>{f.base}</a></td>
						<td>{f.description}</td>
						<td>{className(f.classPrefix)}</td>
						<td class="mono">{f.unitCode}</td>
						<td>{versionState(f)}</td>
						<td>{f.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="muted count">{data.families.length} of {data.total}{filtered ? ' (filtered)' : ''}</p>
	{/if}
{/if}

<NewFamily
	classes={data.classes}
	units={data.units}
	{action}
	error={form?.error ?? null}
	values={form?.values ?? null}
	bind:open={creating}
/>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.filters input[type='search'] {
		flex: 1;
		max-width: 24rem;
	}
	tr.created td {
		background: var(--highlight);
	}
	.empty {
		padding: 2rem 0;
	}
	.count {
		font-size: 0.85rem;
	}
</style>
