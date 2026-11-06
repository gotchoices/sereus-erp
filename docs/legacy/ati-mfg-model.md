# ATI Manufacturing Control Model (technical notes)

Reverse-engineered from `old/ati/src/dbm/*.sch` and `old/ati/src/tcl/*` (pass-2 system,
~2000–2013). Paths below are relative to `old/ati/src/`.

## 1. The big ideas

1. **Parts are points in a parametric space.** A *basename* (`prd_base`) is a part family with
   an ordered list of typed parameters (`prd_parm`). Any combination of parameter values is a
   *partname* such as `b:nut(0.375,16)`. Only combinations that are actually stocked or sold
   get a permanent *part number* (`prd_part.pnum`), unique on `(base, parm)`.
2. **BOMs are programs, not lists.** Each basename may own a "spreadsheet" (`prd_spread`):
   ordered lines whose component *basename* is fixed but whose component *parameters* and
   *quantity* are Tcl expressions over the parent's parameters, optionally preceded by an
   arbitrary Tcl script (which can compute variables, `skip` the line, raise errors, or
   `prompt` the user). The BOM is expanded recursively on demand — never stored exploded.
3. **There is no stock table.** Inventory is the running sum of **MTRs** (Material Transfer
   Records, `mtr_reg`) that move quantities of a part number *from* one project *to* another.
   Projects (`proj`) double as locations/accounts: inventory, WIP, a shop, a customer job,
   corporate. Stock in project P = Σ(closed MTRs into P) − Σ(closed MTRs out of P).
4. **Demand and supply are the same object at different statuses.** An MTR in status
   `work` is a proposal, `open` is a commitment, `clsd` is a completed physical move,
   `void` is cancelled. Every planning number (available, projected, drop-dead date, stress)
   is a different filter over the same register.
5. **Make vs. buy is decided at award time, not at design time.** Any part with a
   spreadsheet can be bought complete (bid type `P`) *or* its labor bought separately
   (bid type `A`, "part number -A"), from an outside vendor or an in-house shop (which is
   just a vendor of type `inh`). Awarding an `A` bid explodes the spreadsheet one level and
   creates material-issue MTRs, which in turn create new demand — so purchasing iterates
   down the BOM levels.

## 2. Product data (prodim) — `dbm/prd.sch`, `dbm/prd_bom.sch`, `dbm/prd_doc.sch`

| Table | Key | Purpose |
|---|---|---|
| `prd_base` | `base` (e.g. `a:d92`, `b:nut`, `@:pt_std`) | Part family: units, descr, spec, revision, `price` formula (Tcl expr or script), status `p`/`d`/`o`/`c` (production/dev/obsolete/custom) |
| `prd_parm` | `(base, pos)`, unique `(base, var)` | Ordered parameter defs: `var` (short caps name), `ptyp` `num`/`str`/`eng`, units, descr. Trigger enforces pos 1..N contiguous |
| `prd_part` | `pnum` (sequence) ; unique `(base, parm)` | A concrete part: `parm` = comma list, weight, `buylev`/`reclev`/`recbuy` (reorder point / target / min buy), `cost` (moving-average material), `lcost` (labor), `price`, `gsa`/`gprice`, `elevel` −1..5, `docount`/`lastcnt` (cycle count), location |
| `prd_spread` | `(base, pos)` | BOM line: `cbase` (component family, FK), `cparm` (Tcl-subst'd param list e.g. `$A,$B+2,4`), `quant` (Tcl expr e.g. `($W * $H) / 7200`), `script` (pre-eval Tcl), `cmt` |
| `prd_stdpkg` | `(base, parm)` | Named "standard" parameter sets for packages (`@:`) |
| `prd_doc` / `prd_doc_data` | `(base, type, class, annot)` | Per-family documents (drawings, notes, CAM programs) chunked into DB, with checkout lock. Classes: assy, inst, rang, ship, oper, sale |

**Naming convention** (prodim.man): prefix letter = storage/commodity category —
`@:` package (no part numbers, never stocked), `a:` assembly, `b:` hardware, `e:` electronic,
`i:` sheet metal, `m:` motion, `p:` pneumatic, `r:` reeled, `s:` steel, `u:` shop supplies,
`o:` other, `K:` custom. Basenames go general→specific so they sort together on shelves.

**Lifecycle / gating** (`elevel`, enforced by deferred triggers against `prd_base.status`):
−1 obsolete, 0 custom, 1 R&D, 2 atomic components, 3 internal sub-assy, 4 sellable sub-assy,
5 complete products. Ordering refuses −1 and 1; alarms on 0; purchasing refuses ≤1.

**Assembly vs package.** An *assembly* (has spreadsheet + part number) is stocked as one
unit. A *package* (`@:`, spreadsheet, no part numbers) is stocked as its pieces; when sold, it
is expanded to "1st Part" depth and each resulting part number goes on the order. Package
price comes from the `prd_base.price` formula (may reference params and `$GSA`), else sum of
part prices.

### Spreadsheet evaluator — `tcl/lib/spread.tcl` (`spread::spread_rout`)

```
spread_rout(qty, base, parm, level):
  lines = select ... from prd_spread where base=? order by pos
  if no lines:                      # atomic part
      look up pnum/cost for (base,parm); cost from hist | best bid | worst bid
      emit line; return qty*cost
  pnum = lookup (base,parm)          # may be null (unnumbered config / package)
  if pnum and depth-mode != Full and level>0: emit as a part; return  # "1st Part" mode
  interp = new safe Tcl interpreter for this level
  for each prd_parm: interp.set(var, value)   # prompts if a value is missing
  emit labor line using lcost (or best/worst "-A" bid)
  for each line:
      interp.eval(script)            # may set vars, `skip`, `abort`, `prompt`
      q = interp.eval("expr (quant) * qty")   # expr is aliased to force doubles
      p = interp.eval("subst cparm")
      total += spread_rout(q, cbase, p, level+1)
  return total
```

Modes: **Full** (to atoms), **1st Part** (stop at first numbered part — used for packages
and for purchasing explosion), **One Level**. Pricing: `hist` (part cost), `best`/`worst`
(min/max active vendor bid), `none`. Returns a list `{qty pnum partname descr cost ext level}`.

Real examples from `dbm/work/prd_spread.sql` (July 2000 data dump, ~9k lines):

```
a:jpnlp    2  o:pnpr   fb          ($W * $H) / 7200          # paint by area
a:tc2_lc   2  s:plsq   0.375       ((($H-0.5+0.25)*(3.75+1.25+1.25+0.25)) + ((3.75+0.25)*2))/144
a:jpnl     1  a:jpnll  $S,$H,l     1                          # child params from parent
a:cnv     28  a:cnv_h6 $C          1        script: if {$Z != 6} skip     # option selection
@:pt_std   1  a:pt_std $H          1        script: switch $S {"S1" {set H 12} "S2" {set H 24} ...}
a:d92_ra   2  a:d92_ratm ""        $N       script: set N [expr 240 / $S]
a:d92_ral  1  s:shln   10,48       $F/12*-1 script: set F [expr 18*cos(...)+2*sin(...)]  # trig geometry
```

So the BOM language covered: geometric material take-off, option/feature selection,
lookup tables, derived child parameters, and validation errors.

## 3. Material Transfer Register — `dbm/mtr.sch` (+ `ord_mtr`, `po_mtr`, `prd_mtr`, `ship_mtr`, `mtr_cost`, `mtr_stress`)

`mtr_reg` key: `(ttype, ropnum, inum, minum, bminum)` = type, parent document number, line,
MTR seq within line, back-order seq. Columns: `pnum`, `rquant` (requested), `tquant`
(transferred), `mtr_date`, `ddate` (due), `tdate` (done), `value` (unit cost), `status`,
`fr_proj`, `to_proj`, links to order/PO lines.

| ttype | Meaning | Created by | Typical from → to |
|---|---|---|---|
| `or` | Order line material (customer order, RMA, internal requisition) | ordtool | inventory → job project |
| `pt` | **P**urchase **t**emporary: a proposed buy in a purchasing round | purchase | corp/WIP → inventory |
| `wt` | **W**ork-material **t**emporary: components to issue for an `A` award | purchase (award) | inventory → shop/WIP |
| `po` | Purchase/work-order receipt line (pt becomes po on Make PO) | purchase make_po | vendor/WIP → inventory |
| `wm` | Work material issue to shop (wt becomes wm on Make PO) | purchase make_po | inventory → shop/WIP |
| `rq` | Legacy requisition | requis | |
| `ad` | Inventory count adjustment | invman | |
| `bf` | Balance forward (opening count) | invman | → inventory |

Status machine: `work` → `open` (commit) → `clsd` (physically moved; sets `tdate`) or
`void`. Triggers (`mtr_reg_tf_bu`): closing with `tquant < rquant` **auto-creates a
back-order MTR** (`bminum+1`) for the remainder; POs may over-receive; non-`work` MTRs can't
be deleted. Writes go through per-app views with INSTEAD rules (`mtr_reg_v_or`,
`mtr_reg_v_pt`, `mtr_reg_v_pocl` "only close po MTRs", `mtr_reg_v_wmcl`, `mtr_reg_v_inv` "only
insert ad/bf"), which is how the schema enforces *who may do which transition*.

### Planning arithmetic — `prd_part_v_stock` (in `ship_mtr.sch`)

For each part × each project of `ptype='inv'`:

| Column | Formula (net into the inventory project) |
|---|---|
| `stock` | Σ closed `tquant` |
| `openi` / `openo` | Σ open `rquant` in / out |
| `available` | closed + open |
| `availp` | closed + open + *PRIP* (`work` MTRs of type pt/wt/po/wm — the purchasing round in progress) |
| `worki` / `worko` | Σ work `rquant` in / out (includes un-committed orders/bids) |
| `projected` | closed + open + work |
| `projb` | bid-probability-weighted demand: work order MTRs × `ord_hdr.prob`% |
| `confidence` | `conf_pn`: 100 − (#MTRs since last count) − 0.1×days since count |
| `ddead` | `mtr_pn_ddead`: walk open/pt/wt MTRs by due date; days until stock < 0 |
| `stress` | `mtr_pn_stress`: compares ddead to expected lead (`mtr_pn_lead`: exp-weighted historical PO lead, else avg bid `ldtime`, else 30); exponential urgency score |
| `peryear` | closed outflow last 12 months |

Also: `mtr_pn_recstk` — EOQ-style √(2·order-cost·usage / (unit-cost·carry-rate))
recommended stock; `mtr_pn_cost` — FIFO actual cost of on-hand stock from paid AP invoice
lines (`po_items_v_cost`); `mtr_reg_v_lead` — lead time per closed PO receipt.

## 4. Sales orders — `dbm/ord.sch`, `tcl/ord/ordtool`

`ord_hdr` (type `bid`/`ord`/`rma`/`req`, status work/open/clsd/void, `proj`, `prob`%,
terms, ship/bill labels, GSA, promo) → `ord_items` (descr, qty, unit price, `pname`,
`lcost`, `spcont`) → `mtr_reg` rows of type `or` (one per part number per line).

* `use_part` adds one part MTR; `use_pkg` runs the spreadsheet in *1st Part* mode, shows an
  **editable** qty/part list for review, prices via the package formula or sum-of-parts
  (GSA aware), then adds an MTR per part.
* `order_commit` validates (addresses, labor cost on non-material lines, zero total,
  requisition funding vs. project budget `proj::ok`, credit hold, project status/type,
  elevel gates, missing weights, sales-tax states, GSA for federal customers — several raise
  e-mail "alarms") then flips header + MTRs `work → open`. Bids remain `work` MTRs and feed
  `projb`.

## 5. Purchasing — `tcl/potool/purchase.tcl` (+ `potool`, `bids.tcl`, `rectool.tcl`, `wmclose.tcl`), `dbm/po*.sch`, `dbm/vend_price.sch`

Objects: `po_purch` (purchasing **round** = date × part list), `vend_price` (bids:
vendor, pnum, prodtype `P` part / `A` assembly labor / `S` service, `pkg`, `lot`, unit
price, vendor spec, lead days, expiry, status, rebid-request flag; full change history in
`vend_price_chng`), `vend_award` (pt MTR → chosen bid), `po_hdr` (`ptype` `p`=PO to vendor,
`w`=work order to in-house shop), `po_items`.

The documented round (purchase.man, "Notes for pass 2"), roughly every other week:

1. Load parts with `availp < buylev` into a new round (named by date).
2. Review; drop or retune buy levels.
3. **Expand** the round: run each part's spreadsheet and add all sub-components
   (`expand_round` → `insert_po_purch`).
4. Send **rebid solicitations** selectively (vendbid / `solicit`), wait 1–2 days.
5. Solicit new vendors for parts with < ~3 active bids.
6. **Purchase**: for each short part create a `pt` MTR; default qty =
   max(`reclev − availp`, `recbuy`), due date from `ddead`.
7. **Award**: pick a bid (default: lowest price with lot ≤ qty); checks expiry, lot,
   package rounding; > $5000 sends an alarm. If bid is `A` (labor only): run spreadsheet
   one level (1st Part), show editable component list, back-schedule due date by historical
   lead, create `wt` MTRs inventory → shop's WIP project.
8. Those `wt` MTRs lower `availp` of components → **repeat 6–7** until no BOM items remain.
9. Late adds; 10. consolidate tiny POs (re-award, merge into an open PO, top up).
11. **Make PO** per vendor: create `po_hdr`/`po_items`, convert `pt→po` and `wt→wm`,
    distribute by fax/e-mail (work orders to shops first e-mailed for review).
12. Clean-up when vendors reject pricing.

This is essentially **manual, level-by-level MRP with sourcing auction**, where the human
decides quantities and awards and the system keeps the arithmetic, explosion, and paperwork.

### Execution

* **vendbid** — "Vendor Access Program": vendors log in (credentials in `vend_org`) and
  maintain their own bids; also used internally to request bids.
* **shopman** — in-house shop view of open work orders: `wm` MTRs (materials coming to the
  shop) and `po` MTRs (finished goods going back to inventory), by due date.
* **wmclose** — close `wm` MTRs (materials delivered to shop) via `mtr_reg_v_wmcl`.
* **rectool** — receiving: close `po` MTRs (partial → automatic back-order), capture weights.
* **invman** (prodim) — cycle counts, `ad`/`bf` adjustments.
* **shipping** (`ship.sch`, `pak_lnk`) — pack `or` MTRs into shipments; `summtr_k` = packed.
* **apinv** — AP invoices matched to PO lines; paid cost feeds FIFO costing.

## 6. Accounting tie-ins

Projects form a tree (`proj.par`) with types (`inv`, `job`, `ots`, `adm`, `war`, …).
`sum_proj`/`sum_projr` roll up a job's P&L from orders, invoices, MTR material value
(excluding PO MTRs, which are counted via AP), payroll (`pay_req`), work-order labor, and AP —
recursively over children. Funds transfers (`ftr_reg`) move budget between projects. GL
(`gl.sch`, `glman`) was being built out late; much costing was project-based rather than
double-entry.

## 7. Where the business logic lives

| Concern | Location |
|---|---|
| Referential integrity, lifecycle gates, numbering, back-orders, history logging | PL/pgSQL triggers in `dbm/*.sch` |
| Per-role write permissions / allowed transitions | Views + INSTEAD rules (`*_v_*`) in `dbm/*.sch`, plus `priv` table checks |
| Stock / planning math | SQL functions & views (`summtr_*`, `mtr_pn_*`, `prd_part_v_stock`) |
| BOM expansion, package pricing | Client Tcl: `tcl/lib/spread.tcl`, `prd::base_price` (prodim/lib) |
| Order validation & commit | `tcl/ord/ordtool` (`order_commit`, `use_pkg`) |
| Purchasing round, award, WM generation, PO creation | `tcl/potool/purchase.tcl` |
| Receiving / closing | `tcl/potool/rectool.tcl`, `wmclose.tcl` |
| Operating procedure / intent | `tcl/*/*.man` and `*.sgml` manuals |

## 8. Known weaknesses (from code comments / FIXMEs)

* Inventory project `50`, WIP `70`, corporate `1` hard-coded in places.
* BOM evaluated only client-side, in Tcl; the DB cannot explode a BOM itself.
* Many SQL strings built by interpolation (no parameter binding).
* Float quantities/money in places (`float8`), integer-only inventory units.
* No routing/operations, capacity, or scheduling ("sched.tcl" was experimental; due-date
  review tool "not yet implemented").
* `mtr_reg` overloaded (multi-purpose FK dummies `is_ord`/`is_po`); TODO notes "needs to be
  redone for pass 2".
* Revision control of spreadsheets is just `prd_base.revision`; no effectivity dates, so
  changing a spreadsheet changes history-in-progress.
