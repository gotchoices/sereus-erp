<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { page } from '$app/state';
	import '../app.css';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	const q = (path: string) => (data.keep ? `${path}?${data.keep}` : path);
</script>

<header class="topbar">
	<a class="brand" href={q('/')}>WyattERP</a>
	<nav aria-label="Modules">
		{#if !data.setup || data.setup.ready}
			<a href={q('/product')} class="section" aria-current={page.url.pathname.startsWith('/product') ? 'page' : undefined}>Product</a>
		{/if}
	</nav>
	{#if data.status.strandName}
		<a class="strand" href="/settings#strands" title={`${data.status.company ?? ''} catalog; this machine is “${data.status.machineLabel ?? ''}”`}>{data.status.strandName}</a>
	{/if}
	{#if data.status.label}<span class="label">{data.status.label}</span>{/if}
	<span class="status" title={data.status.peerId ?? ''}>
		{#if data.status.mode === 'memory'}
			In-memory catalog ({data.status.variant})
		{:else if data.status.connected}
			Connected
		{:else}
			This device only
		{/if}
	</span>
	{#if !data.setup || data.setup.phase === 'running'}<a href={q('/settings')} class="section" aria-current={page.url.pathname.startsWith('/settings') ? 'page' : undefined}>Settings</a>{/if}
</header>

<main>
	{@render children()}
</main>

<style>
	.topbar {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border);
	}
	.brand {
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}
	nav {
		display: flex;
		gap: 1rem;
		flex: 1;
	}
	.section {
		text-decoration: none;
		padding: 0.2rem 0;
		border-bottom: 2px solid transparent;
	}
	.section[aria-current='page'] {
		color: var(--text);
		border-bottom-color: var(--accent);
	}
	.label {
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.1rem 0.5rem;
		border-radius: 3px;
		background: var(--highlight);
		color: var(--text);
	}
	.strand {
		font-size: 0.875rem;
		color: var(--text);
		text-decoration: none;
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 0.05rem 0.45rem;
	}
	.status {
		color: var(--text-2);
		font-size: 0.875rem;
	}
	main {
		padding: 1rem;
	}
</style>
