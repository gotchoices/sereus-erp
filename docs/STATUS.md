# WyattERP status

**Legend:** ⬜ Todo | 🔄 In progress | ✅ Done | ❓ Needs discussion | 🔮 Future

**Phase:** design. The domain specifications are at draft 1. No code yet. Last updated
November 2026.

## Resume here

The next step is the **engine prototype** ([specs/engine.md](specs/engine.md)), checked against
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

After the engine, the build order is:
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
| Engine prototype against the 2014 corpus | ⬜ next |
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
| Product name WyattERP, a descendant of the wylib/wyseman/wyselib brand | owner |

## Open items

* ❓ **Quereus multi-strand mechanism:** how a cadre node attaches several strands as named
  schemas in one connection. Verify with Nate before writing cross-strand queries
  ([specs/architecture.md](specs/architecture.md) §5).
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
