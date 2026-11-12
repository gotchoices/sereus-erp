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
		<a href={q('/product')} class="section" aria-current={page.url.pathname.startsWith('/product') ? 'page' : undefined}>Product</a>
	</nav>
	<span class="status" title={data.status.peerId ?? ''}>
		{#if data.status.mode === 'memory'}
			In-memory catalog ({data.status.variant})
		{:else if data.status.connected}
			Connected
		{:else}
			This device only
		{/if}
	</span>
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
	.status {
		color: var(--text-2);
		font-size: 0.875rem;
	}
	main {
		padding: 1rem;
	}
</style>
