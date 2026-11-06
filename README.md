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
yarn cli modules
```

## Layout

```
README.md        this file
AGENTS.md        orientation for AI agents (CLAUDE.md links to it)
docs/
  Vision.md      goals, product strategy, constraints
  Design.md      design rationale
  STATUS.md      next steps, decision log, open items
  specs/         domain specifications (the contract; no UI)
  stack.md       Sereus and Bonum, as they matter here
  sereus-requirements.md  what WyattERP needs from Sereus
  alternatives.md  open-source ERP survey
  legacy/        study of the ATI ERP, and the owner's answers to the design questions
packages/
  domain/        @wyatt/domain: IDs, quantity and money arithmetic
  bom-engine/    @wyatt/bom-engine: the parametric BOM engine (pure, deterministic)
  core/          @wyatt/core: control logic for each module's strand
apps/
  cli/           @wyatt/cli: headless client
tools/legacy/    scripts used to analyze the ATI data
data/            local-only ATI data extract (git-ignored)
```

Start with [docs/README.md](docs/README.md).

## Built on

* [Sereus](../sereus): strands, cadres and the peer-to-peer fabric
* [Quereus](../quereus): the SQL engine
* [Bonum](../bonum): accounting
* Appeus, for the design-first app workflow (not yet set up here)

## License

*TBD*
