---
provides: ["screen:ReferenceData"]
mocks: []
dependsOn:
  - design/stories/web/product-05-reference-data.md
  - design/stories/web/product-01-start-a-family.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/domain/product.md
  - design/specs/domain/architecture.md
depHashes: {}
---

# ReferenceData: units, classes and operations

Story product-05 with its defaults: no deleting (Q1), conversions as a fraction to the base
unit (Q2), one-character class prefixes (Q3). Reached from the Product tabs
("Units, classes and operations") and from FamilyList's empty state.

## Files

| Piece | File |
|---|---|
| Screen at `/product/reference` | `src/routes/product/reference/+page.svelte`, `+page.server.ts` |
| Product tabs | `src/routes/product/+layout.svelte` (third tab) |

## Reads

`units.list()`, `classes.list()`, `operations.list()`, `usage()`.

## Layout

Three sections, each a table with one row per entry and an "Add" row at the bottom.
- **Units:** code, name, dimension (count, length, area, volume, mass, time), decimal places
  stored, conversion to the dimension's base unit as numerator / denominator (both empty
  for none), and "used by N".
- **Classes:** prefix (one character), name, kind (part, package, custom, with a one-line
  meaning), storage notes, and "N families".
- **Operations:** code, description, and "N steps".
- **Editing:** each row is its own small form; changes are saved with the row's Save, which
  appears once the row is changed. The code of an existing entry is shown, not editable.
- **In use:** a unit's decimal places and a class's kind are disabled when in use, with
  the reason as a tooltip and a line under the table. The model refuses them anyway
  (`UnitScaleFixed`, `ClassKindFixed`).

## Actions

One form action per list: `?/unit`, `?/class`, `?/operation`, each an insert-or-update by
code (`units.put`, `classes.put`, `operations.put`). Success: the row shows "Saved". Failure:
the message in words beside the row, entries kept.

| Rule | Shown |
|---|---|
| UnitCodeFormat | "Unit codes are letters, digits and _, up to 12." |
| UnitFactor | "Give both parts of the conversion, both above zero, or neither." |
| UnitScale | "Decimal places are 0 to 9." |
| UnitScaleFixed | "This unit is in use; its decimal places cannot change." |
| ClassPrefixFormat | "A class prefix is one letter, digit or @." |
| ClassKindFixed | "This class has families; its kind cannot change." |
| OperationCodeFormat | "Operation codes are letters, digits and _, up to 16." |
