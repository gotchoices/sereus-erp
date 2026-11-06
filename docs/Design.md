# Design rationale

Explains *why* the specifications ([specs/](specs/README.md)) look the way they do. The specs
are the contract, and this file is the reasoning behind it. References like "Q29" are the owner's
answers in [legacy/Questions.md](legacy/Questions.md). What ATI did, and what we learned from
it, is in [legacy/Findings.md](legacy/Findings.md).

## 1. Carried forward from ATI

The full keep / fix / drop list, with the evidence, is in [legacy/Findings.md](legacy/Findings.md)
§4–5. The short version:

**Keep**
* Parametric families, partnames, and deliberately approved part numbers.
* The BOM as a sandboxed program: option selection, lookup tables, derived child parameters.
* One ledger for all material movement, with planning computed from the statuses.
* Make or buy decided per buy, through bid kinds, with in-house shops treated as suppliers.
* Bids as supplier-maintained data, with lots, packs, lead times, expiry and history.
* **Conscious purchasing.** A person decides, and the system suggests (Q10).
* State transitions limited by role and enforced in the data layer. Alarms.

**Fix**
* **Versioned** product definitions (ATI pass 2 let BOM edits change work in progress).
* **One deterministic engine library**, with results persisted and stamped with versions.
* Order lines that can be re-exploded, manually and only for the lines selected (Q30).
* Runs with pinned BOM, routing, notes, and serials (Q5).
* Routing and QC steps.
* **Locations separate from accounts** (Q15).
* **Ledger entries written, not derived** (Q25).
* Exact quantities and money.
* A real sandbox.
* Browser UIs, including a configurator for sales.

**Drop**
* GSA pricing, ATI's sales-tax heuristics, the CAM queues and kanban replenishment.
* The vendor portal is deferred, but bids record `source` and `as_of` from the start (Q9).

**Changes to the MTR model** ([legacy/Findings.md](legacy/Findings.md) §5):
* documents are separate from moves;
* done moves are immutable;
* balances are maintained;
* demand is registered at commit, with a coverage view and optional allocation;
* locations are not accounts;
* transforms are single transactions;
* lots and serials;
* purchase packaging is a conversion on the bid.

## 2. Does BOM evaluation need to run inside the database?

**No, there is no functional requirement for it.** Putting it in the database (PL/Tcl in
wyselib `prod`) solved three problems of 2014, and each has a simpler answer now:

| Reason it was put in the DB | Answer in a TypeScript/Sereus world |
|---|---|
| Any client (reports, web, cron, SQL) could explode a BOM without the Tcl GUI | One shared TypeScript engine library, imported by every app, peer and script. Sereus peers all run the same JavaScript runtime anyway. If SQL access is wanted, Quereus can register it as a deterministic scalar function (`createScalarFunction`) |
| Generated MTRs were consistent with the BOM inside one transaction | The engine computes the result outside, and the app writes the generated rows in a single Quereus transaction. Constraints check the *rows*, not the formula |
| Caching the instance (`prod.bomc`) | Store results where they are used: the order line's generated demand, and the run's BOM. Stamp each with the product version and engine version so it can be reproduced or compared later |

The real requirements are **determinism and versioning**: the same version, parameters and
engine version must always give the same result. That is what lets another peer re-run the
explosion to audit it, and lets "re-instantiate this order" produce a reliable diff. A runtime
library meets them as well as an in-database function, and is easier to test, run in the
browser (customer self-configuration, Q11) and run in an AI assistant.

### BOM language (Q18, Q29)

The owner wants a "real language" that is still simple for an engineer. It should cover anything
from a single expression to a whole program. Arbitrary `eval` is ruled out. Safe embeddable
choices:

* **QuickJS compiled to WebAssembly** (for example `quickjs-emscripten`): a complete JavaScript
  interpreter in its own heap, with no host access unless granted, and with memory and time
  limits. BOM scripts are plain synchronous JavaScript, with no async involved. It is the same
  language as the app, and it is deterministic if `Date`, `Math.random` and I/O aren't exposed.
* **Lua in WebAssembly** (`wasmoon`, or pure-JS `fengari`). Lua was designed as an embedding and
  toolkit language: small, synchronous, and easy for non-programmers. The ecosystem is
  smaller.
* **Tcl compiled to WebAssembly.** This is technically possible and would run the old
  `prd_spread` corpus nearly as-is. But it is a niche runtime for new engineers.
* A small custom expression language. It would be the safest, but the owner's "take the limits off"
  goal argues against it.

**Decision (Q29): QuickJS-wasm as the initial choice**, with Lua or Tcl-wasm as fallbacks if
scripting turns out awkward. It gets a tiny host API: `skip()`, `error()`, `band()`, `table()`,
and units and rounding helpers. A trial port of real `prd_spread` scripts
([legacy/bom-scripting-js.md](legacy/bom-scripting-js.md)) found JavaScript *not* awkward.
* Any field can hold a single expression or a full block with no special syntax, because
  JavaScript's completion value works like Tcl's "result of the last command".
* Lookup tables become much shorter.
* The real hazards are float precision and type coercion, and both are handled at the engine
  boundary.

The existing Tcl corpus should mostly translate mechanically (guards, `switch` and `expr`).

**Option layering** (from the same trial): a declarative `when` field on each BOM line covers
most of ATI's `skip` uses, a zero quantity drops the line, `skip()` remains for complex
scripts, and a **family script** derives shared variables once, instead of copying lookup
tables into several lines.

## 3. Product versions (Q31)

A working premise agreed in November 2026, to be revisited if it causes trouble:
* Versions belong to the **family** (as in wyselib `prod`), written `base(p1,p2).N` or `1234.N`.
* **Part numbers never change with versions.**
* Each version declares whether it is **interchangeable** with the previous one. The engine
  detects parts that a version change didn't affect, by comparing explosion hashes.
* A missing version means "current at instantiation" on demand, and `.0` (unknown) on stock.
* Notes, QC criteria and documents change through **automatic minor revisions**. Runs record
  the version and minor revision they were built under.

Detail: [specs/product.md](specs/product.md) §3–6.

## 4. Demand, allocation and coverage

The owner's correction (November 2026): a manufacturing order must put a demand on inventory **the
moment it is committed**, not when material is picked. Otherwise nobody can tell whether stock
covers all outstanding orders. So:
* committing any document (order, run, transfer) creates its **planned moves**. The planned
  moves out of stock are demand, and the planned moves into stock are supply. The component
  lines of a labor-only award count as demand from the moment of the award in a purchasing
  round, as ATI's `wt` MTRs did;
* **allocation** (tying a demand to specific units on the shelf) is a separate, *optional* step,
  for lots, serials, priority overrides or physically staged stock;
* a computed **coverage** view answers "is each order and run covered, and by what?", and rolls
  runs up to *clear to build*, *clear by date* or *blocked*.

Detail: [specs/operations.md](specs/operations.md) §6 and §13.

## 5. Drawing borders: modules instead of one big database

The owner's concern (Q14, Q16): ATI stayed consistent because everything was relational in one
database, and it became crowded and hard to scale for the same reason. The standard way out is
**bounded contexts**: each module owns its data and enforces strong constraints inside itself
(ATI's strength, kept). Modules refer to each other by stable IDs and stay consistent through
**posted facts**, not foreign keys across databases.

**Modules (each a strand):**

| Module | Owns | Others see it as |
|---|---|---|
| **Product catalog** | families, versions, parameters, BOM scripts, routing, docs, approved parts | immutable published versions, referenced by ID and version |
| **Parties** | entities (vendors, customers, employees, shops), contacts | the responsible owner of party records (the 2014 "entities" idea). Other modules attach their own related data (Q28) |
| **Operations** | move ledger, locations, allocations, customer orders (material side), purchasing rounds, bids, POs, runs, receiving, shipping | posting events (received, issued, completed, shipped), and receipts readable by AP and AR |
| **Payables (AP)** | vendor invoices, matching, payments | AP clerk. A subledger posting to Bonum |
| **Receivables (AR)** | customer invoices, receipts, collections, credit holds | billing clerk. A subledger posting to Bonum |
| **Books (Bonum)** | GL, account definitions, hand entries, reconciliation, closing, reports | the accountant who does the final accounting |
| **Vendor strands** (one per vendor) | that vendor's bids and PO acknowledgments | shared with our buyers |
| **Shop strands** | a shop's runs and its material issues and receipts | shared with the shop |
| Later: storefront, CRM, HR and payroll | | outside the ERP core |

**How they stay consistent without one database:**
1. **Immutable references.** Product versions, closed moves and posted journal entries never
   change, so a reference to them can't dangle or drift.
2. **Posting with an outbox.** An operations event writes its own row plus an outgoing "posting"
   record in the same transaction. A poster then creates the Bonum transaction carrying the
   source ID, idempotently, so a retry never double-posts. This is the "ledger entries linked to
   but separate from MTRs" design the owner wishes ATI had (Q25).
3. **Control-account reconciliation.** As in every subledger design, a report checks that the
   operations module's inventory and WIP valuation matches the Bonum control accounts.
   Differences become visible, rather than silently "fixed" by views.
4. **Planning stays in operations** (Q17). Bonum only sees real economic events.

**Ownership rule (Q28).** Every notion has one native home. **One strand is responsible
for a set of records**, and other strands may create their own related data that references
them, which only they modify. For example:
* the parties strand owns a vendor;
* operations owns its bids and POs for that vendor;
* AP owns the vendor's invoices and payments.

That is the bounded-context rule stated in Sereus terms.

**Strands as the permission boundary (Q27).** ATI spent much effort on database users,
privileges and per-role views. With one strand per module, *membership* in a strand becomes the
coarse access control: a shop's devices join the shop strand, but not AP, AR or the books.
Schema-level roles inside each strand handle the fine control. The plan is to **try separate
strands from the start** and record what friction appears. This is also why AP and AR are
their own strands rather than part of Bonum: an AP clerk needs the vendor side only, a billing
clerk the customer side only, and neither defines accounts or closes periods.

**Cross-strand access.** Nate (the Sereus maintainer) says Quereus can already address and join
across several Optimystic/Sereus strands. So a node that belongs to both the operations and
parties strands can join a PO to its vendor directly. Reads across modules need no copying,
and only *writes* need the posting pattern above. **Not yet verified in code**; see
[STATUS.md](STATUS.md).

A possible Sereus enhancement, and a place where this project can push the platform: a
**read-only view in one strand that is defined over another strand's data**.
* Nodes with access to both strands can compute the view.
* Other nodes know the view exists and can request its contents, and could cache them.

The ERP gives this concrete use cases:
* an AP clerk seeing receipts without joining the operations strand;
* a vendor seeing only its own open POs;
* a shop seeing the part definitions for its runs.

These are worth writing up as Sereus requirements.

**AP boundary (Q14, Q26).**
* **Receiving happens in operations.**
* **Vendor-invoice processing is its own AP strand**, and customer billing its own AR strand.
  Each is a subledger posting to Bonum. AP reads what has and hasn't been received (a
  cross-strand read) to match invoices. Bonum stays the accountant's book of record: accounts,
  hand entries, reconciliations, closing and reports (owner, November 2026).
* The standard **GRNI** ("goods received, not invoiced") postings tie the two together:
  * receiving posts Dr Inventory and Cr GRNI at the PO cost;
  * the matched invoice posts Dr GRNI and Cr AP, with any price variance to a variance account;
  * actual cost (ATI's FIFO from paid AP) flows back to operations as a cost update.

  Operations never needs to know about payments.

## 6. Why build rather than adopt

The survey in [alternatives.md](alternatives.md) found no open-source ERP with a parametric,
scripted BOM engine in its core. ERPNext, Odoo and InvenTree do everything else well, and
remain useful as **reference designs** (Odoo's stock model especially). But the owner's goals
include demonstrating Sereus as a distributed, multi-party application (Q7, Q13), there is no
deadline (Q8), and an off-the-shelf ERP serves neither goal. So WyattERP is built on Sereus.
