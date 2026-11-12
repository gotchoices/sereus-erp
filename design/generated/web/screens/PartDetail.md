---
provides: ["screen:PartDetail"]
mocks: []
dependsOn:
  - design/stories/web/product-04-approve-configurations.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/domain/product.md
  - design/specs/domain/architecture.md
depHashes: {}
---

# PartDetail

One part at `/product/parts/[id]` (the part's ID; a part number or partname also resolves,
`/product/parts/1234`, so a number is a stable link once issued).

## Files

| Piece | File |
|---|---|
| Screen | `src/routes/product/parts/[ref]/+page.svelte` |
| Load and actions | `src/routes/product/parts/[ref]/+page.server.ts` |

## Layout

- **Header:** partname (large, monospace), then the family's description, with links to the
  family and its current version.
- **Part number:** the number when issued. Otherwise "No number yet" and **Issue a number**
  (`parts.number`), with the note that numbers are for orders, POs and inventory and are
  issued only when needed (story Q2 default).
  - **Not shown yet:** whether the number is confirmed by other devices. That state comes
    with offline mode (STATUS.md, part numbers). Online, an issued number has been accepted
    by the cohort the device could reach.
- **Status:** proposed → active → restricted → obsolete, as a select, saved with the fields.
- **Fields** (one form, "Save"):
  - stock policy: minimum level, target level, minimum buy, in the family's unit (shown and
    entered as decimals; stored as integers of the unit's scale, architecture.md §7);
  - tracking: none, by run, by serial;
  - shelf life in days;
  - physical: weight (g), length, width, height (mm), stack factor;
  - comment.
- Identity (family, values) is never editable: a different configuration is a different part.

## Actions

| Action | Model | After |
|---|---|---|
| `?/number` | `parts.number({ id })` | stay; the number appears |
| `?/save` | `parts.update(id, fields)` | stay; "Saved" |

Refusals in words (`PartStatus`, invalid numbers); entries kept.
