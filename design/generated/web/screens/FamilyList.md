---
provides: ["screen:FamilyList", "component:NewFamily", "component:AppShell"]
mocks: []   # no JSON fixtures: variants come from the in-memory catalog (design/specs/project.md, Data Strategy)
dependsOn:
  - design/stories/web/product-01-start-a-family.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/web/global/ui.md
  - design/specs/domain/product.md
  - design/specs/domain/architecture.md
depHashes: {}
---

# FamilyList (with NewFamily and the app shell)

Consolidation for the first web slice. Generated from story product-01 (no screen spec yet),
the navigation and screens plan, and the domain contract. Regenerable; human specs win.

## Route and files

| Piece | SvelteKit file |
|---|---|
| App shell (top bar, sections, status) | `src/routes/+layout.svelte`, `src/routes/+layout.server.ts` |
| `/` redirects to the first section | `src/routes/+page.server.ts` |
| FamilyList at `/product` | `src/routes/product/+page.svelte`, `src/routes/product/+page.server.ts` |
| NewFamily dialog | `src/lib/components/NewFamily.svelte` |
| Data layer (the one mock switch) | `src/lib/server/data.ts` |
| Sereus node host | `src/lib/server/node.ts` |
| Error wording | `src/lib/errors.ts` |

Rendering is server-side: SvelteKit `load` reads through the data layer, form actions write
through it. No catalog code runs in the browser in this slice.

## Data layer

- Screens get a `CatalogModel` (`@wyatt/core/catalog`) from `catalogFor(url)` and nothing else.
- **Mode switch** (one setting, `WYATT_DATA`):
  - `strand` (default): the real catalog strand on this machine's Sereus node
    (`openStrandCatalog`).
  - `memory`: an in-memory catalog per variant. `?variant=` selects `happy` (sample
    hydroponics catalog, `loadSampleCatalog`), `empty` (nothing), or `error` (every call
    returns `unavailable`). The variant is read only here; screens never see it.
- **Node host** (strand mode): a Node `CadreNode` as taleus's `taleus-sereus/src/node/host.ts`
  builds it: file stores under `WYATT_HOME` (default `apps/web/.wyatt/`, git-ignored),
  transaction profile, `strandFilter` on the catalog sApp, owner enrolled on every start.
  - Attach every catalog strand offered by `strand:discovered` (after a restart, all of them).
  - If none appears shortly after start, found one. With `WYATT_SEED=sample`, a newly founded
    catalog is filled with the sample.
  - One node per process (kept on `globalThis`, so the dev server's reloads reuse it), stopped
    on exit with its stores closed.
- **Shell status** comes from the data layer: mode (strand or memory), this node's peer ID,
  and whether another machine is connected (`getControlConnectionCount() > 0`).

## FamilyList

- **Reads:** `families.list({ classPrefix, status, text })`, `classes.list()`, `units.list()`.
- **URL state:** `?q=` (text), `?class=` (prefix), `?status=` (`active` default; `all` shows
  every status). Filters are a GET form, so a filtered list is a link.
- **Rows:** base (monospace), description, class name, unit, status, and the version state:
  "v N current", "+ draft v M", or "draft v1, never released". Sorted by base.
- **States:**
  - loading: server-rendered, so none beyond navigation;
  - empty catalog: "No families yet" with the NewFamily action, and a pointer to set up
    classes and units first when either list is empty (story Q1 default);
  - no match: "No families match" with a clear-filters link;
  - error: the model's message (`unavailable`), the list not shown.
- Rows are not links yet: FamilyDetail is a later slice.

## NewFamily (dialog on FamilyList)

- Opened by "New family". Fields: name (`a:chan`), unit (select from units), description.
- The class is shown as derived from the name's prefix, live, with the class name when it
  exists, and "no class `x`" when it does not.
- Submit: form action `?/create` → `families.create({ base, unitCode, description })`.
  - On success: the dialog closes, the list shows the new family highlighted (`?created=`).
  - On failure: the dialog stays open with the entries kept, and the error in words:

| Model result | Shown |
|---|---|
| `invalid` (bad name) | "Names look like `a:chan`: a class letter, a colon, then letters, digits or `_`." |
| `duplicate` | "A family named `a:chan` already exists." |
| `refused` / `FamilyClass` | "There is no class `x`. Add it under Units, classes and operations." |
| `refused` / `FamilyUnit` | "Choose a unit from the list." |
| other | the model's message |

## Shell

- Top bar: "WyattERP", section links (Product; later sections appear as their modules exist),
  Settings (later slice; not linked yet), and the status: "This device only" / "Connected",
  or "In-memory catalog (variant)" in memory mode.
- Visual: light and dark from the system, dense table layout suited to a workbench
  (global/ui.md defaults).

## Not in this slice

FamilyDetail, discard and delete (product-01 step 4), copying a family (story Q2).
