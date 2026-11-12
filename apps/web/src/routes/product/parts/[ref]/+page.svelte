<script lang="ts">
	/** PartDetail (design/generated/web/screens/PartDetail.md). */
	import { enhance } from '$app/forms';
	import { formatScaled } from '@wyatt/domain';
	import type { ActionData, PageData } from './$types';
	import { familyHref, partsHref, versionHref } from '$lib/links';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const p = $derived(data.part);
	const f = $derived(data.family);
	const keep = $derived(data.keep);
	const scale = $derived(data.unit?.scale ?? 0);
	const qty = (v: number | null) => (v === null ? '' : formatScaled(v, scale));
	const act = (name: string) => `?/${name}${keep ? `&${keep}` : ''}`;
	let busy = $state(false);
	const done = () => {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { busy = false; await update({ reset: false }); };
	};
</script>

<svelte:head><title>{p.partname} · WyattERP</title></svelte:head>

<p class="crumbs"><a href={partsHref(keep)}>Parts</a> ›</p>
<header>
	<h1 class="mono">{p.partname}</h1>
	<p class="desc">{f.description}</p>
	<p class="facts muted">
		Family <a class="mono" href={familyHref(f.base, keep)}>{f.base}</a>
		{#if f.currentVer !== null}· defined by <a class="mono" href={versionHref(f.base, f.currentVer, keep)}>{f.base}.{f.currentVer}</a>{/if}
	</p>
</header>

<section class="number">
	<h2>Part number</h2>
	{#if p.pnum !== null}
		<p class="pnum mono">{p.pnum}</p>
	{:else}
		<p>No number yet. Numbers are for orders, POs, inventory and customer part lists; they are issued only when needed.</p>
		<form method="POST" action={act('number')} use:enhance={done}>
			<button type="submit" class="primary" disabled={busy}>Issue a number</button>
		</form>
	{/if}
</section>

<form method="POST" action={act('save')} class="fields" use:enhance={done}>
	<section>
		<h2>Status</h2>
		<select name="status" value={p.status} aria-label="Status">
			<option value="proposed">proposed</option><option value="active">active</option>
			<option value="restricted">restricted (no new orders or buys)</option><option value="obsolete">obsolete</option>
		</select>
	</section>

	<section>
		<h2>Stock policy <span class="muted small">(in {data.unit ? `${data.unit.name}, ${data.unit.code}` : f.unitCode})</span></h2>
		<div class="grid">
			<label>Minimum level (reorder point) <input name="minLevel" value={qty(p.minLevel)} inputmode="decimal" /></label>
			<label>Target level <input name="targetLevel" value={qty(p.targetLevel)} inputmode="decimal" /></label>
			<label>Minimum buy <input name="minBuy" value={qty(p.minBuy)} inputmode="decimal" /></label>
		</div>
	</section>

	<section>
		<h2>Tracking and shelf life</h2>
		<div class="grid">
			<label>Tracking
				<select name="tracking" value={p.tracking}>
					<option value="none">none</option><option value="run">by run (lot)</option><option value="serial">by serial number</option>
				</select>
			</label>
			<label>Shelf life (days) <input name="shelfLifeDays" value={p.shelfLifeDays ?? ''} inputmode="numeric" /></label>
		</div>
	</section>

	<section>
		<h2>Physical</h2>
		<div class="grid">
			<label>Weight (g) <input name="weight" value={p.weight ?? ''} inputmode="numeric" /></label>
			<label>Length (mm) <input name="length" value={p.length ?? ''} inputmode="numeric" /></label>
			<label>Width (mm) <input name="width" value={p.width ?? ''} inputmode="numeric" /></label>
			<label>Height (mm) <input name="height" value={p.height ?? ''} inputmode="numeric" /></label>
			<label>Stack factor <input name="stackFactor" value={p.stackFactor ?? ''} inputmode="numeric" /></label>
		</div>
	</section>

	<section>
		<h2>Comment</h2>
		<textarea name="comment" rows="2">{p.comment ?? ''}</textarea>
	</section>

	<div class="save">
		<button type="submit" class="primary" disabled={busy}>Save</button>
		{#if form && 'saved' in form && form.saved}<span class="muted" role="status">Saved.</span>{/if}
		{#if form?.error}<span class="error" role="alert">{form.error}</span>{/if}
	</div>
</form>

<style>
	.crumbs { margin: 0 0 0.25rem; font-size: 0.9rem; }
	h1 { margin-bottom: 0.1rem; }
	.desc { margin: 0; font-size: 1.05rem; }
	.facts { margin: 0.25rem 0 0.75rem; font-size: 0.9rem; }
	section { margin-top: 1rem; }
	h2 { font-size: 1.05rem; margin: 0 0 0.4rem; }
	.pnum { font-size: 1.6rem; margin: 0; }
	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.6rem; max-width: 60rem; }
	.grid label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.9rem; }
	textarea { width: 100%; max-width: 60rem; box-sizing: border-box; }
	.save { display: flex; gap: 0.75rem; align-items: center; margin-top: 1rem; }
</style>
