# WyattERP status

**Legend:** ⬜ Todo | 🔄 In progress | ✅ Done | ❓ Needs discussion | 🔮 Future

**Phase:** design, with a repository scaffold. The domain specifications are at draft 1. The
catalog module has an executable schema and a tested model in `@wyatt/core`; the other
modules have specifications only. Last updated November 2026.

## Repository layout

A yarn 4 workspace (`yarn build`, `yarn test`, `yarn typecheck`, `yarn cli modules`), modeled
on `ser/chat` (see `ser/chat/docs/app-family.md`):

| Path | Package | Role |
|---|---|---|
| `packages/domain` | `@wyatt/domain` | IDs (ULID), integer quantity and money arithmetic, partnames |
| `packages/bom-engine` | `@wyatt/bom-engine` | The parametric BOM engine. Only the request types and a stub `explode` so far |
| `packages/core` | `@wyatt/core` | Control logic per module strand: one folder and one entry point per module (`@wyatt/core/catalog`), shared results and SQL helpers at the root, and the multi-strand test (`src/multi-strand/`) |
| `apps/cli` | `@wyatt/cli` | Headless client, the first app target |

TypeScript (NodeNext, strict) and vitest. `core` uses the published Sereus stack
(`@serfab/cadre-core` 1.21, `@quereus/quereus` 4.25, Optimystic 1.25), pinned in the root
`resolutions` the way chat pins it.
**Adding a module** (parties, ops…): write `design/specs/domain/<module>.qsql` (the build generates
`<MODULE>_SCHEMA` from every `.qsql` there), then `packages/core/src/<module>/` with its sApp
config, model interface, implementation and contract suite, and an entry point
`./<module>` in core's `package.json`. `src/catalog/` is the pattern.

**Appeus** (installed November 2026, hosted mode): `design/` holds the project decisions
(`design/specs/project.md`), the domain contract (`design/specs/domain/`, moved from
`docs/specs/`), and stories and UI specs per target. App targets go under `apps/<target>`
beside `apps/cli`. One ERP app per platform (`web`, `mobile`), each module a section of it
(decision log). The per-module boundary is `@wyatt/core/<module>`, not the app folder.

## Resume here

There are two next steps, which are independent.

**A. Multi-strand test** (a quick experiment; ✅ steps 1–5, November 2026).
`packages/core/src/multi-strand/multi-strand.test.ts` runs real cadre-core nodes in one
process. Each module has a stand-in sApp (`sapps.ts`), and every strand is closed. The test
takes about 5 seconds, and it passed on three runs in a row.
1. ✅ One machine runs `catalog`, `ops` and `books` strands, **each of a different sApp**,
   with `strandFilter: { mode: 'all' }`. Each strand is its own `Database`, and none can
   name another's tables.
2. ✅ A cross-strand read joined in app code (PO lines in ops priced from parts in catalog).
3. ✅ The same read as **one SQL query**. `bridge.ts` registers a query on one strand's
   database as a table-valued function in another's (`… join catalog_part() p on …`).
   Limits: the whole remote relation is read on each call, nothing is pushed down, the
   column types are declared by hand, and both strands must be open on the same machine.
4. ✅ A receipt and its outbox posting are written in one ops transaction. The poster then
   applies it to books, "crashes" before marking it sent, and retries. There is exactly one
   books transaction, and books' unique `PostingId` rejects a duplicate.
5. ✅ A second party (the vendor) joins a closed `vendor` link strand by invitation
   (`createOpenInvitation` → `publishFormationInvite` → `formStrand` → `addStrand`). We
   publish an extract of open PO lines into it with one statement that reads ops and
   catalog through the bridge. The vendor reads the extract, and its bid replicates back to
   us. The vendor's machine holds only the link strand.
6. ✅ Requirements for the Sereus team: [sereus-requirements.md](sereus-requirements.md).
   Next, review it with Nate.
7. ✅ `foreign-claim.test.ts` documents a hazard in current Sereus: a joiner can claim a
   strand with a different sApp's schema, and nothing refuses it (§2 of that doc).

**B. BOM engine prototype** in `packages/bom-engine` ([domain/bom-engine.md](../design/specs/domain/bom-engine.md)), checked against
the 2014 ATI BOM corpus:

1. ⬜ QuickJS-wasm sandbox (`quickjs-emscripten`): one fresh scope per node, host API (§6),
   limits (§11), and an isolation test that tries to leak state between nodes.
2. ⬜ Explosion over an in-memory catalog snapshot: versions, parameter binding and
   normalization, `when`/`script`/`qty`/`child_params`, depth modes, rounding, result hash.
3. ⬜ Loader that turns the 2014 extract (`data/ati-2014/`, see
   [legacy/data-2014.md](legacy/data-2014.md)) into a catalog snapshot. Parse the `COPY`
   format with [../tools/legacy/pgcopy.py](../tools/legacy/pgcopy.py) or a TypeScript port of
   it.
4. ⬜ Tcl → JavaScript translator for `prd_spread` scripts (§12), with a list of the scripts it
   can't convert.
5. ⬜ Tcl oracle: run the original `spread.tcl` semantics (from
   `old/ati/src/tcl/lib/spread.tcl`, with no database or GUI) and compare results node by
   node.

The extract is local-only and git-ignored. If it is missing, re-create it with the recipe in
[legacy/data-2014.md](legacy/data-2014.md).

**C. Product manager** (the prodim successor). Build this now: it lives in one strand, and
needs no cross-strand joins, postings or Bonum.
1. ✅ Catalog schema [domain/catalog.qsql](../design/specs/domain/catalog.qsql). It is generated into
   `@wyatt/core` (`CATALOG_SCHEMA`, `catalogSAppConfig()`). `packages/core/src/catalog/`
   tests each rule in memory, and the main ones on a real strand.
2. ✅ Catalog model `@wyatt/core/catalog` (`src/catalog/`): `CatalogModel` (model.ts) with
   reference data, families, drafts saved as a whole, release, retire, minor revisions,
   parts (canonical values, next part number), standard packages and where-used.
   * **One implementation, two databases.** `createCatalogModel` is written against the
     strand's Quereus `Database`. `openStrandCatalog` runs it on a strand.
     `openMemoryCatalog` runs it on an in-memory database built from the same schema; this
     is the "mock", for UI work and demos, and it cannot drift from the strand's rules.
     `loadSampleCatalog` fills it with an illustrative hydroponics line.
   * **One contract suite** (`src/testing/catalog-contract.ts`, 12 tests) runs against both.
   * **Waiting on B:** release validation explosions, PartVersion rows, cycle checks.
   * **Read side kept small** until the UI stories say which queries the screens need.
3. ⬜ Hydroponics product line as the first real data set (small). The ATI 2014 corpus is
   loaded only as a volume test and a test of BOM scripting, never as working data.
4. 🔄 Appeus setup and the product section of the ERP app.
   * ✅ Appeus installed at the repository root (hosted mode); domain specs moved to
     `design/specs/domain/`.
   * ✅ `design/specs/project.md`: web in SvelteKit, mobile in React Native (owner, November
     2026). Publisher id still open.
   * ✅ Targets scaffolded: `apps/web` (SvelteKit, dependencies not yet installed) and
     `apps/mobile` (React Native 0.82.1, as chat; CocoaPods not yet installed).
   * 🔄 Stories, named `<module>-NN-<name>.md`: `design/stories/web/product-01…04`
     (engineer creating a family), drafts for the owner to edit.
   * ⬜ Wiring before the first screen: web joins the yarn workspace; mobile stays its own
     yarn project linked to `packages/*` as chat's is (Metro single-copy config, shims);
     Sereus node hosts per platform; mock variants from the in-memory catalog.
   * ⬜ Then: web navigation and screen specs, and screens one vertical slice at a time.
   * ⬜ Before the UI: three prodim topics product.md lacks: generic and custom "reserve"
     basenames, document templates, finding documents.

After these, the build order is:
1. catalog module (C above);
2. operations core: locations, moves, balances, coverage, orders;
3. purchasing and runs;
4. Bonum posting;
5. AP and AR;
6. vendor and shop strands, and the storefront.

## Deliverables

| Item | Status |
|---|---|
| Study of the ATI system (index, technical model, framework, findings) | ✅ [legacy/](legacy/README.md) |
| Questions to the owner, A–E (Q1–Q33) | ✅ answered: [legacy/Questions.md](legacy/Questions.md) |
| Open-source alternatives survey | ✅ [alternatives.md](alternatives.md) |
| Sereus and Bonum fit | ✅ [stack.md](stack.md) |
| Targeted extract of the 2014 production dump | ✅ local only: [legacy/data-2014.md](legacy/data-2014.md) |
| BOM scripting trial in JavaScript | ✅ [legacy/bom-scripting-js.md](legacy/bom-scripting-js.md) |
| Domain specifications, draft 1 | ✅ [domain/](../design/specs/domain/index.md) |
| Repository scaffold (yarn workspace: domain, bom-engine, core, cli) | ✅ |
| Multi-strand test (packages/core/src/multi-strand) | ✅ steps 1–5 |
| BOM engine prototype against the 2014 corpus | ⬜ next |
| Catalog schema ([domain/catalog.qsql](../design/specs/domain/catalog.qsql)), tested in memory and on a strand | ✅ |
| Catalog model (`@wyatt/core/catalog`), one contract suite in memory and on a strand | ✅ |
| Executable schemas of the other modules | ⬜ |
| Appeus project setup (stories, UI specs per target) | ⬜ |

## Decision log

Each decision cites the owner's answer (Q numbers are in [legacy/Questions.md](legacy/Questions.md)).
The reasoning is in [Design.md](Design.md).

| Decision | Source |
|---|---|
| Build on Sereus ("pass 4"), not adopt ERPNext, Odoo or InvenTree | Q7, Q8, Q13; [alternatives.md](alternatives.md) |
| Each module is its own strand; strands are the permission boundary | Q27 |
| One owning module per record; others keep their own related records | Q28 |
| Cross-strand reads by Quereus joins; writes by idempotent postings through an outbox | Q14, Q25, Nate |
| Ledger entries are posted, never derived from manufacturing data | Q25 |
| Receiving in operations; AP and AR are separate subledger strands; Bonum is the accountant's books | Q26, November 2026 |
| BOM engine outside the database, as a shared deterministic library | Findings, [Design.md](Design.md) §2 |
| BOM language: JavaScript in QuickJS-wasm (Lua or Tcl-wasm as fallbacks) | Q29, scripting trial |
| A field is an expression or a block (completion value); `when` guard, zero quantity drops the line, `skip()`, family script | scripting trial, owner's editorial comment |
| No interactive `prompt` in the engine | 2014 corpus analysis |
| Versions per family, `.N` suffix; part numbers never change with versions; interchangeable flag; `.0` = unknown; automatic minor revisions for notes and QC | Q31, November 2026 (working premise) |
| Parts are approved, stockable combinations; packages are never stocked and only explode on orders | Q20 |
| Make or buy per buy; in-house shops are suppliers | Q3 |
| Runs with a run ID and serials within the run | Q5 |
| Demand registered at commit; optional allocation; coverage view | owner, November 2026 |
| Re-explosion is manual, limited to the lines selected, and shows a diff | Q30 |
| Conscious purchasing: suggestions only (EOQ, price breaks, run size from run history, shelf life) | Q10, Q32 |
| Bids record `source` and `as_of`; prices refreshed by hand or by an AI assistant until vendors maintain their own | Q9 |
| Separate part numbers for physically different forms; purchase packaging is a conversion on the bid | Q6 |
| Locations are not accounts; valuation maps location types to Bonum accounts | Q15 |
| Integer quantities (per-unit scale) and integer money | Bonum convention |
| WyattERP is the parent brand. This repository, `sereus-erp`, is its Sereus-based incarnation; the ATI ERP and wylib, wyseman and wyselib are its legacy members | owner, November 2026 |
| Packages: `@wyatt/core` holds the control logic, and computational modules get specific names (`@wyatt/bom-engine`), never a general "engine" | owner, November 2026 |
| Partnames for engineering, part numbers for commerce: a number is issued when first needed, and operations that need one wait until it is confirmed | owner, November 2026 |
| One ERP app per platform (`web`, `mobile`), each module a section shown by strand membership; the product manager is the first section. Separate targets only for other parties (vendor, shop) | owner, November 2026 |

## Open items

* ❓ **Roles and signed writes in the schemas.** catalog.qsql records the writer (`Actor`)
  through mutation context, but the value is asserted by the writer, not verified. Role
  checks (product.md §9) need signed writes against the strand's member keys, as Taleus does
  with `verify(digest(…))`. To be designed once for all modules.

* 🔄 **Allocating part numbers across devices.** Owner's rule (November 2026): partnames
  for engineering, part numbers for commerce. A number is issued only when something needs
  one, and an operation that needs it is blocked until the number is confirmed
  ([domain/product.md](../design/specs/domain/product.md) §3). Numbers are in their own insert-only table,
  `PartNumber`, so that approval and numbering are separate writes.
  * **No sequences, by design.** Quereus has no sequence or auto-increment objects
    (`ser/quereus/docs/architecture.md`, "Sequential ID Generation"): validators re-execute
    a transaction's statements, so a value must come from the tables or the mutation
    context. A distributed sequence is "highest plus one" with optimistic concurrency.
    Taleus avoids running numbers altogether, using fresh IDs tagged `"optimystic.fresh"`.
  * ✅ **Online contention works.** `parts.number` takes the highest plus one and, when the
    insert is refused as a duplicate, tries the next number. `src/catalog/numbering.test.ts`
    numbers parts on two devices of one strand at the same moment, five rounds. In three
    runs there were 10 collisions in 15 rounds. The cohort refused each loser with the
    ordinary unique-constraint error, its second attempt took the next number, no number
    was given twice, and both devices converged.
  * ⬜ **Offline next.** Sereus offline mode (strands.md, "Offline mode" and "A commit's
    durability") saves a write locally, queues it, and reports `queued` → `committed` or
    `failed`, then `heldElsewhere` / `strand:commit-held`. A queued number that another
    device took first fails when sent, and its row leaves the local view. The plan:
    1. a test node with `strandOffline` and a journal (as taleus's Node host does);
    2. write each number with `returning StampId() as Tx`, and report its state from
       `offline.status(Tx)` and `commitDurability(Tx)` (taleus `store.ts` and chat
       `delivery.ts` are the references);
    3. on `failed`, issue the next number again;
    4. a part counts as numbered for orders only once its number is committed;
    5. the scenario: two devices number while partitioned, then reconnect.
    Known limit: durability reports are kept in memory, so after a restart a committed
    number shows as unconfirmed (Optimystic backlog
    `feat-a-host-can-ask-whether-an-earlier-commit-is-fully-held`).

* ✅ **Quereus multi-strand mechanism.** Sereus gives each strand its own `Database`, with
  its tables in schema `App`, and Quereus has no `ATTACH`. Cross-strand reads are therefore
  done in app code or through the table-valued-function bridge
  ([domain/architecture.md](../design/specs/domain/architecture.md) §5). Putting several strands in one
  `Database` is requested in [sereus-requirements.md](sereus-requirements.md) §3. Still to ask
  Nate: whether that composition is what he meant.
* ❓ **Apps sharing strands** ([sereus-requirements.md](sereus-requirements.md) §2).
  The owner's view: on mobile, one app per schema matters most. Where apps can share a
  filesystem, a super-app may act on several sApps' schemas.
  * **Today:** one process runs one node, and that node can carry strands of any number of
    sApps (shown in the multi-strand test). Two apps on one machine can't share a node: each
    app install is its own machine of the party.
  * **Hazard:** a claim isn't checked against the sApp recorded in `Strand.Header`.
    Requested Sereus fixes, in order:
    1. refuse a mismatched claim;
    2. put the sApp ID on the control `Strand` row;
    3. a filter that takes a list of sApp IDs;
    4. register an sApp once per node.
  * **Working default:** each sApp ships one control library (`@wyatt/core`, the planned
    `bonum-core`), and every app, a super-app included, goes through it for that sApp's
    strands. Rules that live only in app code hold only for apps that use the library, so
    they move into schema constraints where Quereus can express them.
  * **Open:** whether each WyattERP module is its own sApp (the working default; one schema
    per strand) or one sApp with several schemas.
* 🔮 **Cross-strand views** as a Sereus enhancement (requirements to write up for the Sereus
  team).
* ❓ Costing: FIFO layers are specified; moving average is open
  ([domain/operations.md](../design/specs/domain/operations.md)).
* ❓ Separation of duties between approvers (for example award vs. payment approval).
* 🔮 Archiving very old done moves into period summaries (not needed at startup volume).
* ⬜ AP and AR internals: only their boundaries are specified.
* ⬜ Parties beyond the fields operations needs.
* Bonum dependencies: non-destructive schema migrations (Bonum still rebuilds on schema
  change), and its own AP/AR plans, which this design moves into separate strands.

## Risks

* Sereus multi-device replication bugs, and Quereus performance at millions of moves (ATI
  reached 2.9 million). Bonum's notes on Quereus read performance apply
  (`ser/bonum/docs/quereus-perf.md`).
* Cross-strand consistency has no platform support yet.
* Keeping the sandbox deterministic across platforms.
* Opportunity cost against Bonum and the startup itself.
