# Sereus stack and Bonum: what matters for an ERP

Summarized from a read-only survey of the sibling projects in `ser/` (November 2026). Verify the details against
the repositories, because they change quickly.

## Stack, from top to bottom

| Layer | Component | Notes |
|---|---|---|
| Apps | bonum, chat, health, taleus, votetorrent | TypeScript. Bonum's web app uses SvelteKit with Svelte 5 |
| Fabric | `sereus/` (`@serfab/cadre-*`, `quereus-plugin-sereus`) | A **strand** is an invite-only shared SQL database with role-based permissions enforced in the schema. A **cadre** is one party's own devices. Docs: `sereus/docs/architecture.md`, `schema-guide.md`, `strands.md`, `strand-contracts.md` |
| SQL engine | `quereus/` | Pure-TS SQL. Declarative schema with `diff`/`apply` migrations, CHECKs, FKs, **global assertions**, mutation context (for RBAC and signatures), incrementally maintained **materialized views**, `db.watch`, and `quereus-sync` (column-level CRDT) |
| Database | `optimystic/` | Distributed ACID over replicated block storage, with optimistic concurrency validated by re-running the SQL |
| Network | `fret/`, libp2p | Ring overlay for discovery |
| Storage | IndexedDB, LevelDB (`rn-leveldb`) | |
| Dev process | `appeus-*`, `appgen` | Design-first, AI-assisted workflow: stories, then specs, then code |

**Maturity:** a single node holding its own data works well. Multi-device replication still has open
bugs (reads intermittently fail when a block is held by only one machine, a control-collection
fork, and concurrent joins that don't converge). See `sereus/README.md` §Status and `sereus/tickets/`.

## Bonum today

* Double-entry, multi-entity, multi-currency accounting with "generalized units". The schema is
  `design/specs/domain/schema.qsql`.
* Tables: `unit` (FIAT, CRYPTO, COMMODITY, SECURITY, **INVENTORY**, OTHER), `account_group`,
  `entity` (default costing method FIFO/LIFO/AVERAGE), `partner` (VENDOR/CUSTOMER/BOTH),
  `account` (has a unit, costing method, partner), hierarchical `tag`, `txn` (reckoning unit),
  `entry` (amount in the account's unit, value in the reckoning unit), `reconciliation`, `exchange`.
  Amounts are integers in the smallest unit.
* Works: GnuCash import (17.7k transactions), ledger, reports, AI assistant. Not built yet:
  partners UI, invoices, AP/AR, reconciliation UI, period close, multi-user sharing, mobile app.
* There are **no project or cost-center tables**. Jobs are meant to be handled with Tags plus a
  "Jobs in Process" account group.
* Business logic is split: CHECKs and FKs in the schema, but the transaction balance check and
  cascading deletes live in app code (`src/lib/report/convert.ts`, `production/service.ts`).
* Schema changes currently rebuild the database (`SCHEMA_VERSION`), which discards the data.
* There is no module, plugin or shared-schema mechanism. `packages/shared/` is planned.

## The key conceptual fit

Bonum's units model already says that **an inventory account holds a balance in widgets**, and
that buying stock has the same structure as buying currency. ATI's MTR register is the same idea
applied to quantity:

| ATI | Bonum analogue |
|---|---|
| Project (inventory, WIP, shop, job) | Account (or account + tag) with unit = part number |
| MTR (pnum, qty, from project → to project) | Transaction with two entries in the part's unit, plus a value in the reckoning unit |
| MTR status `clsd` | A posted transaction |
| MTR status `work`/`open` | **Not modeled.** Would need "planned/committed" transactions, or a separate planning register |
| `summtr_*` stock views | Account balances (materialized views) |
| FIFO cost from AP (`mtr_pn_cost`) | Bonum's cost basis on entries plus the costing method |

So a manufacturing module could post *closed* material movements to Bonum as quantity-plus-value
entries and keep the planning statuses in its own register. The alternative is to make the ERP's
MTR register the subledger, with summarized postings to the GL. That choice is an open question.

## Precedent

**Taleus** is an older wyseman/PostgreSQL app (MyCHIPs) being rebuilt on Sereus, with its rules
moved into Quereus constraints. It is the template for how a pass-2 ATI schema would be ported.

## Natural Sereus fits for ERP features

* **Vendor portal (vendbid)**: one strand per vendor relationship. The vendor's own devices hold and
  edit their bids, and ATI-side roles award and issue POs. Permissions live in the schema, and
  there is no hosted portal to run.
* **Contract shops and in-house shops**: a work-order strand shared with the shop. The shop closes
  material and finished-goods MTRs from its side.
* **Customers**: an order and RMA strand, if ever wanted.
