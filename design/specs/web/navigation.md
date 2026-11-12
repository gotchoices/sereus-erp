# Navigation Spec

Purpose: define navigation structure, deep links, and route options for the **web** target,
the ERP workbench. Status: **draft for the owner's review** (November 2026).

## Shell

One app. A top bar carries the WyattERP name, the **module sections** this device can open,
and Settings. A section is shown only when this device belongs to that module's strand
(domain/architecture.md §8). The first section is **Product**; the others (Parties,
Operations, Purchasing, AP, AR) are added as their modules are built.

A status indicator in the top bar shows whether this device is connected to the other
members, and whether any changes are still waiting to reach them.

## Sitemap

- **Product** (section)
  - FamilyList (root, `/product`): every family, searchable and filterable.
  - FamilyDetail (`/product/families/[base]`): one family: its versions, its parts, and where
    it is used.
    - DraftEditor (`/product/families/[base]/draft`): the family's draft, edited and saved as
      a whole. Releasing is a dialog on this screen.
    - VersionView (`/product/families/[base]/v/[ver]`): a released version, read-only, as of
      any minor revision (`?minor=N`). Revising notes, QC and documents is a dialog here.
  - PartList (`/product/parts`): approved parts across families, by partname or number.
    - PartDetail (`/product/parts/[id]`): one part: its fields, stock policy, and its part
      number with its state (none, pending, confirmed).
  - ReferenceData (`/product/reference`): units, classes and operations.
- **Settings** (`/settings`)
  - Settings: this device, its strands, and its connection.

New family: a dialog on FamilyList, which then goes to the new family's DraftEditor.

## Deep Links

- Web routes are URLs; every screen above is reachable directly by its path.
- Pattern for review states: `<path>?variant=<name>` (appeus mock variants). Variants are
  served by the in-memory catalog, not by JSON fixtures (design/specs/project.md, Data
  Strategy). Production ignores `variant`.

## Route Options

- FamilyList: title "Families"
- FamilyDetail: title is the family's base (`a:chan`) and description
- DraftEditor: title "`a:chan` draft (version N)"
- VersionView: title "`a:chan`.N", with ".M" when showing minor revision M
- PartList: title "Parts"
- PartDetail: title is the partname, with the part number when it has one
- ReferenceData: title "Units, classes and operations"
- Settings: title "Settings"

## Notes

- Partnames are the primary label everywhere in Product; part numbers appear beside them
  only where they exist (domain/product.md §3).
- Keep this spec human-readable and user-observable.
- This spec overrides any AI-generated navigation consolidation.
