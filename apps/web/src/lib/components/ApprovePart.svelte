<script lang="ts">
	/** ApprovePart dialog (design/generated/web/screens/PartList.md). */
	import { enhance } from '$app/forms';
	import { canonicalNumber, formatPartname, parsePartname } from '@wyatt/domain';
	import type { ParameterDef } from '@wyatt/core/catalog';
	import { partHref } from '$lib/links';

	let {
		families, fixedBase = null, action, keep = '', open = $bindable(false),
		error = null, existing = null, values = null, returnedBase = null,
	}: {
		families: { base: string; description: string }[];
		fixedBase?: string | null;
		action: string;
		keep?: string;
		open?: boolean;
		error?: string | null;
		existing?: string | null;
		values?: string[] | null;
		returnedBase?: string | null;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let base = $state('');
	let entered: string[] = $state([]);
	let params: ParameterDef[] = $state([]);
	let lookupError: string | null = $state(null);
	let pasted = $state('');
	let pasteError: string | null = $state(null);
	let busy = $state(false);

	async function load(b: string, keepValues: string[] | null = null): Promise<void> {
		base = b;
		params = [];
		lookupError = null;
		if (!b) return;
		const r = await fetch(`/product/api/params?base=${encodeURIComponent(b)}${keep ? `&${keep}` : ''}`);
		const body = await r.json();
		if (!body.ok) { lookupError = body.error; return; }
		params = body.parameters;
		entered = params.map((p, i) => keepValues?.[i] ?? '');
	}

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			const b = returnedBase ?? fixedBase ?? base ?? '';
			void load(b, values);
			pasted = '';
			pasteError = null;
			dialog.showModal();
		}
		if (!open && dialog.open) dialog.close();
	});

	function usePartname(): void {
		pasteError = null;
		try {
			const p = parsePartname(pasted);
			if (p.kind !== 'config') { pasteError = 'That is a part number; enter a partname such as a:chan(1200,6,75).'; return; }
			if (fixedBase && p.base !== fixedBase) { pasteError = `This dialog approves parts of ${fixedBase}.`; return; }
			void load(p.base, p.params);
		} catch {
			pasteError = 'Partnames look like a:chan(1200,6,75).';
		}
	}

	// The partname as it will be stored: blanks take the default, numbers in canonical form.
	const preview = $derived(base && params.length === entered.length
		? formatPartname(base, entered.map((v, i) => {
			const value = v.trim() || params[i]?.defaultValue || '?';
			return params[i]?.type === 'num' ? (canonicalNumber(value) ?? value) : value;
		}))
		: base);
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="approve-title">
	<form
		method="POST"
		{action}
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<h2 id="approve-title">Approve a configuration{fixedBase ? ` of ${fixedBase}` : ''}</h2>
		<p class="muted small">It becomes a part, without a number. A number is issued when an order, PO or stock record first needs one.</p>

		<label class="paste">Partname
			<span class="row">
				<input class="mono" bind:value={pasted} placeholder="a:chan(1200,6,75)" aria-label="Partname" onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), usePartname())} />
				<button type="button" onclick={usePartname}>Use</button>
			</span>
		</label>
		{#if pasteError}<p class="error small">{pasteError}</p>{/if}

		{#if fixedBase}
			<input type="hidden" name="base" value={fixedBase} />
		{:else}
			<label>Family
				<select name="base" value={base} onchange={(e) => load(e.currentTarget.value)} required>
					<option value="">(choose)</option>
					{#each families as f (f.base)}<option value={f.base}>{f.base}: {f.description}</option>{/each}
				</select>
			</label>
		{/if}
		{#if lookupError}<p class="error small">{lookupError}</p>{/if}

		{#if params.length}
			<div class="values">
				{#each params as p, i (p.pos)}
					<label>
						<span><span class="mono">{p.var}</span> <span class="muted">{p.description}</span></span>
						{#if p.type === 'enum'}
							<select name="value" bind:value={entered[i]}>
								<option value="">{p.defaultValue ? `(default ${p.defaultValue})` : '(choose)'}</option>
								{#each p.allowed as a (a.value)}<option value={a.value}>{a.value}: {a.description}</option>{/each}
							</select>
						{:else}
							<input name="value" class="mono" bind:value={entered[i]} placeholder={p.defaultValue ?? ''} />
							{#if p.type === 'num'}
								<span class="muted small">{p.unitCode ?? ''}{p.min !== null || p.max !== null ? `, ${p.min ?? ''} to ${p.max ?? ''}` : ''}</span>
							{/if}
						{/if}
					</label>
				{/each}
			</div>
		{:else if base && !lookupError}
			<p class="muted small">This family takes no parameters.</p>
		{/if}

		{#if base}<p>Part: <code>{preview}</code></p>{/if}
		{#if error}
			<p class="error" role="alert">{error}{#if existing}{' '}<a href={partHref(existing, keep)}>Open it</a>{/if}</p>
		{/if}

		<div class="actions">
			<button type="button" onclick={() => (open = false)}>Cancel</button>
			<button type="submit" class="primary" disabled={busy || !base}>{busy ? 'Approving…' : 'Approve'}</button>
		</div>
	</form>
</dialog>

<style>
	dialog { border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); width: 32rem; }
	h2 { margin: 0 0 0.25rem; font-size: 1.15rem; }
	label { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.6rem; }
	.row { display: flex; gap: 0.4rem; }
	.row input { flex: 1; }
	.values { border-top: 1px solid var(--border); padding-top: 0.6rem; }
	.actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
