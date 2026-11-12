<script lang="ts">
	/** ReferenceData (design/generated/web/screens/ReferenceData.md). */
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const keep = $derived(data.keep);
	const act = (name: string) => `?/${name}${keep ? `&${keep}` : ''}`;

	// Rows changed since they were last saved, by form id; the row's Save is enabled for those.
	let changed: Record<string, boolean> = $state({});
	let saved: string | null = $state(null);
	const mark = (id: string) => () => { changed[id] = true; saved = null; };
	const submit = (id: string) => () => async ({ result, update }: { result: { type: string }; update: (o?: { reset?: boolean }) => Promise<void> }) => {
		if (result.type === 'success') { changed[id] = false; saved = id; }
		await update({ reset: result.type === 'success' && id.endsWith(':new') });
	};
	const errorAt = (key: string) => (form && 'at' in form && form.at === key ? form.error : null);

	const dimensions = ['count', 'length', 'area', 'volume', 'mass', 'time'];
	const kinds = [['part', 'part: approved combinations are stocked parts'], ['package', 'package: sold, never stocked'], ['custom', 'custom: one-off engineered items']];
	const unitUse = (code: string) => data.usage.units[code] ?? 0;
	const classUse = (prefix: string) => data.usage.classes[prefix] ?? 0;
	const opUse = (code: string) => data.usage.operations[code] ?? 0;
</script>

<svelte:head><title>Units, classes and operations · WyattERP</title></svelte:head>

<h1>Units, classes and operations</h1>

{#if data.error}
	<p class="error" role="alert">{data.error}</p>
{:else}
	<!-- One form per row; the row's inputs join it by id (a form cannot sit inside a table row). -->
	{#each [...data.units.map((u) => `unit:${u.code}`), 'unit:new'] as id (id)}
		<form id={id} method="POST" action={act('unit')} use:enhance={submit(id)}>{#if id.endsWith(':new')}<input type="hidden" name="mode" value="new" />{/if}</form>
	{/each}
	{#each [...data.classes.map((c) => `class:${c.prefix}`), 'class:new'] as id (id)}
		<form id={id} method="POST" action={act('class')} use:enhance={submit(id)}>{#if id.endsWith(':new')}<input type="hidden" name="mode" value="new" />{/if}</form>
	{/each}
	{#each [...data.operations.map((o) => `operation:${o.code}`), 'operation:new'] as id (id)}
		<form id={id} method="POST" action={act('operation')} use:enhance={submit(id)}>{#if id.endsWith(':new')}<input type="hidden" name="mode" value="new" />{/if}</form>
	{/each}

	<section>
		<h2>Units</h2>
		<table class="edit">
			<thead><tr><th>Code</th><th>Name</th><th>Dimension</th><th>Decimal places</th><th>Conversion to base</th><th>Used by</th><th></th></tr></thead>
			<tbody>
				{#each data.units as u (u.code)}
					{@const id = `unit:${u.code}`}
					{@const inUse = unitUse(u.code) > 0}
					<tr oninput={mark(id)} onchange={mark(id)}>
						<td class="mono">{u.code}<input type="hidden" name="code" value={u.code} form={id} /></td>
						<td><input name="name" value={u.name} form={id} aria-label="Name" /></td>
						<td><select name="dimension" value={u.dimension} form={id} aria-label="Dimension">{#each dimensions as d (d)}<option value={d}>{d}</option>{/each}</select></td>
						<td>
							<input class="tiny" name="scale" type="number" min="0" max="9" value={u.scale} form={id} aria-label="Decimal places" readonly={inUse}
								title={inUse ? 'In use: stored quantities would change meaning' : ''} />
						</td>
						<td class="factor">
							<input class="tiny" name="factorNum" value={u.factorNum ?? ''} form={id} aria-label="Factor numerator" inputmode="numeric" />
							/ <input class="tiny" name="factorDen" value={u.factorDen ?? ''} form={id} aria-label="Factor denominator" inputmode="numeric" />
						</td>
						<td class="muted">{unitUse(u.code) || ''}</td>
						<td class="row-tools">
							<button type="submit" form={id} disabled={!changed[id]}>Save</button>
							{#if saved === id}<span class="muted small" role="status">Saved</span>{/if}
						</td>
					</tr>
					{#if errorAt(id)}<tr><td></td><td colspan="6" class="error small"><span role="alert">{errorAt(id)}</span></td></tr>{/if}
				{/each}
				<tr class="new" oninput={mark('unit:new')}>
					<td><input class="mono tiny" name="code" form="unit:new" placeholder="new" aria-label="New unit code" /></td>
					<td><input name="name" form="unit:new" placeholder="name" aria-label="New unit name" /></td>
					<td><select name="dimension" form="unit:new" aria-label="New unit dimension">{#each dimensions as d (d)}<option value={d}>{d}</option>{/each}</select></td>
					<td><input class="tiny" name="scale" type="number" min="0" max="9" value="0" form="unit:new" aria-label="New unit decimal places" /></td>
					<td class="factor">
						<input class="tiny" name="factorNum" form="unit:new" aria-label="New unit factor numerator" inputmode="numeric" />
						/ <input class="tiny" name="factorDen" form="unit:new" aria-label="New unit factor denominator" inputmode="numeric" />
					</td>
					<td></td>
					<td class="row-tools"><button type="submit" form="unit:new" disabled={!changed['unit:new']}>Add</button></td>
				</tr>
				{#if errorAt('unit:new')}<tr><td></td><td colspan="6" class="error small"><span role="alert">{errorAt('unit:new')}</span></td></tr>{/if}
			</tbody>
		</table>
		<p class="muted small">Decimal places: quantities in this unit are stored to that many places. They are fixed once the unit is in use. Conversion: one of this unit in the dimension's base unit, as a fraction (mm: 1 / 1000 of m).</p>
	</section>

	<section>
		<h2>Classes</h2>
		<table class="edit">
			<thead><tr><th>Prefix</th><th>Name</th><th>Kind</th><th>Storage notes</th><th>Families</th><th></th></tr></thead>
			<tbody>
				{#each data.classes as c (c.prefix)}
					{@const id = `class:${c.prefix}`}
					{@const inUse = classUse(c.prefix) > 0}
					<tr oninput={mark(id)} onchange={mark(id)}>
						<td class="mono">{c.prefix}<input type="hidden" name="prefix" value={c.prefix} form={id} /></td>
						<td><input name="name" value={c.name} form={id} aria-label="Name" /></td>
						<td>
							{#if inUse}
								<input type="hidden" name="kind" value={c.kind} form={id} />
								<span title="This class has families; its kind cannot change">{c.kind}</span>
							{:else}
								<select name="kind" value={c.kind} form={id} aria-label="Kind">{#each kinds as [k, label] (k)}<option value={k}>{label}</option>{/each}</select>
							{/if}
						</td>
						<td><input name="storageNotes" value={c.storageNotes ?? ''} form={id} aria-label="Storage notes" /></td>
						<td class="muted">{classUse(c.prefix) || ''}</td>
						<td class="row-tools">
							<button type="submit" form={id} disabled={!changed[id]}>Save</button>
							{#if saved === id}<span class="muted small" role="status">Saved</span>{/if}
						</td>
					</tr>
					{#if errorAt(id)}<tr><td></td><td colspan="5" class="error small"><span role="alert">{errorAt(id)}</span></td></tr>{/if}
				{/each}
				<tr class="new" oninput={mark('class:new')}>
					<td><input class="mono tiny" name="prefix" maxlength="1" form="class:new" placeholder="x" aria-label="New class prefix" /></td>
					<td><input name="name" form="class:new" placeholder="name" aria-label="New class name" /></td>
					<td><select name="kind" form="class:new" aria-label="New class kind">{#each kinds as [k, label] (k)}<option value={k}>{label}</option>{/each}</select></td>
					<td><input name="storageNotes" form="class:new" aria-label="New class storage notes" /></td>
					<td></td>
					<td class="row-tools"><button type="submit" form="class:new" disabled={!changed['class:new']}>Add</button></td>
				</tr>
				{#if errorAt('class:new')}<tr><td></td><td colspan="5" class="error small"><span role="alert">{errorAt('class:new')}</span></td></tr>{/if}
			</tbody>
		</table>
	</section>

	<section>
		<h2>Operations</h2>
		<table class="edit narrow">
			<thead><tr><th>Code</th><th>Description</th><th>Steps</th><th></th></tr></thead>
			<tbody>
				{#each data.operations as o (o.code)}
					{@const id = `operation:${o.code}`}
					<tr oninput={mark(id)}>
						<td class="mono">{o.code}<input type="hidden" name="code" value={o.code} form={id} /></td>
						<td><input name="description" value={o.description} form={id} aria-label="Description" /></td>
						<td class="muted">{opUse(o.code) || ''}</td>
						<td class="row-tools">
							<button type="submit" form={id} disabled={!changed[id]}>Save</button>
							{#if saved === id}<span class="muted small" role="status">Saved</span>{/if}
						</td>
					</tr>
					{#if errorAt(id)}<tr><td></td><td colspan="3" class="error small"><span role="alert">{errorAt(id)}</span></td></tr>{/if}
				{/each}
				<tr class="new" oninput={mark('operation:new')}>
					<td><input class="mono short" name="code" form="operation:new" placeholder="new" aria-label="New operation code" /></td>
					<td><input name="description" form="operation:new" placeholder="description" aria-label="New operation description" /></td>
					<td></td>
					<td class="row-tools"><button type="submit" form="operation:new" disabled={!changed['operation:new']}>Add</button></td>
				</tr>
				{#if errorAt('operation:new')}<tr><td></td><td colspan="3" class="error small"><span role="alert">{errorAt('operation:new')}</span></td></tr>{/if}
			</tbody>
		</table>
	</section>
{/if}

<style>
	section { margin-top: 1.25rem; max-width: 70rem; }
	h2 { font-size: 1.05rem; margin: 0 0 0.4rem; }
	table.narrow { max-width: 44rem; }
	td.factor { white-space: nowrap; }
	td.factor input { width: 4.5rem; }
	tr.new td { border-bottom: none; padding-top: 0.5rem; }
</style>
