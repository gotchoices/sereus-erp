---
provides: ["screen:PartList", "component:ApprovePart", "component:ProductTabs"]
mocks: []
dependsOn:
  - design/stories/web/product-04-approve-configurations.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/domain/product.md
depHashes: {}
---

# PartList, with the ApprovePart dialog

Story product-04 with its defaults: one configuration at a time (Q1), a number issued from
the part itself (Q2, PartDetail), new parts `proposed` (Q3). Partnames are the primary
label; numbers appear beside them only once issued (domain/product.md §3).

## Files

| Piece | File |
|---|---|
| Product sub-navigation (Families · Parts) | `src/routes/product/+layout.svelte` |
| Screen at `/product/parts` | `src/routes/product/parts/+page.svelte`, `+page.server.ts` |
| ApprovePart dialog | `src/lib/components/ApprovePart.svelte` (also on FamilyDetail) |
| Approve action | `?/approve` on PartList and on FamilyDetail (shared server helper `src/lib/server/approve.ts`) |
| Parameter definitions (JSON) | `/product/api/params?base=` (extended with unit, range, default, allowed values) |

## PartList

- **Reads:** `parts.list({ familyId?, status? })`, `families.list()` (for the family filter
  and the dialog).
- **URL state:** `?q=` (matches partname or part number), `?family=` (base), `?status=`
  (any by default). Filters apply as they change, as on FamilyList.
- **Rows:** partname (monospace, links to PartDetail), part number or "no number yet",
  family description, status, tracking. Sorted by partname.
- **States:** none approved ("No parts approved yet", with Approve), no match (clear
  filters), error.

## ApprovePart (dialog)

- Opened by "Approve a configuration" (PartList) or "Approve a configuration" on a
  FamilyDetail whose class kind is `part` or `custom` and that has a current version.
- **Family:** a select of part and custom families with a current version (fixed when opened
  from FamilyDetail).
- **Values:** one input per parameter of the family's current version, labeled with its name
  and description: a select of allowed values for a choice, a text input with the unit and
  range for a number (placeholder: the default), a text input for text. Alternatively, a
  partname field (`a:chan(1200,6,75)`) that fills the inputs.
- **Preview:** the partname as it will be written.
- Submit → `parts.create(family, values)`; success → PartDetail of the new part.
- Refusals in words:

| Result | Shown |
|---|---|
| `invalid` | the model's sentence (names the parameter and why) |
| `refused` / `PartCombination` | "a:chan(1200,6,75) is already a part." with a link to it |
| `refused` / `PartKind` | "Packages are sold, not stocked: they are not approved as parts." |
| `refused` / `NoCurrentVersion` | "Release a version of the family first." |
