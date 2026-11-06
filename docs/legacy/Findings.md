# Findings: what the ATI ERP was, and what to learn from it

*November 2026, revised after the owner's answers to [Questions.md](Questions.md). Based on reading
`old/ati`, `old/wyseman`, `old/wylib`, `old/wyselib`, targeted tables
from the 2014 ATI production dump, and a light survey of current open-source ERPs. Detailed
notes are alongside this file ([README.md](README.md)).*

This file is the study of the legacy system. The forward-looking parts that used to be
§6–9 here (BOM evaluation outside the database, the module split, direction and build order)
now live in [../Design.md](../Design.md), [../Vision.md](../Vision.md) and
[../STATUS.md](../STATUS.md).

## 1. Summary

* The ATI system ("pass 2", PostgreSQL + Tcl/Tk, about 1999–2014) is coherent and well
  understood. It is small in concept: **parametric part families**, a **single material-transfer
  ledger** (MTRs), and a **human-in-the-loop purchasing round** with vendor bidding. The owner reports
  that the manufacturing side worked well. The pain points were the sales UI (ordtool), the GL
  being derived from views of manufacturing data, the project tree used as a pseudo-accounting
  structure, everything sharing one large database, and the Tcl/Tk desktop client.
* Its distinctive, still-rare capability is the **parametric BOM engine**. A part family's
  "spreadsheet" lines carry Tcl expressions and scripts that compute child parameters,
  quantities and option selection from the parent's parameters, recursively. As of 2026, no
  mainstream open-source ERP does this in core.
* Everything else it did is now commodity, and the open-source ERPs do it well. But the owner's goals
  now include **demonstrating Sereus** (a distributed, multi-node, multi-strand application).
  That outweighs simply adopting ERPNext or InvenTree.
* **Direction** (detail in [../Design.md](../Design.md) and [../Vision.md](../Vision.md)):
  build a Sereus-native "pass 4" as **separate modules with clear borders**:
  * a product catalog containing the parametric engine;
  * an operations module with the MTR ledger, orders, purchasing, runs and receiving;
  * parties (vendors and customers);
  * separate AP and AR modules (subledgers);
  * Bonum for the books.

  Each module is its own strand and owns its records. The modules are connected by Quereus
  joins across strands for reads, and by posted events for writes, not by one shared
  database. It would ship under the **WyattERP** brand, the umbrella name of the old library
  family (wylib, wyseman, wyselib), as that family's Sereus-era successor. Start with the
  engine. There is no deadline, so the build can go at the pace of the hydroponics business.

## 2. What the ATI system was

A single PostgreSQL database (schema in `src/dbm/*.sch`) and about 20 Tcl/Tk desktop apps
(`src/tcl/*`) on a shared framework (`src/tcl/lib`, which became wylib). The manufacturing chain:

```
 prodim ─ defines families, parameters, parts, spreadsheets, docs
    │
 ordtool ─ bid/order lines → "or" MTRs (packages exploded to part numbers)  ── commit: work→open
    │                         demand on inventory project
    ▼
 prd_part_v_stock ─ stock / available / availp / projected / drop-dead / stress per part
    │
 purchase (potool) ─ round: pick short parts → "pt" MTRs → award to a bid
    │   └─ labor-only (-A) award ⇒ run spreadsheet 1 level ⇒ "wt" MTRs (components to shop)
    │        ⇒ new demand ⇒ repeat until no BOM items remain
    ▼
 make PO ─ po_hdr/po_items per vendor; pt→po, wt→wm; PO to vendor or work order to shop
    │
 vendbid (vendors maintain own bids) · shopman (shop's view) · wmclose (issue to shop)
 rectool (receive po MTRs; partial ⇒ auto back-order) · ship (pack/ship or MTRs)
 apinv (AP match → FIFO actual cost) · custinv/deplink (AR) · projects roll up job P&L
```

The full technical model (tables, MTR types and statuses, planning formulas, purchasing steps) is
in **[ati-mfg-model.md](ati-mfg-model.md)**.

### The parametric system in one page

* **Family** `prd_base` (for example `a:d92`, `b:nut`, `@:pt_std`). The prefix letter is a commodity
  or storage class. `@:` marks a *package*. Each family has status (production, development,
  obsolete, custom), units, a spec, and a **price formula** (Tcl expression or script, aware of
  GSA pricing).
* **Parameters** `prd_parm`: an ordered list of `var`, type (`num`/`str`/`eng`), units and description.
* **Partname** = `base(p1,p2,…)`, for example `b:nut(0.375,16)`. Every combination of
  parameters has a name, but only stocked or sold combinations get a **part number** (`prd_part`,
  unique on base + parms). Each part number carries stock policy (reorder point, target, minimum
  buy), costs, prices, weight, count status, and an `elevel` lifecycle gate.
* **Spreadsheet** `prd_spread`: lines of (component family, component-param expression,
  quantity expression, pre-script, comment). The evaluator (`src/tcl/lib/spread.tcl`) creates a
  **safe Tcl interpreter per BOM level**, binds the parent's parameters as variables, runs each
  line's script, evaluates the quantity and the child parameters, and recurses. Depth modes:
  *Full*, *1st Part* (stop at the first numbered part, used for packages and purchasing), and
  *One Level*. Pricing modes: *historical*, *best bid*, *worst bid*.
* **Script commands.** A line's script runs before the quantity and child parameters are
  evaluated, and can call three commands added to the safe interpreter:
  * **`skip`** drops that one BOM line for this parent instance; the evaluator just moves on to
    the next line (`spread.tcl` lines 162 and 327–329). This is how options work: a family lists
    every possible component, and each optional line opens with a test such as
    `if {$Z != 6} skip`, so only the components that match the parameters survive.
  * **`abort`** stops the whole explosion.
  * **`prompt`** asks the user for a value mid-explosion.
* **Real usage** (from `src/dbm/work/prd_spread.sql`): area-based paint (`($W*$H)/7200`), steel
  plate take-off with kerf allowance, trigonometric geometry, `switch` lookup tables, option
  selection with `skip`, and derived child parameters `$S,$H,l`.
* **Make vs. buy is late-bound.** Any assembly can be bought complete (bid type `P`) or as labor
  only (`A`), from an outside vendor or an in-house shop. In-house shops are vendors of type
  `inh` with their own WIP project. The BOM is only exploded when a labor-only award is made.
* **Packages vs. parts.** A package (`@:`) family is never stocked and never gets a part
  number. When it goes on an order it is exploded at *1st Part* depth into numbered, stockable
  parts. `purchase.man` treats this as an inventory-strategy lever: stock the commonly used
  components, and sell rarely used configurations as packages. The owner's restatement (Q20) gives
  the rule cleanly. **A part is a deliberately approved parameter combination that can be
  stocked. A package is a sellable configuration where almost any parameter combination is
  acceptable, and it exists only as an order line plus the demand it generates.**

### What the 2014 production data shows

Extracted from the full dump (`<archive>/ati/pgdata-2014-Jan-03.tgz`) into
[data-2014.md](data-2014.md): the schema and row count of all 161 tables, plus
the data for the product, MTR, bid, PO and project tables.

**Scale at the end.** 8,302 families and 12,810 part numbers.
* There are 775 package families (`@:`), plus 158 named "standard package" parameter sets
  (`prd_stdpkg`).
* 3,726 families have parameters, usually 1–3, and as many as 26. Parameter types:
  4,808 `num`, 2,343 `str`, 53 `eng`.
* 409 vendors held 22,000 active bids covering 10,000 parts.

**The BOM corpus grew about 4×** from the 2000 snapshot (6,209 → 26,905 lines; 1,230 → 4,587
families).
* Lines with scripts: 4,138 (15%), and 3,374 of them call `skip`. The other script contents:
  394 `switch` lookup tables, 339 `prompt`, 242 `error`, 208 loops.
* There are only 3 `proc` definitions, so scripts stayed small.
* 6,733 lines have formula quantities, and 1,568 have parameterized child parameters.
* BOM trees ran up to 11 levels deep. Most were 2–4 levels.
* 125 long scripts were copied verbatim into 368 lines. This is the duplication a family-level
  script would remove.

**Routing arrived in 2012–13, inside pass 2, not pass 3.**
* `prd_oper` lists 16 operations (cut, burn, brake, weld, blast, paint, buff, mach, elect,
  assy, mat…).
* `prd_base_oper` routes 1,689 families through 5,915 operation steps. All were created in 2013,
  and *none* has setup or run times filled in.
* 4,102 BOM lines carry an `oper` column, so components were tied to the step that consumes
  them. That is the wyselib `prod` "BOM lines per process" idea, retrofitted into pass 2.

**The pass-3 `prod` schema was installed but never used.** Every `prod.*` table is empty except
the `unit` and `type` lookups. `prod.note` (note types fig, step and qc per process) matches
the owner's memory of per-run manufacturing and QC notes. The **entities redesign was in use**:
`base.ent` has 1,432 rows, with links, addresses and privileges (Q24).

**MTR ledger: 2.92 million rows, growing to about 400,000 a year by 2012–13.**

| Type | Rows | Of which |
|---|---|---|
| `or` (customer order line) | 2,408,527 | 1,033,515 void · 760,804 work · 12,653 open · 601,555 closed |
| `wm` (material to shop) | 243,681 | 233,046 closed |
| `po` (vendor PO) | 156,261 | 141,500 closed |
| `rq`, `ad`, `bf` (requisition, adjustment, backflush) | 113,011 | almost all closed |
| `pt`, `wt` (purchasing round in progress) | 1,120 | all work |

**61% of the ledger is `or` lines that never moved anything** (quotes left in `work` or voided).
This strongly supports separating *documents* (quotes and order lines) from *moves* (§5). Other
observations:
* No MTR has a fractional quantity.
* `prd_part_inv` is a **cached** copy of the per-part planning values (stock, available,
  open in and out, average monthly use, months of supply). Computing them live from views had
  evidently become too slow, which argues for the maintained balances proposed in §5.

**Bids** (Q32): labor (`A`) bids were refreshed steadily, with about 2,500–3,700 history entries
a year (9,086 in 2012). One vendor, org 1196 and most likely the in-house shop, held 39% of
the active labor bids. Without `vend_org`, the in-house vendor type can't be confirmed.

## 3. Where the business logic lives

| Kind of logic | Location |
|---|---|
| Integrity, lifecycle gates, numbering, back-order creation, change history | PL/pgSQL triggers in `src/dbm/*.sch` (`mtr_reg_tf_bu`, `prd_part_tf_iu`, `vend_price_tf_au`…) |
| Who may make which state transition | **Views with INSTEAD rules** per app role (`mtr_reg_v_pocl` "only close PO MTRs", `prd_part_v_inv`, `po_items_v_rec`…) plus the `priv` table |
| Stock, availability, lead time, stress, EOQ, FIFO cost | SQL functions and views: `mtr.sch`, `ship_mtr.sch` (`prd_part_v_stock`), `mtr_stress.sch`, `mtr_cost.sch`, `ord_mtr.sch` |
| BOM explosion and package pricing | Client Tcl: `src/tcl/lib/spread.tcl`, `prd::base_price` |
| Order validation and commit | `src/tcl/ord/ordtool` (`order_commit`, `use_pkg`, `use_part`) |
| Purchasing round, award, WM generation, PO build | `src/tcl/potool/purchase.tcl` (`mtre_pre_addrec`, `award`, `make_po`, `expand_round`) |
| Receiving and material issue | `src/tcl/potool/rectool.tcl`, `wmclose.tcl` |
| General ledger | **Views over manufacturing data**. The owner names this as a design mistake (Q25) |
| Operating procedure and intent | The manuals: `prodim/prodim.man`, `potool/purchase.man`, `vendim/vendbid.man`, `ord/ordtool.man`, `shopman/shopman.sgml`, `opr/README.prdman` |

The framework and build tooling are described in [ati-framework.md](ati-framework.md),
and the full directory index is in [ati-index.md](ati-index.md).

## 4. Lessons: keep, fix, drop

**Keep**
1. Parametric families, partnames, and deliberately approved part numbers (auto-allocated
   numbers are fine).
2. BOM as a sandboxed program, with option `skip`, lookup tables and derived child parameters.
   For options there is a cleaner layering. Give each line a declarative **`when`** guard, which
   covers most of the 563 skips in the 2000 corpus. A **zero quantity drops the line**. Keep
   `skip()` for complex scripts. Add a **family-level script** that derives shared variables
   once, so lookup tables are not copied into several lines as they were in `@:dcu_r`. See
   [bom-scripting-js.md](bom-scripting-js.md).
3. One ledger for all material movement, with statuses that make planning a matter of
   filtering the ledger. It is closer to mainstream than it may feel. See §5 for an assessment
   and the changes I would make.
4. Late-bound make vs. buy through bid types, with in-house shops treated as vendors. The owner
   confirms this (Q3).
5. Bids as vendor-maintained data with lots, package sizes, lead times, expiry and change history.
6. **Conscious purchasing.** A human decides stock levels and awards. The computer suggests
   economic lot sizes, price-break-optimal quantities and run sizes, and there are no favored
   or auto-replenishing vendors (Q10). A more automated mode may come later, for example
   accepting the round's suggestions in bulk for routine parts. So the suggestion logic should
   be a separate, replaceable step, not something embedded in the UI.

   *What pass 2 actually computed* (Q32, from `potool/purchase.tcl`, `bids.tcl`, `prd.sch`,
   `ord_mtr.sch`):
   * Each part had three hand-set policy fields: `buylev` (low-water mark), `reclev` (target
     stock) and `recbuy` (minimum efficient buy).
   * The suggested buy was `max(reclev − availp, recbuy)`.
   * The bids screen also showed a computed **EOQ** (economic order quantity),
     `mtr_pn_recstk(pnum, 10, 0.15)`. This is the classic Wilson formula,
     √(order cost × annual usage ÷ (unit cost × cost of money)). It assumed $10 per order and
     15% cost of money, and took annual usage from the past year's issues out of inventory
     (or from open demand, if larger). It was advisory only.
   * At award time, the round warned when the quantity was below the bid's lot (offering to
     raise it) or above 1.8× the lot. **In-house (`inh`) bids were exempt** from the over-lot
     warning.
   * `prd_part.cost` and `lcost` were documented as running weighted averages. I found no code
     in the source snapshot that updates them, so they were probably maintained by hand.
   * Nothing consulted historical in-house run costs automatically. In-house shops priced
     through their `inh` bids. The owner recalls them as rarely updated, but the 2014 bid history
     (§2) shows labor bids being revised a few thousand times a year. So the issue was more
     likely their *accuracy* than their age: no actual run cost fed back into them.

   For pass 4, extend the computation:
   * total cost across bid price breaks (unit price × quantity + carrying cost over the
     expected time to consume);
   * a setup cost per in-house run, derived from actual run history instead of
     hand-maintained bids;
   * shelf life as a cap for perishables.
7. Role-limited state transitions enforced in the data layer, not only in the UI.
8. "Alarm" notifications for exceptional events.

**Fix** (several of these fixes were already designed in wyselib `prod`)
1. **Version the product definitions** (`prod.vers`). Pass-2 BOM edits silently changed work
   already in progress. The working premise, agreed in November 2026 and which
   settles Q31:
   * Versions belong to the **family** (as in pass 3), written `base(p1,p2).N` or `1234.N`.
   * **Part numbers never change with versions.**
   * Each version declares whether it is **interchangeable** with the previous one, and the
     engine detects parts a version change didn't affect.
   * A missing version means "current at instantiation" on demand, and `.0` (unknown) on stock.
   * Notes, QC criteria and documents change through **automatic minor revisions**, and runs
     record the version and minor revision they were built under.

   ATI evidence: pass 2 had only `revision`/`minrev` labels, used by 732 and 232 families. In
   wyselib `prod`, part numbers were keyed to the family alone, with one draft above the
   current version and `prod.minr` minor-revision notes. See
   [../specs/product.md](../specs/product.md) §3–6.
2. **Make the BOM evaluator one shared, deterministic library** that every client, report and
   peer can call. It does not need to live inside the database (see [../Design.md](../Design.md) §2). Persist its *results*
   (generated demand, run BOMs) as data, stamped with the product version and engine version.
3. **Re-instantiable order lines.** An order line holds the package, its parameters and its
   version. Its generated demand is linked to that line and can be re-exploded. Re-explosion is a
   **manual operation, limited to the lines the user selects** (Q30). It shows the differences
   against the existing generated MTRs and applies them on confirmation. Pass 2 had no clean way
   to do this (Q19).
4. **Runs.** A production run (work order or lot) captures the BOM instance, the routing and the
   manufacturing and QC notes used for that batch. Serial numbers are allocated within a run
   (Q5). This is what wyselib `prod.note` was moving toward.
5. Add **operations/routing** (`prod.oper`/`prod.proc`, already partly in the 2014 DB): where
   labor happens, work instructions per step, and test and QC steps (pumps, electronics,
   plumbing).
6. **Separate locations from accounts.** Pass-2 projects served as locations, cost centers and
   accounts all at once (Q15). See §5.
7. **Write ledger entries; don't derive them.** Accounting entries are created by explicit
   posting events and linked to the MTRs and documents that caused them, never computed as views.
   Changing production data must not change the books (Q25).
8. Use exact decimal or rational quantities and money, with proper fractional units, and
   back-schedule due dates from lead times.
9. Use parameterized queries and a real sandbox in place of string-built SQL and Tcl `eval`.
10. A browser-based UI, built as several focused apps, with a configurator-style sales tool
    instead of ordtool's steep learning curve.

**Drop or defer**
* GSA pricing, sales-tax heuristics, CAM burn-table queues, and the old document editors.
* Kanban-style automatic replenishment (explicitly not wanted).
* The vendor self-service portal can wait. Early on, prices will be refreshed manually or with
  an AI assistant working from each vendor-part's URL, so record a price's *source* and *as-of
  date* from the start (Q9).

## 5. The MTR design: is it mainstream?

**Mostly yes. It is a double-entry stock ledger, which is the standard design.** Every serious
inventory system records movements, not a mutable "quantity on hand" field:
* Odoo: `stock.move` from location to location;
* ERPNext: Stock Ledger Entry;
* SAP: material documents with movement types;
* Bonum: inventory as a unit-denominated account.

ATI's "from project → to project" MTR is that same pattern. Odoo is the closest match. Its
`stock.move` also lives in one table with states (draft → waiting → confirmed → assigned →
done/cancel), so planned and actual moves sit side by side, as with ATI's work/open/closed.

**Where ATI differs from mainstream practice, and what I would change:**

| Topic | ATI pass 2 | Mainstream / recommended |
|---|---|---|
| Documents vs. moves | MTR rows were both the order line *and* the movement (`or`, `pt`, `po` types) | Keep **documents** (order line, PO line, run) separate from the **moves** they generate. Demand is "document quantity not yet moved". This removes the overloaded MTR keys and the dummy foreign keys |
| Closed moves | Editable by privileged users | **Immutable once done**. Corrections are reversing or adjusting moves. This is also what makes it safe to post to Bonum |
| Balances | Summed from about 3 million rows by views | A maintained **balance per (part, location, lot)** (Odoo calls it a "quant"), kept as an incrementally maintained materialized view in Quereus, so the ledger stays the source of truth |
| Allocation | Implicit in the projected-stock arithmetic | Demand registered at commit (as in ATI), plus a computed **coverage** view (which orders and runs are covered, by stock or by which incoming supply). Optional explicit **allocation** of specific stock for lots, serials or priority |
| Locations | Projects doubled as locations, cost centers and accounts | **Locations are physical or logical places** (stockroom, bin, shop, vendor, in transit, customer, scrap). **Valuation** is a mapping from location type to a Bonum account (Inventory-RM, Inventory-FG, WIP, Jobs-in-Process), with the document as a Bonum tag: WIP grouped by run or PO, and JIP grouped by customer order |
| Transformations | Remnants and reclasses were a loose pair of MTRs | One **transform transaction** with several lines: consume X, produce Y. This is how mainstream systems handle disassembly and repacking, and it applies equally to a run (consume components, produce assemblies) |
| Lots and serials | None | A lot or run plus a serial on the move (Q5) |
| Units of measure | Separate part numbers per physical form (coil vs. sheet) | Keep separate parts for physically different forms. Handle *purchase packaging* (buy by the roll, stock by the meter) as a conversion on the vendor-part or bid record, which ATI half-had with bid `pkg`/`lot` |
| Planning | Projected stock, drop-dead date and stress from statuses | Keep it. This was a strength. Add time-phased netting (MRP buckets) as a view, not as a second store |

The core idea (one ledger, with planning as a filter over statuses and documents) is worth
keeping. The changes are about separating concerns, not replacing the model.
