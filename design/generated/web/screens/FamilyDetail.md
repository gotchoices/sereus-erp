---
provides: ["screen:FamilyDetail"]
mocks: []
dependsOn:
  - design/stories/web/product-01-start-a-family.md
  - design/stories/web/product-03-release-the-first-version.md
  - design/stories/web/product-04-approve-configurations.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/domain/product.md
depHashes: {}
---

# FamilyDetail

One family at `/product/families/[base]`: who it is, its versions, its parts, where it is
used, and the version actions. Generated from stories product-01 (step 4), product-03 and
product-04, with no screen spec. Release itself is a later slice (on DraftEditor), as are
VersionView and part approval.

## Files

| Piece | File |
|---|---|
| Screen | `src/routes/product/families/[base]/+page.svelte` |
| Load and actions | `src/routes/product/families/[base]/+page.server.ts` |
| Confirm-in-place button | `src/lib/components/ConfirmButton.svelte` |

`[base]` is the family's base, URL-encoded (`a%3Achan`). The URL is human-readable and stable,
because a base is permanent once released.

## Reads

`families.get(base)`, `versions.list(id)`, `parts.list({ familyId })`,
`families.whereUsed(base)`, `classes.list()`, `units.list()`. A missing family is a 404 with a
link back to Families.

## Layout

- **Header:** base (monospace, large), description, then class, unit, status and
  version-strict as a compact line.
- **Actions** (by state):
  - has a draft: "Edit draft vN" (→ DraftEditor), "Discard draft" (confirm in place);
  - no draft, has a current version: "Start draft vN+1" (copies the current version, then
    → DraftEditor);
  - no draft, never released: "Start draft v1";
  - never released (with or without its draft): "Delete family", which removes the draft
    with it (confirm in place; story product-01 step 4).
- **Versions:** one row per version: ver, state, released (date, by), change summary,
  latest minor revision. Released versions will link to VersionView in its slice.
- **Parts:** approved parts of this family: partname, part number or "no number yet",
  status. Empty: "No parts approved yet." (Approving is the product-04 slice.)
- **Used in:** the lines that name this family as a component: parent base and version,
  state, quantity expression. Empty: "Not used in any family."

## Actions (form actions)

| Action | Model | After |
|---|---|---|
| `?/startDraft` | `versions.startDraft(id)` | redirect to DraftEditor |
| `?/discardDraft` | `versions.discardDraft(id)` | stay; the list refreshes |
| `?/remove` | `families.remove(id)` | redirect to Families |

Failures show in words above the actions (refused rule → sentence, `$lib/errors.ts`).

Confirm in place: the first click turns the button into "Confirm discard?" with a Cancel;
no browser `confirm()` dialogs.

## Navigation wiring

FamilyList rows link here. Breadcrumb "Families ›" back to the list.
