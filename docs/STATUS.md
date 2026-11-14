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
| `packages/node` | `@wyatt/node` | One installation on a machine: its Sereus node, folder, keys and strands. Shared by the web app and the `wyatt` command |
| `apps/cli` | `@wyatt/cli` | The `wyatt` command: set up and run a server, manage an installation ([README](../apps/cli/README.md)) |
| `apps/web` | `@wyatt/web` | The web app (SvelteKit), appeus target `web` |

TypeScript (NodeNext, strict) and vitest. `core` uses the published Sereus stack
(`@serfab/cadre-core` 1.22, `@quereus/quereus` 5.4, Optimystic 1.27), pinned in the root
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
   * ✅ Targets scaffolded. `apps/web` (`@wyatt/web`, SvelteKit) is a workspace member and
     builds. `apps/mobile` (React Native 0.82.1) is **parked** until the web product section
     works (owner, November 2026).
   * 🔄 Stories, named `<module>-NN-<name>.md`: `design/stories/web/product-01…04`
     (engineer creating a family), drafts for the owner to edit.
   * 🔄 Navigation planning: `design/specs/web/navigation.md` and `screens/index.md` drafted,
     awaiting review. First slice: FamilyList with NewFamily.
   * ✅ Backend for the web app: a real Sereus node in the SvelteKit server process
     (`apps/web/src/lib/server/node.ts`, after taleus's Node host). Data under
     `apps/web/.wyatt/` (git-ignored; `WYATT_HOME` overrides). The catalog strand is founded on
     first start (with the sample when `WYATT_SEED=sample`, which `yarn dev` sets) and
     re-attached after a restart (checked). Mock switch: `WYATT_DATA=memory` (`yarn
     dev:mock`), variants by `?variant=happy|empty|error`; no JSON fixtures.
   * 🔄 First slice generated by the appeus flow: consolidation
     `design/generated/web/screens/FamilyList.md` → `/product` with NewFamily and the shell.
     Awaiting the owner's review. Each route records its file as `output` in
     `design/generated/web/meta/outputs.json` (appeus `check-stale.sh` honors it since November 2026).
   * ✅ Slice 2: FamilyDetail and DraftEditor (product-01 step 4, product-02). Driven end to end
     in a browser on a real strand.
   * ✅ Slice 3: Release dialog (with the change list from the current version) and
     VersionView with Revise (product-03). Exercised in the owner's Chrome on a real strand:
     release of `a:chan` v2, minor revision .1 with history as of .0, discard and restart.
   * ✅ Slice 4: PartList, PartDetail and the ApprovePart dialog (product-04), on Optimystic 1.27.
     Exercised in the owner's Chrome: approve from a partname (stored canonically), issue a
     number, edit status and stock policy, a duplicate refused with a link to the existing
     part. Number confirmation state waits for the offline-numbering work (open items).
   * ✅ Slice 5: ReferenceData (story product-05, written for it): units, classes and
     operations with usage counts. Core gained `usage()` and two in-use rules: a unit's
     decimal places (`UnitScaleFixed`) and a class's kind (`ClassKindFixed`) are fixed once
     used. Exercised in the owner's Chrome: add a unit (`in`, 254/10000 of m), a duplicate
     code refused with entries kept, a row edit saved and reloaded; both in-use rules refused
     when posted directly past the locked inputs.
   * Dev loop: `@wyatt/*` packages are bundled by Vite (`apps/web/vite.config.ts`) and the
     catalog model is built per request over the long-lived node, so `yarn build` of a
     package reaches a running `yarn dev` without a restart.
     `yarn dev_loop [port]` (apps/web, default 5174) restarts the server whenever it exits, so
     an agent can restart the owner's server by killing it.
   * ✅ Slice 6: Settings (story settings-01, written for it), read-only: this device (ID with
     Copy, owner or member, data folder), the party's machines, the strands held (state,
     online/offline, machines not connected), connections and listen addresses. Checked in
     the owner's Chrome on the real node. Inviting machines and people, and the offline
     switch, are its story's Q1 and Q2 (later slices).
   * 🟡 ATI catalog import (`tools/legacy/ati-catalog.ts`, run by `yarn import:ati` in
     apps/web; mapping and commands in tools/legacy/README.md). Into its own node folder,
     `data/wyatt-ati` (git-ignored), browsed with `yarn dev:ati` (port 5175, labeled "ATI 2014
     test data" in the top bar). Results:
     * Full dry run in memory: 8,298 families, 26,903 lines, 7,711 released, 12,206 parts with
       their ATI numbers, 59 standard packages. Not released: 296 with an unreleased child,
       281 with a line whose child-parameter count is wrong, 10 in cycles (530 parts skipped
       with them). 74 unit spellings outside the six dimensions came in as counts; 53 `eng`
       parameters as text. Report: `data/ati-import-report-memory.json`.
     * It took 5.6 hours. Two causes, both fixed: Quereus has no plan cache (now
       `packages/core/src/sql.ts` keeps prepared statements, 2.4× faster), and the catalog's
       two global assertions re-ran over every family at each commit (0.8 s per release at
       8,000 families). They are now keyed row checks, same rules and names, 12 ms per
       release (docs/stack.md, "Cost at volume").
     * Into the strand, the `b:` subset (190 families, 793 parts) took 17 minutes, about 30×
       memory: 1.7 s per family, 1.2 s per release, 0.6 s per part, and 156 MB on disk.
       The full corpus at that rate is about 10 hours and several GB. That cost is in the
       Sereus/Optimystic write path, not yet profiled; it is the volume finding to take to
       Sereus (docs/sereus-requirements.md).
     * The owner chose a strategic sample over the full corpus, to evaluate the UI with real
       data and draw stories from it. `--sample 5` takes each class's five richest active
       families (BOM lines, routing, parameters, parts, documents) and everything they use:
       215 families in all 16 classes, 339 lines, 1,620 parts, no problems. It is what
       `data/wyatt-ati` holds now. 66 minutes into the strand; the cost per part grew as the
       table filled (0.8 s each for the first 1,000, 3.9 s for the next 620), a second
       volume finding to take to Sereus.
     * ⬜ Documents (ATI `prd_doc`, about 19,900 references by family) and notes (the noedit
       files under old/ati/doc), so the sample shows them too.
     * ⬜ The owner browses the sample and writes stories from it; then UX passes.
   * **Direction (owner, November 2026): multi-machine first, then real use.** Before more
     catalog UI, make WyattERP run as a real installation: start one, admit machines by
     invitation, owner and recovery keys, storage machines for redundancy, reachability by
     any libp2p means (no shared-LAN assumption), moving a machine, export and restore. Then
     the owner enters a real case's families (a hydroponics company, kept out of the specs
     and stories, which are for any user), and stories and UX passes come from that use. Rules: [deployment.md](../design/specs/domain/deployment.md); web stories
     settings-02 to settings-07. Sereus supplies machines, keys, invitations, storage
     replicas and reachability (cadre-cli, cadre-host); WyattERP's own part is the web app's
     start-or-join, the Settings screens, founding and finding strands, and export/restore.
     * ✅ Slices 7–11 (November 2026). One implementation of an installation on a machine,
       `@wyatt/node` (`Installation`: start new, join by invitation or owner grant, machines,
       invitations, owner keys and grants, catalogs, export and restore), used by both clients:
       * the `wyatt` command (apps/cli, [README with quickstart](../apps/cli/README.md)): `init
         new|join`, `serve` (a server: fixed ports 4101/4102, relay for the party), `service`
         (systemd/launchd), and every management command, over a loopback admin channel while
         `serve` runs;
       * the web app: a first-run page (`/setup`, settings-02) and Settings sections for
         machines, owner keys, catalogs and backup (settings-03 to -07). `yarn app` runs it on
         `~/.wyatt-web` for real use; `yarn dev` still starts a sample installation.
       * Catalog schema 0.2.0 adds `About` (name, purpose, company) and `Machine` (names); a
         starting set of units, classes and operations is offered at founding (product-05 Q4);
         YAML export and restore (`@wyatt/core/catalog` backup.ts) keep IDs, part numbers and
         audit fields.
       * Tested: `packages/node/src/installation.test.ts` (server starts, desktop joins, writes
         both ways, owner grant, a third machine joins while the first is offline, removal; 65 s),
         `legacy.test.ts` (a folder from before, on catalog 0.1.0, opens and upgrades),
         `packages/core/src/catalog/backup.test.ts` (round trip with a minor revision and a
         second writer). By hand: CLI server + CLI desktop + web app joining in a browser, a
         catalog founded in the web app appearing on the CLI server, export and restore.
     * ⬜ Owner trial: stand up a server (apps/cli/README.md, "Deploying on a Linux server"),
       join the web app to it from a desktop elsewhere. Not yet tried across real networks
       (NAT, firewall, a public name): only loopback and one LAN.
     * ⬜ Left from the stories: QR codes for invitations and grants (text only now);
       removing a strand in the web app (the call exists); another company's strands
       (settings-05 Q1 default: later); a party-wide strand for machine names (deployment.md §4,
       Open); restore progress in the web app.
     * ❓ The existing dev folders (`apps/web/.wyatt`, `data/wyatt-ati`) open under the new code
       as founded installations (checked on a copy made from a stopped node). A copy of
       `data/wyatt-ati` taken while its dev server was running did not open, so
       `data/wyatt-ati.bak-2026-11-13` may be unusable: re-copy it with the server stopped.
   * Product stories revised for UX (owner, November 2026): each now says what the user
     needs to understand (family, class, parameter, partname, version, draft, minor revision,
     part number) and where it is explained on the spot; the family page shows the current
     definition; partname values are shown with their meaning; people by name; empty
     sections stay out of the way. New story product-06 (find a family or part and
     understand it). The generated product screens are stale until a UX pass regenerates
     them from the revised stories.
     * ⬜ Full regeneration pass (owner's request): regenerate the web target's
       consolidations, then every product screen (FamilyList, FamilyDetail, DraftEditor,
       VersionView, PartList, PartDetail, ReferenceData), from the revised stories product-01
       to -06, rather than patching the existing screens. Includes what product-06 adds: one
       search in the top bar, term explanations within reach and a short guide page, "used
       in". `check-stale.sh --target web` lists what remains. Review in Chrome on the owner's
       dev server with seed data, never ATI data in committed screenshots.
   * ⬜ Faster bulk writes for restore and imports: batch many writes in one transaction
     where the model allows, measure on a strand, and take what we find to Sereus as
     issues or PRs (the ATI import: 1–4 s per write, growing with table size).
   * ⬜ Owner's answers to the questions in the stories (working defaults used meanwhile).
   * ⬜ Test data: import the ATI 2014 catalog into a local-only strand once the first screens
     work. Never into a strand shared with others, and never in committed screenshots.
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
| Rules every client shares (deployment and the like) go in the domain contract; stories stay per appeus target and cross-reference other clients. The `wyatt` command (apps/cli) is not an appeus target: it follows the domain contract and documents its own commands | owner and agent, November 2026 |
| One implementation of "an installation on this machine" (`@wyatt/node`) under both the web app and the `wyatt` command, so either can start, join or manage what the other set up. The `wyatt` command does machines and keys itself rather than leaving them to Sereus's `cadre` | agent, November 2026 (slices 7–11) |
| A server runs `wyatt serve`: fixed ports, a public name, and a circuit relay for the party; desktops (the web app) reserve a slot on it when they join, so they need no port forwarding | agent, November 2026; owner's "reachable via libp2p means" |
| A strand's name, purpose and company, and the machines' names, are kept in the catalog strand (`About`, `Machine`) until a party-wide strand exists | agent, November 2026 (deployment.md §4, §7) |
| A new installation or catalog is offered a starting set of units, classes and operations, on by default | owner, November 2026 (product-05 Q4) |

## Open items

* ❓ **Roles and signed writes in the schemas.** catalog.qsql records the writer (`Actor`)
  through mutation context, but the value is asserted by the writer, not verified. Role
  checks (product.md §9) need signed writes against the strand's member keys, as Taleus does
  with `verify(digest(…))`. To be designed once for all modules.

* ✅ **Cascade leftovers** (November 2026). Before Optimystic 1.26, `on delete cascade` did not
  run on a strand ([sereus-requirements.md](sereus-requirements.md) §5). Fixed by moving to
  Optimystic 1.26.0, cadre-core 1.22 and Quereus 5.0 (since 1.27 and 5.4); regression test
  `packages/core/src/stack/cascade.test.ts`. One temporary repair remains:
  - [ ] **Remove the leftover clean-up in `versions.startDraft`** (`packages/core/src/catalog/sql-model.ts`,
    marked TEMPORARY). It clears orphan rows that catalogs written before the upgrade still
    hold. Remove it once no such catalog is in use: the owner's `apps/web/.wyatt/` has been
    reset (or was created after the upgrade). Nothing else depends on it.

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
