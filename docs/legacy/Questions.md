# Design questions, with the owner's answers

The record of the owner's answers (November 2026), cited throughout the docs and specs as "Q1"…"Q33".
All are answered. The decisions they led to are summarized in [../STATUS.md](../STATUS.md).
References to Findings §6–9 point at sections that have since moved to
[../Design.md](../Design.md). New questions go in a new section at the end, for the owner to answer
inline below each question.

## A. The business and its products

1. ★ **Products:** what are the first modular hydroponic products? Please list the modules (for
   example channel/tower, reservoir, pump/plumbing kit, lighting, controller, frame) and which
   dimensions or options vary (length, count, flow rate, voltage, finish…).
   > Those are all good examples.  I'm not ready to commit to specifics yet on the hydroponic parts, but I would like to design the product line in a similar way to how ATI did it.  The idea was to create a line of standard components so that each consumer installation could be/feel custom but the components themselves could be produced in larger volumes and stocked.  This requires a parametric approach.  In fact the ATI system also included packages which used the same spread function and could build entire systems from a single spread/bom description.
2. ★ **Volume:** expected orders per month and distinct configurations per year, in year 1 and
   in year 3? Mostly make-to-order, or make-to-stock?
   > Maybe 100 or so stock components made to stock.  Customer systems configured to order.
3. Is everything built in-house, or will some assemblies go to **contract manufacturers**? Any
   in-house "shops" (cutting, welding, electronics, assembly, test)?
   > ATI was agnostic to whether assemblies and/or parts were provided in-house or from outside vendors.  I like that.  In-house shops are a special case of a vendor.
4. Do you sell **kits/packages** that ship as components (the ATI `@:` model), assembled
   systems, or both? Are installations done on site?
   > Customers could order DIY kits or complete installations, again analogous to ATI.  Yes to packages or an analog.  I can't quite remember why a package had to be a special case (or did it?).
5. Will there be **electronics or firmware** (controllers, sensors) needing serial numbers,
   firmware versions, or lot traceability? Any food-safety or certification traceability needs?
   > Yes.  I would lean toward a "run" identifier and a serial within that (even if this is opaque to the end user).
6. Units: how much material is bought by length, volume or weight (tube, wire, media,
   nutrients)? Do you need fractional inventory and unit-of-measure conversion (buy by roll,
   stock by meter)?
   > Some material will be by length, area, etc.  I think at ATI we had a different part number for similar materials furnished in a different way (coil vs sheet, for example).  I think that was a rare case.  Occasionally material would have to change character (like remnants) which required a reclass (and a pair of mtrs).  If there is a better way, I'm open to it.

## B. Users and operations

7. ★ **Users:** how many people will use the system in the first year, and in what roles
   (you, purchasing, shop, sales, accountant)? Are any non-technical?
   > I would build the system to allow for many different people.  In the beginning, it would only be 2 or 3.  I'm interested in using sereus if possible as a way of promoting the platform as well as the fact that it is built to be distributed across multiple nodes.  While that likely will cost speed, it will be nice for data integrity.  Invite a new node to the strand and you have a new user UI.
8. ★ **Timeline:** when do you need to track inventory and issue POs for real? Is there a stopgap
   in the meantime (spreadsheets)?
   > This is early stage.  The hydroponics is in its infancy so there is time to develop this and start testing it on a small scale.  Not urgent.
9. How many **vendors** do you expect, and do you want them entering their own pricing (a vendbid
   successor)? Would vendors realistically install or run a Sereus app, or does that need a
   web/email fallback?
   > ATI's system was vendor-intensive.  In the modern case, many things are purchased online.  This will change some things.  However, I'd still like a method for vendor sales people to log in and set their own prices.  Vendim worked great for this.  The vendors knew they needed to be price competitive.  In early stage, no salesman will care enough to bother so we can freshen prices manually.  With the addition of an AI assistant (and a web url per vendor-part), we can probabaly automate much of price freshening.
10. Is the ATI **purchasing round** (batch, every other week, human award per part) the workflow
    you want? Or do you prefer continuous replenishment with suggested POs?
    > What I don't want: Favored vendors who always get the order based on relationship or who replenish conban bins and bill.  I would prefer conscious purchasing, a human decision about how what stock levels to carry but with hints from the computer suggesting optimal purchasing quantities.  Some parts can be purchased much cheaper in optimal lot sizes.  I would rather carry some inventory and get optimal pricing on materials.  With a small shop, it is more cost-effective to build a run of controllers at once even though fewer are in demand at the moment.
11. Do you need **sales-side** features (quotes/bids with win probability, customer portal,
    pricing formulas, shipping labels), or will sales happen elsewhere (Shopify or similar)?
    > An online store would be great at some point.  If a customer could design their own kit and order the components, that would be wonderful.  There will also be salesman making larger sales that may include a factory installation.
12. Is there anything ATI lacked that you wish it had: scheduling and capacity, routing and
    labor tracking, QC checklists, mobile scanning (barcodes/QR), CAD/PLM integration?
    > At its peak, it was pretty optimal for its time.  I would like more modern features now available.  The biggest weakness it had was that it didn't run in a browser but was bound to tcl/tk.

## C. Architecture and integration

13. ★ **Build vs. adopt:** how much of your own time are you willing to put into this versus Bonum
    and the startup? Would you accept ERPNext or InvenTree for operations if the parametric
    engine fed it?
    > I'm open to ERPNext/InvenTree if they are open-source and easier to configure than it would be to write a custom system.  However, I suspect that can not play into the sereus idea.
14. **Bonum boundary:** should the manufacturing system be a **subledger** posting summaries to
    Bonum (inventory, WIP, COGS, AP)? Or should every material movement be a Bonum transaction
    with quantity units? Should AP (vendor invoices) live in Bonum or in the ERP?
    > I don't know.  One problem at ATI was that everything was relational to everything else.  So every new module got stacked into the same ERP.  Everything was on one database and it started getting crowded and difficult to scale.  The nice side of that was, with proper constraints, the data were always consistent.  If there is a good way to have multiple databases and keep them somehow consistent, maybe it is more scalable to build everything as its own module.  But I don't know how you even do that.  If inventory is tracked by MTRs, that includes purchase orders _and_ customer orders.  Those imply vendor database _and_ customer database.  Those imply CRM and payroll.  I don't really know how to draw borders on an ERP.
15. **Projects/jobs:** ATI used a project tree as both locations and cost centers. Bonum uses
    tags plus account groups. Is that acceptable, or should the ERP introduce a project/job
    entity of its own (and should Bonum share it)?
    > The ATI project system was another of its weaknesses.  Projects were not really a solid accounting design.  Bonum has account groups (generic across entities) and accounts (entity-specific).  Something like inventory should be an account, not a project.  I think bonum has a stronger design than the ATI accounting schema.  There could, presumably be sub-accounts within inventory (different inventories).  Other assets might have a different character.  For example, WIP would be spread across purchase orders (often an in-house shop/vendor).  JIP might use a customer order for grouping.  I'm not sure how all that should work (if the ATI model is found lacking).
16. **Same strand or separate?** Should the ERP live in its own Sereus app/strand with
    cross-strand links to Bonum, or extend Bonum's schema as a module? (Bonum has no module
    mechanism yet.)
    > TBD.  If we could have a process that keeps different modules in sync, then multiple strands would be a natural way to scale.  If all in one strand, we have the same problem as ATI: all one big giant DB.
17. **Planning statuses:** work/open MTRs are "not yet real" transactions. Should Bonum gain a
    notion of planned or committed transactions (useful for budgets and cash forecasting too),
    or should these stay in the ERP only?
    > Seems like material flow should be an ERP notion and ERP events (like receiving a PO, for example) should post to the accounting ledger.  The ATI system also blurred the lines here.  It was first and ERP and second an accounting system.
18. **BOM language:** pass 2 used arbitrary Tcl in a safe interpreter. For a TypeScript engine,
    which do you prefer?
    - (a) a small custom expression language with `if`/`switch`/`skip` (safe, deterministic,
      portable),
    - (b) sandboxed JavaScript (powerful, harder to make deterministic and safe across peers),
    - (c) a declarative option/rule table with formulas only.

    Determinism matters if peers validate the BOM by re-running it.
    > I'm open to all options.  TCL is still a decent language for embedding.  I wonder if there was really any reason for me to use an interpretor _inside_ postgresql.  I _could_ generate boms from SQL.  But is that important for any reason?  Seems like the bom eval _could_ happen outside the db and simply generate SQL from the results if/when it needed to instantiate the bom as MTRs.  Can I embed a safe JS interpretor inside an app or am I limited to 'eval' (which would not be safe)?  JS is a decent enough language but it is built for asynchronous behavior, not so much as a toolkit language.  I like the idea of a "real language" because it takes all the limits off of what you can build into a bom.  But it needs to be a simple enough language that an engineer just trying to get his bom to work can easily build what he needs.  This should be as simple as a single expression or a whole procedure or even a program.
19. Should BOM instantiations be **cached per part number** (the wyselib `prod.bomc` design) and
    frozen per version, so orders and work orders reference an immutable BOM?
    > Hard question.  Orders from a package should instantiate according to the current/latest version of the package.  That is the only way to put a demand on the individual products in the package.  However, the products themselves don't typically get bom'ed automatically just because the order is input.  Rather, someone does runs periodically so that economies of scale can be achieved.  At ATI, we would ask R&D if any new versions needed to be applied before a purchasing round.  When the round was initiated, it would instantiate the bom for all the products on orders.  There are multiple stages in a round (top level first, then through the recursive layers of the boms, down to raw materials).  I don't remember how prod.bomc worked, but it was the direction I was going before I left.  It would be nice if an order could be re-instantiated manually (because a package changed).  For example, an order would contain a parameterized package.  But the individual parts (MTRs) it would generate was a product of the spread.  If that changed, we didn't have a clean way to update the MTR's on the order.
20. **Part numbering:** keep the ATI convention (prefix:family(params) partnames + short
    numeric part numbers)? Should part numbers be auto-assigned the first time a configuration is
    ordered, or deliberately created as in prodim?
    > I think, only certain parameter combinations are allowed so it probably should be a manual process.  Maybe _that_ is the distinction for a package (where almost any combination of parameters could be acceptible).  I imagine every new version of a product should (at least potentially) be a new part number.  I'm fine with auto-allocation of part numbers.  I'd potentially be fine with just a parameterized partname, but that is a bit more clunky than a sleek, numeric-only part number.
21. UI target: web (SvelteKit like Bonum), mobile for the shop floor and receiving, or both?
    > Multiple apps, potentially.  I'd start with a web version like bonum.  SvelteKit would be fine but we shouldn't commit to that at this point.  I'd likely use appeus like bonum.

## D. Historical material

22. Is there a **database dump** of the final ATI production data anywhere (beyond the 2000
    `prd_spread.sql` and the convert dumps)? It would be useful as a test corpus. Product data
    only is fine.
    > I do have a dump of the ATI data but it is the entire ERP and is huge.  If it will be helpful, I just put a tgz file in /var/tmp/pgdata-2014-Jan-03.tgz.  Thankfully, it is organized by table so it _would_ be feasible to extract just the tables you're interested in.  Take a quick look at the file catalog if you like.
23. Any plans to **open-source or archive** the ATI code? If so, several areas contain personal or
    credential data and must be scrubbed first (see [ati-index.md](ati-index.md), "Sensitive").
    > No.
24. Was there a later "pass 3" ATI deployment using wyseman/wyselib `prod` (2007–2017), or did
    wyselib `prod` stay a design? Is there code for it elsewhere (for example, a newer prodim or
    a Vue wylib app)?
    > I left in 2014 and they didn't do any further development other than bandaids to keep things working.  What I have is a snapshot at the time I left.  I can't really remember prod in detail, but my recollection is, I was working on:
    - A new production system that had better features, version control, better way of generating manufacturing notes.  Seems like the notes got stored per run so we had a record of the instructions for each manufacturing run for QC.
    - A new abstraction of vendors, employees, customers all mushed into "entities".  Can't remember if this got deployed or not.
25. Which parts of ATI's day-to-day use worked best, and which were painful for users? (This
    is not recoverable from code.)
    > The manufacturing aspects were pretty solid.  The salespeople didn't like the UI in ordtool (steep learning curve).  Accounting was awkward the way the GL was built from a series of view of manufacturing data.  I _should_ have used a system where actual ledger entries were created linked to but separate from things like MTR's (as opposed to creating a view _from_ the mtr's themselves).  It was possible for accounting data to change as a result of fiddling in the production data.

## E. Follow-up questions from the answers

These came up while working your answers into [Findings.md](Findings.md) (November 2026).

26. **AP boundary:** should AP and AR live in Bonum, using the GRNI pattern? Receiving posts
    Dr Inventory and Cr GRNI, and the vendor invoice in Bonum clears GRNI (Findings §7). Or do
    you want vendor invoicing inside operations?
    > Receiving should happen inside operations.  Vendor invoice processing should have access to know about what has/hasn't been received.  But it would typically be processed by finance/accounting people, not manufacturing.  Probably a separate module.
27. **Module split timing:** should we use separate strands (catalog, operations, Bonum) from day
    one, or one strand with cleanly separated schemas that we split later? Cross-strand posting
    has no platform support yet. Is that something you want to design into Sereus itself?
    > I'd be OK at least trying separate strands.  Just see what we bump up against.  Let's keep an open mind on this.  ATI spend a good deal of effort on database users, permissions, access.  Strands could go a long way toward what different modules can access.
28. **Parties/entities:** should the shared registry of vendors, customers, employees and shops
    be its own module, or grow out of Bonum's `partner` table?
    > I think each notion (like partners) needs a native place to reside.  If we can access data across strands, we have a natural way for this to work.  One strand/module is _responsible_ for the records.  Other strands/modules may create their own relational data which they can modify.  That seems like a good starting point for a design structure.
29. **BOM language:** after reading Findings §6, do you lean toward QuickJS-wasm, Lua, or
    Tcl-wasm (which could run the old corpus nearly as-is)?
    > I'll be fine with QuickJS as the initial take.  If we run into some type of awkwardness, we can consider Lua (which I don't know) or Tcl as a backup option.  Stay open minded until we see how scripting unfolds.  Is there a clear way in JS to handle either an expression or a code block.  Wouldn't hurt to try writing a few scripts and see what the code looks like (and if it is awkward).
30. **Re-instantiation policy:** suppose a package's definition changes after some of its
    generated demand has already been purchased or started in a run. Should re-exploding adjust
    only the untouched demand and flag the rest for a human? Or do you want some other rule?
    > I think re-exploding will be a manual operation for now and limited to what the user explicitly requests to be exploded.
31. **New version vs. new part number:** what kind of change forces a new part number? (A
    common rule is "form, fit or function changes", meaning the old and new parts are no
    longer interchangeable.)
    > I don't know.  This may need some study.  The obvious problem: If I have objects on the shelf with a part number, what version are they?  This may come down to a human decision: Do we want to be able to distinquish the parts from each other.  Simple parts will not likely bear serial numbers.
32. **Run-size hints:** which costs should the purchasing hints weigh? For example setup cost
    per run, carrying-cost rate, price breaks, and shelf-life limits for nutrients and media.
    > I think the vendor bids each have a lot size.  At ATI I kept bid files for in-house shops but the data was not regularly updated.  I think the code _might_ have consulted historical costs for in-house runs but I can't remember.  A good future research project for you.
33. **2014 dump:** the tarball was still being copied when I looked. Tell me when it's
    complete. Is it OK to extract only the product, MTR and vendor-price tables into a scratch
    area (not into `erp/`), leaving the personal and payroll tables untouched?
    > It is too big to copy.
