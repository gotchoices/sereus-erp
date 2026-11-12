import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Our own packages go through Vite rather than Node's module cache, so a rebuilt
	// @wyatt/core (yarn build) reaches the running dev server without a restart. The Sereus
	// stack stays external: the node started by src/lib/server/node.ts keeps running.
	ssr: { noExternal: [/^@wyatt\//] },
});
