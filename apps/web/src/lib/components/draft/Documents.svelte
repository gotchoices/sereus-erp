<script lang="ts">
	/** Documents, recorded as links (DraftEditor consolidation, section 6; story product-02 Q3). */
	import type { DocumentDef } from '@wyatt/core/catalog';
	import { newDocument } from '$lib/draft';

	let { documents = $bindable() }: { documents: DocumentDef[] } = $props();
</script>

{#if documents.length}
	<table class="edit">
		<thead><tr><th>Kind</th><th>Name</th><th>Link</th><th></th></tr></thead>
		<tbody>
			{#each documents as d, i (d.id ?? i)}
				<tr>
					<td>
						<select bind:value={d.kind} aria-label="Kind">
							{#each ['drawing', 'cad', 'datasheet', 'label', 'photo', 'other'] as k (k)}<option value={k}>{k}</option>{/each}
						</select>
					</td>
					<td><input bind:value={d.name} aria-label="Name" /></td>
					<td><input class="mono wide" bind:value={d.contentRef} aria-label="Link" placeholder="https://… or a path" /></td>
					<td class="row-tools"><button type="button" onclick={() => documents.splice(i, 1)} aria-label="Remove">✕</button></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
<button type="button" onclick={() => documents.push(newDocument())}>+ Document</button>
