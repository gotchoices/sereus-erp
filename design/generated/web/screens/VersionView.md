---
provides: ["screen:VersionView", "component:Release", "component:Revise"]
mocks: []
dependsOn:
  - design/stories/web/product-03-release-the-first-version.md
  - design/stories/web/product-02-define-the-family.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/domain/product.md
depHashes: {}
---

# VersionView, with the Release and Revise dialogs

Story product-03 with its defaults: no editor/approver separation (Q1), and a list of
changes from the current version shown before releasing version 2 or later (Q2). Release is
a dialog on DraftEditor; VersionView is the released version, read-only, with Revise.

## Files

| Piece | File |
|---|---|
| Release dialog (on DraftEditor) | `src/lib/components/Release.svelte`; action `?/release` in the draft page server |
| Change list | `src/lib/diff.ts` (definition vs definition) |
| VersionView screen | `src/routes/product/families/[base]/v/[ver]/+page.svelte`, `+page.server.ts` |
| Revise dialog | `src/lib/components/Revise.svelte`; action `?/revise` |
| Read-only definition | `src/lib/components/Definition.svelte` (shared by VersionView) |

## Release (dialog on DraftEditor)

- "Release…" beside "Save draft"; disabled while there are unsaved changes ("Save first").
- Fields: change summary (required); "interchangeable with version N−1" (yes / no, required
  from version 2; not shown for version 1); compatibility notes (prefilled from the draft).
- From version 2: **Changes from vN−1**, computed in the page from the current version's
  definition (loaded with the draft) and the draft: parameters, lines, steps, notes and
  documents added, removed or changed, one line each.
- Submit: `versions.release` → redirect to the new VersionView. Refusals in words; the
  release checks name the line (`ChildParamCount`, `ChildNotReleased` carry the model's own
  sentence, which names it).

## VersionView (`/product/families/[base]/v/[ver]`)

- **Header:** `a:chan`.N, its state (released, superseded, retired; "current" when it is),
  released date and by whom, interchangeable, change summary, compatibility notes.
- **Minor revisions:** a list (number, date, by, summary). A selector shows the version
  **as of** any minor revision (`?minor=M`; default: the latest).
- **Definition**, read-only, in the same sections as DraftEditor: specification, parameters
  (with allowed values), BOM lines, routing, notes and QC by step, documents. Partname
  pattern shown.
- **Actions:** "Revise notes, QC and documents…" when not retired and viewing the latest
  minor revision. "Start draft vN+1" lives on FamilyDetail, not here.

## Revise (dialog on VersionView)

- Edits, on a copy: notes and QC (add, change, remove), documents (add, change, remove),
  and the process times of each step (setup, labor, machine). Steps themselves, parameters
  and lines are not editable here (they change only by a new version).
- A required summary of the revision.
- Submit: the page computes the `MinorChange` (changed notes and documents become
  `replace`, new ones `add`, missing ones `remove`; changed times become `processTimes`) and
  posts it to `?/revise` → `versions.revise`. Success: the page shows the new minor
  revision. Nothing changed: "Nothing to record."

## Navigation wiring

FamilyDetail's version rows link here for every non-draft version.
