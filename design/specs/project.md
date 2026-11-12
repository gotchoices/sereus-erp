# Project Spec

> **Status:** targets approved by the owner (November 2026): `web` in SvelteKit and `mobile`
> in React Native, both scaffolded. Still open: the publisher id (below). Mark changes with
> `<!--EC … -->` comments or edit directly.

This document captures key decisions for the project. Complete this during the discovery phase before adding app scaffolds.

## Purpose

**What problem does this project solve?**

WyattERP runs a small manufacturing business whose products are **parametric**: a modest
number of families, each with many possible configurations, built from stocked standard
components. It defines those families and their bills of materials, then runs purchasing,
production, inventory and orders against them, and posts the money side to Bonum. It is the
Sereus-based successor to the ATI ERP. The data lives in the business's own strands, one per
module, shared only with the people and partners who need it ([domain/index.md](domain/index.md),
[domain/architecture.md](domain/architecture.md)).

The first working data set is the owner's hydroponics product line (small). The ATI 2014
corpus is used only to test volume and BOM scripting.

**Who are the target users?**

* **Engineer / product manager** (first): defines families, parameters, BOMs, routing,
  notes and QC, and releases versions. Today that is the owner.
* **Purchasing, receiving, shop floor, sales** (later modules): staff of a small company,
  often the same few people wearing several hats.
* **Outside parties** (later, separate targets): vendors bidding and acknowledging POs, outside
  shops reporting runs.

**Delivery posture:**

- **Production** for the domain and `@wyatt/core`: correctness first. The schemas and the
  model are the long-term record, held to contract tests in memory and on real strands.
- **MVP** for the first UI: get the product section usable for the hydroponics line, learn,
  then refine. The UI is regenerable from stories and specs.

## Platforms

**What platforms will this project target?**

- [x] Mobile (iOS/Android)
- [x] Web (desktop browsers)
- [ ] Desktop (Electron, Tauri). Not planned; the web app covers the desk.

**Are experiences different per platform?**

Yes. **One ERP app per platform**, each module a section of it, shown when this device
belongs to that module's strand (decision log, STATUS.md).

- **Web: the workbench.** Dense editing and many records at once: parameter tables, BOM
  lines with expressions, routing, notes and QC, release and comparison of versions, part
  lists. The product section is built here first.
- **Mobile: the floor and the pocket.** Look up a part by partname or number, read a step's
  notes and QC criteria, and later receive, count, issue and record runs. The product section
  is read-mostly on mobile.

## Identity (publisher + app id)

- **Publisher id (reverse-DNS domain)**: `org.wyatterp` (already the prefix of the sApp IDs,
  `org.wyatterp.catalog`). **Open:** the owner may prefer `org.sereus`, as Bonum and chat use.
- **Preferred app name**: `erp`
- **Default mobile app id (reverse-DNS)**: `org.wyatterp.erp`

## Apps

| App Name | Platform | Framework | Status |
|----------|----------|-----------|--------|
| web | browser | sveltekit | scaffolded; product section first |
| mobile | iOS/Android | react-native | scaffolded, **parked** until the web product section works |
| cli | node | typescript (`@wyatt/cli`) | scaffold exists |
| vendor | browser | sveltekit | future: a vendor's own app, vendor link strand only |
| shop | iOS/Android or browser | tbd | future: an outside shop's app, shop link strand only |

## Toolchain

### Mobile

- Framework: **react-native**, as chat and the Sereus reference app. NativeScript is ruled out
  for now: it has no Sereus offline-mode journal (`ser/sereus/docs/strands.md`, "Offline
  mode"), and offline operation is part of what this project tests.
- Runtime: bare
- Language: typescript
- Package manager: yarn (the workspace's yarn 4)

### Web

- Framework: **sveltekit**, as Bonum's web app (the Sereus web reference app is Svelte too).
- Language: typescript
- Package manager: yarn, as a member of the root workspace (`apps/web`)

## Data Strategy

**How will data be managed?**

- [x] Local-first with sync: each module is a Sereus strand; the app runs a node and opens the
  strands this device belongs to.
- [ ] Cloud-only (backend API)
- [x] Offline support required: Sereus offline mode on both platforms. Operations that need a
  confirmed value (a part number for an order) wait until the network confirms it
  ([domain/product.md](domain/product.md) §3).
- [ ] Real-time updates needed: changes from other devices appear when they arrive; no hard
  real-time.

**Backend:** none of our own. Peers on Sereus; optionally an always-on storage node of the
party's cadre.

**Data layer boundary.** Screens call `@wyatt/core/<module>` models only (`CatalogModel`
first). They never touch SQL, strands or Sereus directly. The same model runs:
- on a strand (`openStrandCatalog`), in the real app;
- in memory with the sample catalog (`openMemoryCatalog` + `loadSampleCatalog`), for design
  review, screenshots and mock variants. It enforces the same schema, so a mock can never
  show what the real system would refuse.

## Shared Resources

- [x] Domain contract: `design/specs/domain/` (architecture, product, bom-engine, operations,
  purchasing, and the executable `catalog.qsql`)
- [x] TypeScript: `@wyatt/core` (models per module), `@wyatt/domain` (IDs, quantities,
  partnames), `@wyatt/bom-engine`. These take the place of appeus's `packages/shared/`.
- [x] Mock data: `mock/data/`, generated from the in-memory catalog where possible, so
  fixtures and the real model agree.

## Notes

- Domain specs never describe UI. Screens, navigation and UI conventions live in
  `design/specs/<target>/`. A UI rule that holds on both platforms is written in each
  target's `global/` specs, not in the domain.
- Module sections appear by strand membership (domain/architecture.md §8). Roles within a
  strand (engineer, approver…) are not enforced yet (STATUS.md, open items), so the UI shows
  every action and relies on the model's refusals.
- Part numbers: partnames everywhere in engineering screens; numbers shown where commerce
  needs them, with their confirmation state.

**Quality / performance posture (brief):**

- Expected scale: small (hydroponics: tens of families, hundreds of parts). The ATI corpus
  (thousands of families, about 4,000 BOM scripts) is the stress test, not the target.
- Critical interactions that must stay fast: family and part search (by partname, number,
  description), opening a family's definition, saving a draft, explosion previews.

---

*After completing this document, run `add-app.sh` for each target to scaffold the apps.*

**Stories** are per target and named by module: `design/stories/<target>/<module>-NN-<name>.md`
(`product-01-start-a-family.md`). Modules sort together, numbers order the stories within a
module, and a story that spans modules is filed under the module where it starts.
