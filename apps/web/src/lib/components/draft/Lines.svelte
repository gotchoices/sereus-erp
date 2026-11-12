<script lang="ts">
	/** BOM lines, in evaluation order (DraftEditor consolidation, section 3). */
	import type { BomLineDef, ProcessDef } from '@wyatt/core/catalog';
	import { move, newLine } from '$lib/draft';

	type ChildParam = { var: string; type: string; description: string };
	let {
		lines = $bindable(), processes, components, keep,
	}: { lines: BomLineDef[]; processes: ProcessDef[]; components: { base: string; description: string }[]; keep: string } = $props();

	// Each component's parameters (its current version), fetched once per base.
	let childParams: Record<string, ChildParam[] | 'missing'> = $state({});
	async function lookup(base: string): Promise<void> {
		if (!base || childParams[base]) return;
		const r = await fetch(`/product/api/params?base=${encodeURIComponent(base)}${keep ? `&${keep}` : ''}`);
		const body = await r.json();
		childParams[base] = body.ok ? body.parameters : 'missing';
	}
	$effect(() => {
		for (const l of lines) void lookup(l.component);
	});
	function fit(l: BomLineDef): void {
		const defs = childParams[l.component];
		if (Array.isArray(defs)) l.childParams = defs.map((d, k) => l.childParams[k] ?? d.var);
	}
	let open: Record<number, boolean> = $state({});
</script>

<datalist id="component-families">
	{#each components as c (c.base)}<option value={c.base}>{c.description}</option>{/each}
</datalist>

{#if lines.length}
	<table class="edit">
		<thead><tr><th></th><th>Component</th><th>Child parameters</th><th>Quantity</th><th>Applies when</th><th>Step</th><th>Comment</th><th></th></tr></thead>
		<tbody>
			{#each lines as l, i (i)}
				{@const defs = childParams[l.component]}
				<tr>
					<td class="order">{i + 1}</td>
					<td>
						<input class="mono mid" list="component-families" bind:value={l.component} aria-label="Component"
							onchange={async () => { await lookup(l.component); fit(l); }} placeholder="b:pipe" />
						{#if defs === 'missing'}<div class="error small">no released family {l.component}</div>{/if}
					</td>
					<td>
						{#if Array.isArray(defs)}
							{#if defs.length === 0}<span class="muted small">none</span>{/if}
							{#each defs as d, k (k)}
								<label class="param" title={d.description}>
									<span class="mono small">{d.var}</span>
									<input class="mono short" bind:value={l.childParams[k]} aria-label={`${d.var} for ${l.component}`} />
								</label>
							{/each}
						{:else}
							<input class="mono" value={l.childParams.join(', ')} aria-label="Child parameters"
								onchange={(e) => (l.childParams = e.currentTarget.value.split(',').map((s) => s.trim()).filter(Boolean))} />
						{/if}
					</td>
					<td><input class="mono short" bind:value={l.qty} aria-label="Quantity" /></td>
					<td><input class="mono mid" bind:value={l.when} aria-label="Applies when" placeholder="always" /></td>
					<td>
						<select bind:value={l.processIdx} aria-label="Step">
							<option value={null}>none</option>
							{#each processes as p (p.idx)}<option value={p.idx}>{p.idx} {p.operationCode}</option>{/each}
							{#if l.processIdx !== null && !processes.some((p) => p.idx === l.processIdx)}<option value={l.processIdx}>{l.processIdx} (removed)</option>{/if}
						</select>
						{#if l.processIdx !== null && !processes.some((p) => p.idx === l.processIdx)}<div class="error small">step {l.processIdx} was removed</div>{/if}
					</td>
					<td><input bind:value={l.comment} aria-label="Comment" /></td>
					<td class="row-tools">
						<button type="button" onclick={() => (open[i] = !open[i])} aria-label="More">⋯</button>
						<button type="button" onclick={() => move(lines, i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
						<button type="button" onclick={() => move(lines, i, 1)} disabled={i === lines.length - 1} aria-label="Move down">↓</button>
						<button type="button" onclick={() => lines.splice(i, 1)} aria-label="Remove">✕</button>
					</td>
				</tr>
				{#if open[i]}
					<tr class="sub">
						<td></td>
						<td colspan="7">
							<label>Script <textarea class="mono" rows="3" bind:value={l.script}></textarea></label>
							<label>Pinned child version <input class="short" type="number" min="1" bind:value={l.childVer} placeholder="current" /></label>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
{/if}
<button type="button" onclick={() => lines.push(newLine())}>+ Line</button>
