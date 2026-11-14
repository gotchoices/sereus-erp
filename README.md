# WyattERP on Sereus (sereus-erp)

**Parametric manufacturing control, built on Sereus.**

WyattERP is the parent brand. This repository is its Sereus-based incarnation. The legacy
members of the family are the wylib, wyseman and wyselib libraries (PostgreSQL and Tcl/Tk) and
the ATI ERP built on them, written 1990–2013 by the same author.

WyattERP runs product definition, inventory, purchasing and production for a company that
builds modular, configurable products. The first user is a startup making modular hydroponic
growing systems. Accounting is done in [Bonum](../bonum).

## What makes it different

* **Parametric products.** A product family takes parameters (`a:chan(1200,4)`), and its bill
  of materials is a small program that computes components, quantities and options from those
  parameters, recursively. Standard components are stocked. Customer systems are configured to
  order as packages that explode into those components.
* **Make or buy per buy.** Any assembly can be bought complete or built from components, by an
  outside vendor or an in-house shop, decided at each purchase.
* **Conscious purchasing.** People decide what to buy and from whom, and the system suggests
  economic quantities and shows the reasoning.
* **Modules as strands.** Catalog, operations, parties, payables and receivables are separate
  Sereus strands. Each owns its records, reads the others by cross-strand queries, and changes
  them only by posting. Vendors and shops take part through their own strands.

## Status

**Design phase.** The domain specifications are at draft 1, and the workspace is scaffolded
with no domain logic yet. There are two next steps. One is a spike that runs several strands
together. The other is a prototype of the parametric BOM engine, tested against the BOM corpus
from ATI. See [docs/STATUS.md](docs/STATUS.md).

```
yarn install
yarn build && yarn test
yarn wyatt help
```

**Standing up an installation:** a server runs the `wyatt` command
([apps/cli/README.md](apps/cli/README.md), with a quickstart), and desktops run the web app and
join it by invitation.

## Layout

```
README.md        this file
AGENTS.md        orientation for AI agents (CLAUDE.md links to it)
docs/
  Vision.md      goals, product strategy, constraints
  Design.md      design rationale
  STATUS.md      next steps, decision log, open items
  stack.md       Sereus and Bonum, as they matter here
  sereus-requirements.md  what WyattERP needs from Sereus
  alternatives.md  open-source ERP survey
  legacy/        study of the ATI ERP, and the owner's answers to the design questions
design/          appeus project: project decisions, stories and UI specs per target
  specs/domain/  domain specifications (the contract shared by every target; no UI)
mock/            mock data for UI variants (appeus)
packages/
  domain/        @wyatt/domain: IDs, quantity and money arithmetic
  bom-engine/    @wyatt/bom-engine: the parametric BOM engine (pure, deterministic)
  core/          @wyatt/core: control logic for each module's strand
  node/          @wyatt/node: one installation on a machine (Sereus node, keys, folder), for every client
apps/
  cli/           @wyatt/cli: the wyatt command, for servers and terminals
  web/           @wyatt/web: the web app (SvelteKit)
tools/legacy/    scripts used to analyze the ATI data
data/            local-only ATI data extract (git-ignored)
```

Start with [docs/README.md](docs/README.md).

## Running the web app

```bash
yarn install && yarn build            # the packages the app uses
cd apps/web && yarn dev               # http://localhost:5173, on a real Sereus node
```

The node keeps its keys and data in `apps/web/.wyatt/` (git-ignored; `WYATT_HOME` sets
another folder, `WYATT_PORT` and `WYATT_PUBLIC` its network). `yarn dev` sets
`WYATT_SEED=sample`, so on first start it starts a throwaway installation with a small sample
catalog. For real use, `yarn app` runs it on `~/.wyatt-web` at http://localhost:5180 with no
sample. Without it (`yarn build && yarn start`, or `WYATT_SEED=none`), a new folder opens on
the first-run page: start a new installation, or join one by invitation. Delete the folder to
start over. `yarn dev:mock` runs on an in-memory catalog instead, with
`?variant=happy|empty|error` for review states.

`yarn dev_loop [port]` (default 5174) runs the dev server and starts it again whenever it
exits, on the same port; kill the server process to restart it, Ctrl-C to end the loop.

With the private ATI extract in `data/` (see [tools/legacy/README.md](tools/legacy/README.md)),
`yarn import:ati` loads ATI's 2014 catalog into a separate node folder, `data/wyatt-ati`, as
test data, and `yarn dev:ati` serves it on port 5175. Stop `dev:ati` while importing.

## Built on

* [Sereus](../sereus): strands, cadres and the peer-to-peer fabric
* [Quereus](../quereus): the SQL engine
* [Bonum](../bonum): accounting
* Appeus, for the design-first app workflow (not yet set up here)

## License

*TBD*
