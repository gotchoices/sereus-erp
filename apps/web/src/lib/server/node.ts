/**
 * This machine's WyattERP installation, run inside the web server process: the same
 * `Installation` the `wyatt` command runs (@wyatt/node), so a party set up from either works the
 * same in both (design/specs/domain/deployment.md §3).
 *
 * A folder never set up opens in phase `new`, and the app shows the first-run page
 * (settings-02): start a new installation, or join one by invitation. Nothing is founded until
 * the person chooses, except in development with WYATT_SEED=sample (`yarn dev`), which starts a
 * throwaway installation with the sample catalog.
 *
 * Settings from the environment:
 *   WYATT_HOME    the folder (default apps/web/.wyatt)
 *   WYATT_PORT    TCP port to listen on (default: any free port)
 *   WYATT_PUBLIC  a public name or address others can reach this machine at
 *
 * One installation per process. The dev server re-imports modules on change, so it is kept on
 * globalThis and reused.
 */
import { resolve } from 'node:path';
import { defaultNetwork, Installation } from '@wyatt/node';

const KEY = Symbol.for('wyatt.web.installation');
type Holder = { [KEY]?: Promise<Installation> };

export function installation(): Promise<Installation> {
	const holder = globalThis as Holder;
	holder[KEY] ??= open().catch((err) => {
		delete holder[KEY];
		throw err;
	});
	return holder[KEY];
}

/** The node an earlier version of this module started (before @wyatt/node), if a dev server still holds one. */
const LEGACY = Symbol.for('wyatt.web.node');

async function open(): Promise<Installation> {
	const legacy = (globalThis as { [LEGACY]?: Promise<{ stop(): Promise<void> }> })[LEGACY];
	if (legacy) {
		delete (globalThis as { [LEGACY]?: unknown })[LEGACY];
		await legacy.then((n) => n.stop()).catch(() => {});
	}
	const home = resolve(process.env.WYATT_HOME ?? '.wyatt');
	const port = process.env.WYATT_PORT ? Number(process.env.WYATT_PORT) : undefined;
	const network = defaultNetwork('desktop', {
		...(port !== undefined ? { port } : {}),
		...(process.env.WYATT_PUBLIC ? { publicHost: process.env.WYATT_PUBLIC } : {}),
	});
	const inst = await Installation.open({ home, network, log: (l) => console.info(`wyatt-web: ${l}`) });
	if (inst.phase === 'new' && process.env.WYATT_SEED === 'sample') {
		await inst.startNew({ machineLabel: 'development machine', company: 'Sample company', catalogName: 'Sample catalog', sample: true });
		console.info('wyatt-web: started a development installation with the sample catalog (WYATT_SEED=sample)');
	}
	return inst;
}

/** Stop the node and release the folder when the process ends. */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.once(signal, () => {
		const running = (globalThis as Holder)[KEY];
		void (running ? running.then((i) => i.stop()) : Promise.resolve()).finally(() => process.exit(0));
	});
}
