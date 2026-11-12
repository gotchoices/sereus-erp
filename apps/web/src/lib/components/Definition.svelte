<script lang="ts">
	/** A version's definition, read-only (VersionView). Same sections as DraftEditor. */
	import type { Version } from '@wyatt/core/catalog';

	let { v, base }: { v: Version; base: string } = $props();
	const typeName = { num: 'number', enum: 'choice', str: 'text' } as const;
	const noteType = { step: 'Instruction', fig: 'Figure', qc: 'QC' } as const;
	const docName = (id: string | null) => (id ? (v.documents.find((d) => d.id === id)?.name ?? 'document') : '');
</script>

<section>
	<h2>Specification</h2>
	{#if v.spec}<p class="spec">{v.spec}</p>{:else}<p class="muted">None.</p>{/if}
	{#if v.explodeDefault !== 'none' || v.familyScript || v.priceFormula}
		<p class="muted small">
			Explode on orders: {v.explodeDefault}{v.familyScript ? ' · has a family script' : ''}{v.priceFormula ? ` · price: ${v.priceFormula}` : ''}
		</p>
	{/if}
</section>

<section>
	<h2>Parameters</h2>
	<p class="muted">Partnames: <code>{v.parameters.length ? `${base}(${v.parameters.map((p) => p.var).join(',')})` : base}</code></p>
	{#if v.parameters.length}
		<table>
			<thead><tr><th></th><th>Name</th><th>Type</th><th>Unit</th><th>Description</th><th>Default</th><th>Range or values</th></tr></thead>
			<tbody>
				{#each v.parameters as p (p.pos)}
					<tr>
						<td class="order">{p.pos}</td><td class="mono">{p.var}</td><td>{typeName[p.type]}</td><td class="mono">{p.unitCode ?? ''}</td>
						<td>{p.description}</td><td class="mono">{p.defaultValue ?? ''}</td>
						<td>
							{#if p.type === 'enum'}{p.allowed.map((a) => `${a.value} (${a.description})`).join(', ')}
							{:else if p.min !== null || p.max !== null}{p.min ?? ''} – {p.max ?? ''}{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section>
	<h2>BOM lines</h2>
	{#if v.lines.length === 0}<p class="muted">None.</p>{:else}
		<table>
			<thead><tr><th></th><th>Component</th><th>Quantity</th><th>Applies when</th><th>Step</th><th>Comment</th></tr></thead>
			<tbody>
				{#each v.lines as l (l.pos)}
					<tr>
						<td class="order">{l.pos}</td>
						<td class="mono">{l.component}{l.childParams.length ? `(${l.childParams.join(', ')})` : ''}{l.childVer ? `.${l.childVer}` : ''}</td>
						<td class="mono">{l.qty}</td><td class="mono">{l.when ?? ''}</td><td>{l.processIdx ?? ''}</td><td>{l.comment ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section>
	<h2>Routing</h2>
	{#if v.processes.length === 0}<p class="muted">None.</p>{:else}
		<table>
			<thead><tr><th>Step</th><th>Operation</th><th>Next</th><th>Setup</th><th>Labor / unit</th><th>Machine / unit</th><th>Description</th></tr></thead>
			<tbody>
				{#each v.processes as p (p.idx)}
					<tr>
						<td class="order">{p.idx}</td><td class="mono">{p.operationCode}</td><td>{p.nextIdx ?? 'end'}</td>
						<td class="mono">{p.setupTime ?? ''}</td><td class="mono">{p.laborPerUnit ?? ''}</td><td class="mono">{p.machinePerUnit ?? ''}</td><td>{p.description ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section>
	<h2>Notes and QC</h2>
	{#if v.notes.length === 0}<p class="muted">None.</p>{/if}
	{#each v.processes as p (p.idx)}
		{@const notes = v.notes.filter((n) => n.processIdx === p.idx)}
		{#if notes.length}
			<h4>Step {p.idx} {p.operationCode}{p.description ? `: ${p.description}` : ''}</h4>
			<ul class="notes">
				{#each notes as n (n.id)}
					<li>
						<strong>{noteType[n.type]}</strong> {n.body}
						{#if n.measure}
							<span class="muted">
								· {n.measure.name}{'passfail' in n.measure ? ': pass / fail' : `: ${n.measure.nominal ?? ''} ${n.measure.units} (${n.measure.min ?? ''} – ${n.measure.max ?? ''})`}
							</span>
						{/if}
						{#if n.documentId}<span class="muted"> · see {docName(n.documentId)}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
</section>

<section>
	<h2>Documents</h2>
	{#if v.documents.length === 0}<p class="muted">None.</p>{:else}
		<ul>{#each v.documents as d (d.id)}<li>{d.kind}: {d.name} <span class="mono muted">{d.contentRef}</span></li>{/each}</ul>
	{/if}
</section>

<style>
	section { margin-top: 1.25rem; }
	h2 { font-size: 1.05rem; margin: 0 0 0.4rem; }
	h4 { margin: 0.4rem 0 0.2rem; font-size: 0.95rem; }
	.spec { white-space: pre-wrap; margin: 0; }
	.notes { margin: 0; padding-left: 1.2rem; }
</style>
