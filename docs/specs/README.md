# WyattERP domain specifications

The **domain contract** for WyattERP: data model, rules, invariants and behavior that every
user interface (sales configurator, product editor, purchasing, shop floor, receiving,
storefront) and every back end must honor. **No UI is specified here.** Screens are written
per target later, following the appeus layout (`design/specs/<target>/…`). These files are
written to move unchanged into an appeus project as `design/specs/domain/`.

Status: **draft 1** (November 2026). The working premises and their reasoning are in
[../Design.md](../Design.md) and [../STATUS.md](../STATUS.md) (decision log). "Q29" and similar
refer to the owner's answers in [../legacy/Questions.md](../legacy/Questions.md). The premises are
deliberately revisable: if one causes trouble in practice, change it here first.

## Files

| Spec | Covers |
|---|---|
| [architecture.md](architecture.md) | Modules and strands, record ownership, cross-strand reads, posting between modules, identifiers, quantities and money, roles, history and migration |
| [product.md](product.md) | Product catalog: classes, families, versions and minor revisions, parameters, parts and part numbers, packages, BOM lines, routing, notes and QC, interchangeability |
| [engine.md](engine.md) | The parametric engine: explosion algorithm, script sandbox and host API, depth modes, costing and pricing, determinism, results and stamps, migration from the ATI Tcl corpus |
| [operations.md](operations.md) | Locations, documents and moves, statuses, balances, demand and allocation, planning and coverage views, order lines with packages and re-explosion, runs and serials, receiving, shipping, adjustments, postings to Bonum and AR |
| [purchasing.md](purchasing.md) | Vendors and shops as suppliers, bids and price breaks, purchasing rounds, award by part or by labor, quantity suggestions, PO and run creation, vendor and shop strands |

Read them in that order. `architecture.md` sets the conventions that the rest assume.

## Conventions used in these specs

* **MUST / SHOULD / MAY** have their usual meanings. "Invariant" means a rule that the data
  layer enforces (a constraint, an assertion or a role-limited view), not only the UI.
* Field lists name the *meaning* of each field. Types are indicative. The executable Quereus
  DDL (`schema.qsql` per module) is written when implementation starts, and it mirrors these
  files.
* **ATI:** notes record what the old system did and why something differs. They are context,
  not requirements. Background is in [../legacy/](../legacy/README.md).
* **Open:** marks a decision deliberately left for later, with the working default stated.

## Glossary

| Term | Meaning | ATI equivalent |
|---|---|---|
| **Class** | A product category with a one-character prefix (`a`, `b`, `@`…) that sets storage and behavior | prd_base prefix letter |
| **Family** | A parametric product definition, named `class:name` (for example `a:chan`) | `prd_base` |
| **Version** | A released, immutable definition of a family (parameters, BOM, routing, spec) | `prod.vers` (pass 3); `revision` (pass 2, a label only) |
| **Minor revision** | A recorded change to the documentation, notes or QC criteria of a released version | `minrev`, `prod.minr` |
| **Partname** | `base(p1,p2,…)` with an optional `.N` version suffix | partname |
| **Part / part number** | An approved, stockable parameter combination of a part family, numbered `1234` with an optional `.N` | `prd_part.pnum` |
| **Package** | A sellable configuration family that is never stocked or numbered. It explodes into parts when ordered | `@:` families |
| **Explosion** | Evaluating a family's BOM for given parameters, recursively | spreadsheet run |
| **Document** | A business record that plans or authorizes movement: quote, order, PO, run, transfer, adjustment | the order, PO and award parts of `mtr_reg` |
| **Move** | A quantity of one part moving between two locations | MTR |
| **Location** | A physical or logical place that stock can be in | project (`proj`) used as location |
| **Run** | A production batch (work order) that builds a quantity of one part to a pinned BOM, routing and notes | `wm`/`wt` MTRs + shop work order |
| **Round** | A purchasing session that turns shortages into awards, level by level | purchasing round |
| **Bid** | A supplier's price for a part at a lot size, as a whole part (`P`) or as labor only (`A`) | `vend_price` |
| **Posting** | An accounting fact sent from one module to another (ops → Bonum or AR, AP → Bonum…) | (GL views over MTRs in ATI) |

## Not yet specified

* AP and AR internals. Only their boundaries with operations and Bonum are specified, in
  [architecture.md](architecture.md) and [operations.md](operations.md).
* Parties (vendors, customers, employees) beyond the fields operations needs.
* Storefront and customer self-configuration: they are consumers of [engine.md](engine.md).
* CRM, HR and payroll: outside the ERP core.
