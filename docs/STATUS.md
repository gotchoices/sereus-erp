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
| `packages/core` | `@wyatt/core` | Control logic per module strand. Only the module table so far |
| `apps/cli` | `@wyatt/cli` | Headless client, the first app target |

TypeScript (NodeNext, strict) and vitest. The Sereus and Quereus packages are not dependencies
yet. The multi-strand spike adds them to `core`, pinned with `resolutions` the way chat does.
GUI apps come with the appeus setup. They will go under `apps/<target>` and link to `core`,
and the specs will move to `design/specs/domain/`.

## Resume here

There are two next steps, which are independent.

**A. Multi-strand spike** in `packages/core` tests, run before the per-module schemas are
written because its result may change [specs/architecture.md](specs/architecture.md) §5:
1. ⬜ Add `@serfab/cadre-core` and `@quereus/quereus`, and an in-process node host like
   `ser/chat/packages/core/src/testing/node-host.ts`.
2. ⬜ Two parties. One holds stub `catalog`, `ops` and `books` strands, and both share a
   `vendor:X` strand.
3. ⬜ A cross-strand read joined in app code (a PO line in ops against a part in catalog).
4. ⬜ An idempotent posting from the ops outbox into books. Kill the poster partway through
   and retry it.
5. ⬜ A published extract from ops into the vendor strand, read by the vendor's node.
6. ⬜ Write up the friction as requirements for the Sereus team: composing strands into one
   `Database`, and cross-strand views.

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
| Multi-strand spike | ⬜ next |
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

* ❓ **Quereus multi-strand mechanism:** how a cadre node attaches several strands as named
  schemas in one connection ([specs/architecture.md](specs/architecture.md) §5). **Checked
  against the code, November 2026: not built.**
  * cadre-core gives each strand its own Quereus `Database` (`strand-database.ts`), and the
    app tables of every strand sit in a schema with the fixed name `App`.
  * Quereus has no `ATTACH`. It does support several named schemas in one `Database`, and
    each `using optimystic(...)` table can name its own network. Those are the pieces such a
    feature would need, but nothing in Sereus puts them together.
  * Writes across transactors are explicitly not atomic (optimystic `txn-bridge.ts`).

  Still to ask Nate: whether he meant this unbuilt composition, or joins in app code over
  separate databases.
* ❓ **Apps sharing strands.** A party's cadre can run strands for several apps, so WyattERP and
  Bonum can both work in the strands they have business with. In Sereus, each strand is bound
  to one sApp: `Strand.Header` pins the sApp ID and a signed schema, and a machine launches a
  strand only for an app that registered that sApp's config (`addStrand`). See
  `ser/sereus/docs/architecture.md`, "Strand membership schema" and "Storage replicas".
  * Working default: each sApp ships one control library (its schema plus the rules that live
    in code), and every app that touches its strands goes through it. For Bonum's strand that
    is the planned `bonum-core`, which the owner will extract on the Bonum side. Until then,
    posting into Bonum has no supported path.
  * Rules enforced in the schema hold for every app. Rules that live only in app code (Bonum's
    transaction-balance check, for example) hold only for apps that use the library, so they
    should move into schema constraints where Quereus can express them.
  * Open: whether each WyattERP module is its own sApp (one schema per strand, working default)
    or one sApp with several schemas. Also unverified: whether two apps on one device share a
    cadre node or each embed their own.
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
