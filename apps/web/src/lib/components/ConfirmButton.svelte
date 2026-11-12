<script lang="ts">
	/** A destructive action confirmed in place: the first click asks, the second submits. No browser dialogs. */
	let { label, confirm, formaction }: { label: string; confirm: string; formaction: string } = $props();
	let asking = $state(false);
</script>

{#if asking}
	<span class="ask">
		<button type="submit" {formaction} class="danger">{confirm}</button>
		<button type="button" onclick={() => (asking = false)}>Cancel</button>
	</span>
{:else}
	<button type="button" onclick={() => (asking = true)}>{label}</button>
{/if}

<style>
	.ask {
		display: inline-flex;
		gap: 0.25rem;
	}
	.danger {
		color: var(--danger);
	}
</style>
