# WyattERP status

**Legend:** ⬜ Todo | 🔄 In progress | ✅ Done | ❓ Needs discussion | 🔮 Future

**Phase:** design, with a repository scaffold. The domain specifications are at draft 1. The
workspace builds and its smoke tests pass, but the packages hold no domain logic yet. Last
updated November 2026.

## Repository layout

A yarn 4 workspace (`yarn build`, `yarn test`, `yarn typecheck`, `yarn cli modules`), modeled
on `ser/chat` (see `ser/chat/docs/app-family.md`):

| Path | Package | Role |
|---|---|---|
| `packages/domain` | `@wyatt/domain` | IDs (ULID), integer quantity and money arithmetic |
| `packages/bom-engine` | `@wyatt/bom-engine` | The parametric BOM engine. Only the request types and a stub `explode` so far |
| `packages/core` | `@wyatt/core` | Control logic per module strand. So far: the module table, and the multi-strand test (`src/multi-strand/`) |
| `apps/cli` | `@wyatt/cli` | Headless client, the first app target |

TypeScript (NodeNext, strict) and vitest. `core` uses the published Sereus stack
(`@serfab/cadre-core` 1.21, `@quereus/quereus` 4.25, Optimystic 1.25), pinned in the root
`resolutions` the way chat pins it.
GUI apps come with the appeus setup. They will go under `apps/<target>` and link to `core`,
and the specs will move to `design/specs/domain/`.

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

**B. BOM engine prototype** in `packages/bom-engine` ([specs/bom-engine.md](specs/bom-engine.md)), checked against
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

After these two, the build order is:
1. catalog module;
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
| Domain specifications, draft 1 | ✅ [specs/](specs/README.md) |
| Repository scaffold (yarn workspace: domain, bom-engine, core, cli) | ✅ |
| Multi-strand test (packages/core/src/multi-strand) | ✅ steps 1–5 |
| BOM engine prototype against the 2014 corpus | ⬜ next |
| Executable Quereus schemas (`schema.qsql` per module) | ⬜ |
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

## Open items

* ✅ **Quereus multi-strand mechanism.** Sereus gives each strand its own `Database`, with
  its tables in schema `App`, and Quereus has no `ATTACH`. Cross-strand reads are therefore
  done in app code or through the table-valued-function bridge
  ([specs/architecture.md](specs/architecture.md) §5). Putting several strands in one
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
  ([specs/operations.md](specs/operations.md)).
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
