# Purchasing: suppliers, bids and rounds

Owned by the **operations** module, with the vendor-maintained parts living in **vendor link**
strands when those exist ([architecture.md](architecture.md) §2). This is the successor to
ATI's `potool` purchase tool, `vendim`/`vendbid` and the work-order parts of `shopman`.

## 1. Principles

* **Conscious purchasing** (Q10). A person decides what to buy, how much, and from whom.
  The system prepares the decision: shortages, explosions, candidate bids, and suggested
  quantities with their reasoning. It never places an order on its own.
* **No favored vendors.** Every award is a choice among the bids on record, and the choice is
  recorded.
* **Make or buy is decided per buy, not per part.** Any assembly can be bought complete
  (`P` bid) or built from components with labor only (`A` bid), by an outside vendor or by an
  in-house shop.
* **In-house shops are suppliers.** They are parties with the `shop` role and an `in_house`
  flag, with their own `wip` location and their own bids.
* Automation can be added later (for example accepting the suggestions in bulk for routine
  parts). Suggestions are therefore a separate, replaceable step (§6).

## 2. Suppliers

A supplier is a party (owned by the parties module) with the role `vendor` or `shop` and
`in_house` true or false. Operations keeps its own related record per supplier:
* default lead time, minimum order value and payment terms reference;
* the `wip` location for shops;
* purchasing contact preferences (portal, email or web ordering);
* status (`active`, `on_hold`).

## 3. Bids

A **bid** is a supplier's price for a part:

| Field | Meaning |
|---|---|
| supplier, part | The part number, with an optional version pin when the supplier's revision matters |
| kind | `P` whole part; `A` labor only (we supply the components); `S` service (testing, plating…), priced like `A`, with no component explosion |
| supplier_ref | The supplier's own part number, spec and URL (ATI `vspec`) |
| pack | Units of our part per purchase unit (for example 100 per box, or 50 m per roll). Prices are per *our* unit, and orders are rounded up to whole packs |
| lot | The minimum quantity at which this price applies. Several bids with different lots for the same supplier and part make **price breaks** |
| unit_price | Per our unit (see [architecture.md](architecture.md) §7 for precision) |
| setup | An optional fixed charge per order or per run (tooling, setup) |
| lead_days | Lead time |
| expires | Expiry date. Expired bids remain visible but can't be awarded without the `buyer_lead` role |
| active | |
| **source** | `supplier` (entered by the supplier), `manual` (entered by a buyer), `quote` (from a written quote), `web` (read from the supplier's web page, by a person or an AI assistant), or `derived` (computed from run history, for in-house shops: §6) |
| **as_of** | When the price was last confirmed true, which may differ from the last edit |
| source_url | For `web` bids, where to refresh the price |
| rebid_requested | Flag: a buyer wants the supplier to refresh this bid |

* Every change is kept in **bid history** (ATI's `vend_price_hist` had 201,609 rows).
  History is append-only.
* **Price refresh** (Q9): early on, a buyer or an AI assistant refreshes `web` bids from
  `source_url` and records `source` and `as_of`. Later, suppliers maintain their own bids
  through their vendor link (§9).
* **Award checks**, from ATI:
  * warn when the quantity is below the bid's lot (offering to raise it);
  * warn when the quantity is above 1.8 × the largest lot (ask for a re-quote), except for
    in-house shops;
  * warn when the bid has expired, or its `as_of` is older than a set age (default 180 days);
  * raise an alarm when the award value exceeds a threshold (ATI: $5,000).

## 4. Purchasing rounds

A **round** is a document in operations: a number or date, the buyer, a status
(`open` → `closed`), and **round lines**.

| Round line field | Meaning |
|---|---|
| part, ver | What is needed. Version from the demand, or current |
| level | The stage at which it entered the round: 0 for shortages loaded from planning, n+1 for components of a level-n `A` award |
| need | The quantity required to cover the shortage, by due date |
| suggested | The quantity the system suggests, with its reasoning (§6) |
| qty | The buyer's chosen quantity |
| due | Needed-by date: drop-dead from planning, or back-scheduled from the parent's run |
| award | The chosen bid, or none |
| parent | For component lines: the round line whose `A` award created this need |
| status | `open`, `awarded`, `dropped`, `ordered` |

Round lines are **planning records**. An awarded line counts as *supply in progress* for its
part, and the component lines of an `A` award count as *demand* on their components from the
moment of the award, before any PO or run exists. Planning therefore sees a run's material
needs as soon as the buyer decides to make. ATI's `availp` likewise included the round in
progress. Round lines are not moves until the round produces POs and runs.

### The round, step by step

1. **Load:** create the round from the **shortage list** ([operations.md](operations.md)
   §13): parts whose projected stock falls below `min_level` or below zero within the
   horizon. The buyer MAY add parts by hand.
2. **Review:** drop lines, or adjust the part's stock policy (`min_level`, `target_level`,
   `min_buy`) on the spot. Policy changes are recorded.
3. **Engineering check** (optional): a prompt to confirm that no draft versions should be
   released before the round expands (ATI practice: ask R&D before a round).
4. **Solicit** (optional): mark bids for re-quote, or ask new suppliers for parts with fewer
   than three active bids. Requests go out through the vendor link, by email, or as a task for
   an AI assistant to refresh `web` prices. The round can wait for answers.
5. **Decide each line:** choose a quantity (suggestions in §6) and **award** a bid.
   * **`P` award:** the line is complete. It will become a PO line.
   * **`A` or `S` award:** the line will become a **run** at that shop. For `A`, the engine
     explodes the part **one level** at the line's version. The components become new round
     lines at level n+1, each with need = the component quantity × the line quantity, due
     dates back-scheduled by the shop's lead time, and planned issue to the shop's location.
     The buyer MAY edit that component list (ATI allowed this), and edits are recorded.
6. **Repeat** step 5 for the new lines, level by level, until no line remains with an
   unawarded or `A`-awarded line whose components haven't been added. Components that
   available stock already covers drop out automatically: the round recomputes their
   shortage after each award, because new component demand lowers availability (ATI's
   iteration).
7. **Consolidate:** see per supplier the total awarded value, small orders, and lines that
   could top up a supplier's existing open PO. Re-award as needed.
8. **Make documents:**
   * awarded `P` lines are grouped per supplier into **POs**;
   * awarded `A`/`S` lines become **runs** ([operations.md](operations.md) §9). For an outside
     shop, the run also gets a **PO line** for the labor or service, at the bid price;
   * the round's component lines become the runs' component lines (issue moves to the shop).

   Committing these documents creates their planned moves.
9. **Distribute:** send POs and run packets (traveler and pinned notes) to suppliers and
   shops through their link strand, or by email or PDF.
10. **Close the round.** Its lines are kept as the record of what was decided, by whom and why.

ATI: steps 1–12 of `purchase.man` map onto these. `pt`/`wt` MTRs become round lines, and
"Make PO" becomes step 8.

## 5. Choosing the version at expansion

Round lines take the version from their demand. For stock replenishment with no specific
demand, they use the **current** version at load time. `A` awards pin that version for the run
and for its component explosion. A version released during an open round does not change
the round's lines. The buyer MAY re-expand a selected line, which follows the same diff rules
as order re-explosion ([operations.md](operations.md) §8).

## 6. Quantity suggestions

Shown for every line, with the arithmetic visible. The buyer picks or types a quantity.

| Suggestion | Formula | Source |
|---|---|---|
| **Need** | The shortage to cover by the due date | planning |
| **Policy** | max(target_level − projected, min_buy) | ATI `rec_buy` |
| **EOQ** | √(2 × order_cost × annual_use ÷ (unit_cost × carry_rate)) | ATI `mtr_pn_recstk`, with the correct factor of 2; defaults order cost $10 and carrying rate 15%/year, configurable |
| **Price-break optimum** | Among candidate quantities (need, policy, EOQ, each bid lot and pack multiple ≥ need), the quantity minimizing **cost per unit consumed** over the horizon: `(q × price(q) + setup + carry_rate × avg_inventory_value × months/12) ÷ q` | new |
| **Run size** (in-house `A`) | As above, with `setup` = the shop's setup cost **derived from actual run history** (average setup labor of the last N runs of this family), not a hand-kept bid | new: answers Q32 |
| **Shelf-life cap** | No suggestion exceeds the usage expected within the part's shelf life | new: for nutrients and media |

**Derived in-house bids:** for in-house shops, the system MAY keep `A` bids with
`source = derived`, recomputed from the costs of closed runs (labor, and setup separated where
recorded). ATI's in-house bids were edited by hand and never fed by actual costs. A buyer can
still override a derived bid with a `manual` one.

## 7. Lead times and due dates

* The **expected lead time** per bid is the larger of its `lead_days` and the supplier's
  recent actual lead for this part (receipt date − PO date, exponentially weighted, from ATI
  `mtr_pn_lead`).
* **Back-scheduling:** a run's component due dates = the run's start date − the issue
  lead time. The run's start = its due date − the shop's lead time for the part. ATI left this
  "not implemented".
* Late lines (urgency < 0) are flagged in the round.

## 8. Roles

| Action | Role |
|---|---|
| Create or work a round; edit bids; award | `buyer` |
| Award above the value threshold; award an expired bid; over-lot exceptions | `buyer_lead` |
| Make and commit POs and runs | `buyer` |
| Edit stock policy during review | `buyer` |
| Refresh `web` prices | `buyer`, or an AI assistant acting for a buyer (recorded as such) |
| Supplier edits to its own bids (in the vendor link) | the supplier's members |

## 9. Vendor and shop link strands

When a supplier participates directly:

* **Vendor link** (`vendor:<party>`): members are the supplier's people plus our buyers.
  * The supplier **owns its bids** in this strand and edits them (the successor to vendbid).
    Ops reads them across strands, or copies them into ops on each change, marked
    `source = supplier`.
  * Our side publishes: the parts we want quoted (with specs and drawings), rebid requests,
    POs, and change orders.
  * The supplier publishes: PO acknowledgments, promised dates, ship notices.
  * The vendor sees only its own strand, and therefore only its own data. It has no portal
    accounts and no shared database.
* **Shop link** (`shop:<party>`): for outside shops, and optionally for in-house shop
  tablets.
  * Published to the shop: its runs, travelers and pinned notes, and component issue
    notices.
  * The shop records: the start, step completions, QC results, the completed quantity and
    scrap. Operations turns these into run updates and moves ([operations.md](operations.md)
    §9).
* Until cross-strand views exist ([architecture.md](architecture.md) §5), what our side
  publishes is an explicit extract written into the link strand.

## 10. ATI correspondence

| ATI | Here |
|---|---|
| `po_purch` round | round + round lines |
| `pt` MTR | round line awarded `P` |
| `wt` MTR | round component line (level n+1) |
| `vend_award` | round line `award` |
| `vend_price` + `_chng`/`_hist` | bids + bid history |
| `prodtype` P / A / S | bid kind P / A / S |
| `vnd_type = inh` | supplier `in_house` |
| `po_hdr.ptype` p / w | PO / run |
| vendbid logins | vendor link strand |
| shopman | shop link strand, or the in-house shop interface |
| `buylev` / `reclev` / `recbuy` | `min_level` / `target_level` / `min_buy` |
