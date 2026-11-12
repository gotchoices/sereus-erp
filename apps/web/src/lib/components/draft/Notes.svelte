<script lang="ts">
	/** Notes and QC, grouped by step (DraftEditor consolidation, section 5). */
	import type { DocumentDef, Measure, NoteDef, ProcessDef } from '@wyatt/core/catalog';
	import { newNote } from '$lib/draft';

	let { notes = $bindable(), processes, documents }: { notes: NoteDef[]; processes: ProcessDef[]; documents: DocumentDef[] } = $props();

	type Kind = 'none' | 'range' | 'passfail';
	const kindOf = (m: Measure | null): Kind => (!m ? 'none' : 'passfail' in m ? 'passfail' : 'range');
	function setKind(n: NoteDef, k: Kind): void {
		n.measure = k === 'none' ? null : k === 'passfail' ? { name: n.measure?.name ?? '', passfail: true } : { name: n.measure?.name ?? '', units: '', nominal: null, min: null, max: null };
	}
	const orphans = $derived(notes.filter((n) => !processes.some((p) => p.idx === n.processIdx)));
</script>

{#if processes.length === 0}
	<p class="muted">Notes belong to routing steps. Add a step first.</p>
{/if}
{#each processes as p (p.idx)}
	<div class="step">
		<h4>Step {p.idx} {p.operationCode}{p.description ? `: ${p.description}` : ''}</h4>
		{#each notes as n, i (i)}
			{#if n.processIdx === p.idx}
				<div class="note">
					<select bind:value={n.type} aria-label="Note type" onchange={() => n.type !== 'qc' && (n.measure = null)}>
						<option value="step">instruction</option><option value="fig">figure</option><option value="qc">QC check</option>
					</select>
					<textarea rows="2" bind:value={n.body} aria-label="Note text"></textarea>
					<select bind:value={n.documentId} aria-label="Document">
						<option value={null}>(no document)</option>
						{#each documents as d (d.id)}<option value={d.id}>{d.name || d.kind}</option>{/each}
					</select>
					<button type="button" onclick={() => notes.splice(i, 1)} aria-label="Remove note">✕</button>
					{#if n.type === 'qc'}
						{@const kind = kindOf(n.measure)}
						<div class="measure">
							<select value={kind} onchange={(e) => setKind(n, e.currentTarget.value as Kind)} aria-label="Measurement">
								<option value="none">no measurement</option><option value="range">measured value</option><option value="passfail">pass / fail</option>
							</select>
							{#if n.measure}
								<input class="mid" bind:value={n.measure.name} placeholder="what is checked" aria-label="Measure name" />
								{#if 'units' in n.measure}
									<input class="tiny" bind:value={n.measure.units} placeholder="mm" aria-label="Units" />
									<input class="short" type="number" step="any" bind:value={n.measure.nominal} placeholder="nominal" aria-label="Nominal" />
									<input class="short" type="number" step="any" bind:value={n.measure.min} placeholder="min" aria-label="Min" />
									<input class="short" type="number" step="any" bind:value={n.measure.max} placeholder="max" aria-label="Max" />
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		{/each}
		<button type="button" onclick={() => notes.push(newNote(p.idx))}>+ Note</button>
	</div>
{/each}
{#if orphans.length}<p class="error small">{orphans.length} note(s) belong to a removed step and will be refused on save.</p>{/if}

<style>
	.step { margin-bottom: 0.75rem; }
	h4 { margin: 0.4rem 0; font-size: 0.95rem; }
	.note { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: flex-start; margin-bottom: 0.4rem; }
	.note textarea { flex: 1; min-width: 20rem; }
	.measure { flex-basis: 100%; display: flex; gap: 0.4rem; padding-left: 6.5rem; }
</style>
