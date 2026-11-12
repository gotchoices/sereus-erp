<script lang="ts">
	/** Product section sub-navigation (design/generated/web/screens/PartList.md). */
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import { familiesHref, partsHref, referenceHref } from '$lib/links';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	const onParts = $derived(page.url.pathname.startsWith('/product/parts'));
	const onReference = $derived(page.url.pathname.startsWith('/product/reference'));
</script>

<nav class="tabs" aria-label="Product">
	<a href={familiesHref(data.keep)} aria-current={!onParts && !onReference ? 'page' : undefined}>Families</a>
	<a href={partsHref(data.keep)} aria-current={onParts ? 'page' : undefined}>Parts</a>
	<a href={referenceHref(data.keep)} aria-current={onReference ? 'page' : undefined}>Units, classes and operations</a>
</nav>
{@render children()}

<style>
	.tabs { display: flex; gap: 1rem; margin: -0.25rem 0 0.75rem; font-size: 0.9rem; }
	.tabs a { text-decoration: none; color: var(--text-2); }
	.tabs a[aria-current='page'] { color: var(--text); font-weight: 600; }
</style>
