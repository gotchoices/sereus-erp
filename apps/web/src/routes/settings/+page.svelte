<script lang="ts">
	/** Settings (design/generated/web/screens/Settings.md). */
	import type { PageData } from './$types';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();
	const d = $derived(data.device);
	const variant = $derived(page.data.status?.variant ?? null);

	const short = (id: string) => (id.length > 12 ? `…${id.slice(-12)}` : id);
	let copied: string | null = $state(null);
	async function copy(id: string) {
		try {
			await navigator.clipboard.writeText(id);
			copied = id;
			setTimeout(() => { if (copied === id) copied = null; }, 1500);
		} catch {
			copied = null;
		}
	}

	const stateWords: Record<string, string> = {
		syncing: 'syncing: waiting for its first data from another member',
	};
	const stateText = (s: string) => stateWords[s] ?? s;

	function ago(ms: number | null): string {
		if (ms === null) return 'not yet';
		const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.round(s / 60)} min ago`;
		if (s < 86400) return `${Math.round(s / 3600)} h ago`;
		return `${Math.round(s / 86400)} days ago`;
	}
	const exact = (ms: number | null) => (ms === null ? '' : new Date(ms).toLocaleString());
	const others = $derived(d?.machines?.filter((m) => !m.self) ?? []);
</script>

<svelte:head><title>Settings · WyattERP</title></svelte:head>

<h1>Settings</h1>

{#snippet id(value: string)}
	<span class="mono" title={value}>{short(value)}</span>
	<button type="button" class="small" onclick={() => copy(value)}>{copied === value ? 'Copied' : 'Copy'}</button>
{/snippet}

{#if data.error}
	<p class="error" role="alert">{data.error}</p>
{:else if !d}
	<p>This app is running on an in-memory catalog{variant ? ` (variant ${variant})` : ''}. There is no device or strand.</p>
{:else}
	<section>
		<h2>This device</h2>
		<dl>
			<dt>ID</dt>
			<dd>{#if d.peerId}{@render id(d.peerId)}{:else}<span class="muted">unknown</span>{/if}</dd>
			<dt>Role</dt>
			<dd>{d.owner === null ? 'unknown' : d.owner ? 'Owner of the party' : 'Member'}</dd>
			<dt>Data folder</dt>
			<dd class="mono">{d.home}</dd>
		</dl>
	</section>

	<section>
		<h2>Machines of the party</h2>
		{#if d.machines === null}
			<p class="muted">Unknown: the machine list could not be read.</p>
		{:else if others.length === 0}
			<p>Only this device.</p>
		{:else}
			<table>
				<thead><tr><th>ID</th><th></th><th>Last heard from</th></tr></thead>
				<tbody>
					{#each d.machines as m (m.peerId)}
						<tr>
							<td>{@render id(m.peerId)}</td>
							<td>{m.self ? 'this device' : m.trusted ? 'trusted' : 'not trusted'}</td>
							<td title={exact(m.lastHeard)}>{m.self ? '' : ago(m.lastHeard)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section>
		<h2>Strands</h2>
		{#if d.strands.length === 0}
			<p>This device holds no strands yet.</p>
		{:else}
			<table>
				<thead><tr><th>Strand</th><th>ID</th><th>State</th><th>Mode</th><th>Not connected</th></tr></thead>
				<tbody>
					{#each d.strands as s (s.id)}
						<tr>
							<td>{s.catalog ? 'Catalog' : (s.sAppId ?? 'unknown')}{#if s.inUse}<span class="muted small in-use">(in use)</span>{/if}</td>
							<td>{@render id(s.id)}</td>
							<td>{stateText(s.status)}</td>
							<td>{s.offline ?? 'unknown'}</td>
							<td title={s.unreached?.join('\n') ?? ''}>
								{#if s.unreached === null}<span class="muted">unknown</span>
								{:else if s.unreached.length === 0}<span class="muted">none</span>
								{:else}{s.unreached.length} {s.unreached.length === 1 ? 'machine' : 'machines'}{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section>
		<h2>Connection</h2>
		<p>
			{#if d.connected === null}Connections unknown.
			{:else if others.length === 0 && d.connected === 0}No other machines of the party to connect to yet.
			{:else}{d.connected} of the party's other machines connected.{/if}
		</p>
		{#if d.addresses === null}
			<p class="muted">Listen addresses unknown.</p>
		{:else if d.addresses.length === 0}
			<p class="muted">Not listening: other machines cannot reach this device yet.</p>
		{:else}
			<ul class="mono small">{#each d.addresses as a (a)}<li>{a}</li>{/each}</ul>
		{/if}
	</section>
{/if}

<style>
	section { margin-top: 1.25rem; max-width: 60rem; }
	h2 { font-size: 1.05rem; margin: 0 0 0.4rem; }
	dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 0; }
	dt { color: var(--text-2); }
	dd { margin: 0; display: flex; gap: 0.5rem; align-items: center; }
	button.small { font-size: 0.75rem; padding: 0.05rem 0.4rem; }
	.in-use { margin-left: 0.35rem; }
	ul { margin: 0; padding-left: 1.2rem; }
</style>
