<script lang="ts">
	/** Parameters, in partname order (DraftEditor consolidation, section 2). */
	import type { ParameterDef, Unit } from '@wyatt/core/catalog';
	import { move, newParameter } from '$lib/draft';

	let { parameters = $bindable(), units, base }: { parameters: ParameterDef[]; units: Unit[]; base: string } = $props();
	const pattern = $derived(`${base}(${parameters.map((p) => p.var || '?').join(',')})`);
	const problem = (p: ParameterDef): string | null => {
		if (!p.var.trim()) return 'needs a name';
		if (parameters.filter((q) => q.var === p.var).length > 1) return 'name used twice';
		if (p.type === 'enum' && p.allowed.length === 0) return 'a choice needs allowed values';
		if (p.type === 'num' && !p.unitCode) return 'needs a unit';
		return null;
	};
</script>

<p class="muted">Partnames: <code>{parameters.length ? pattern : base}</code></p>
{#if parameters.length}
	<table class="edit">
		<thead><tr><th></th><th>Name</th><th>Type</th><th>Unit</th><th>Description</th><th>Default</th><th>Min</th><th>Max</th><th></th></tr></thead>
		<tbody>
			{#each parameters as p, i (i)}
				<tr>
					<td class="order">{i + 1}</td>
					<td>
						<input class="mono short" bind:value={p.var} aria-label="Name" placeholder="L" />
						{#if problem(p)}<div class="error small">{problem(p)}</div>{/if}
					</td>
					<td>
						<select bind:value={p.type} aria-label="Type">
							<option value="num">number</option><option value="enum">choice</option><option value="str">text</option>
						</select>
					</td>
					<td>
						{#if p.type === 'num'}
							<select bind:value={p.unitCode} aria-label="Unit">
								<option value={null}>(unit)</option>
								{#each units as u (u.code)}<option value={u.code}>{u.code}</option>{/each}
							</select>
						{/if}
					</td>
					<td><input bind:value={p.description} aria-label="Description" /></td>
					<td><input class="mono short" bind:value={p.defaultValue} aria-label="Default" /></td>
					<td>{#if p.type === 'num'}<input class="short" type="number" step="any" bind:value={p.min} aria-label="Min" />{/if}</td>
					<td>{#if p.type === 'num'}<input class="short" type="number" step="any" bind:value={p.max} aria-label="Max" />{/if}</td>
					<td class="row-tools">
						<button type="button" onclick={() => move(parameters, i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
						<button type="button" onclick={() => move(parameters, i, 1)} disabled={i === parameters.length - 1} aria-label="Move down">↓</button>
						<button type="button" onclick={() => parameters.splice(i, 1)} aria-label="Remove">✕</button>
					</td>
				</tr>
				{#if p.type === 'enum'}
					<tr class="sub">
						<td></td>
						<td colspan="8">
							<span class="muted">Allowed values:</span>
							{#each p.allowed as a, j (j)}
								<span class="chip">
									<input class="mono tiny" bind:value={a.value} aria-label="Value" placeholder="w" />
									<input class="mid" bind:value={a.description} aria-label="Meaning" placeholder="white" />
									<button type="button" onclick={() => p.allowed.splice(j, 1)} aria-label="Remove value">✕</button>
								</span>
							{/each}
							<button type="button" onclick={() => p.allowed.push({ value: '', description: '' })}>+ value</button>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
{/if}
<button type="button" onclick={() => parameters.push(newParameter())}>+ Parameter</button>
