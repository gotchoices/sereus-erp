<script lang="ts">
	/** Routing steps (DraftEditor consolidation, section 4). */
	import type { Operation, ProcessDef } from '@wyatt/core/catalog';
	import { newProcess } from '$lib/draft';

	let { processes = $bindable(), operations }: { processes: ProcessDef[]; operations: Operation[] } = $props();
	const nextIdx = () => Math.max(0, ...processes.map((p) => p.idx)) + 1;
	function add(): void {
		const last = processes.at(-1);
		const p = newProcess(nextIdx());
		if (last && last.nextIdx === null) last.nextIdx = p.idx;
		processes.push(p);
	}
</script>

{#if processes.length}
	<table class="edit">
		<thead><tr><th>Step</th><th>Operation</th><th>Next</th><th>Setup</th><th>Labor / unit</th><th>Machine / unit</th><th>Description</th><th></th></tr></thead>
		<tbody>
			{#each processes as p, i (p.idx)}
				<tr>
					<td class="order">{p.idx}</td>
					<td>
						<select bind:value={p.operationCode} aria-label="Operation">
							<option value="">(operation)</option>
							{#each operations as o (o.code)}<option value={o.code}>{o.code}: {o.description}</option>{/each}
						</select>
					</td>
					<td>
						<select bind:value={p.nextIdx} aria-label="Next step">
							<option value={null}>end</option>
							{#each processes.filter((q) => q.idx !== p.idx) as q (q.idx)}<option value={q.idx}>{q.idx}</option>{/each}
						</select>
					</td>
					<td><input class="mono short" bind:value={p.setupTime} aria-label="Setup minutes" /></td>
					<td><input class="mono short" bind:value={p.laborPerUnit} aria-label="Labor minutes per unit" /></td>
					<td><input class="mono short" bind:value={p.machinePerUnit} aria-label="Machine minutes per unit" /></td>
					<td><input bind:value={p.description} aria-label="Description" /></td>
					<td class="row-tools"><button type="button" onclick={() => processes.splice(i, 1)} aria-label="Remove">✕</button></td>
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="muted small">Times are minutes, and may be expressions of the parameters.</p>
{/if}
<button type="button" onclick={add}>+ Step</button>
