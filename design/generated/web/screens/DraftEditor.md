---
provides: ["screen:DraftEditor"]
mocks: []
dependsOn:
  - design/stories/web/product-02-define-the-family.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/domain/product.md
  - design/specs/domain/catalog.qsql
depHashes: {}
---

# DraftEditor

The family's draft at `/product/families/[base]/draft`, edited in the browser and saved as a
whole (`versions.saveDraft`). Generated from story product-02 with its question defaults: no
expression checking (Q1), no try-a-configuration yet (Q2), documents as links (Q3),
reordering parameters allowed (Q4). Releasing is the next slice (a dialog here).

## Files

| Piece | File |
|---|---|
| Screen | `src/routes/product/families/[base]/draft/+page.svelte` |
| Load and save | `src/routes/product/families/[base]/draft/+page.server.ts` |
| Child parameter lookup (JSON) | `src/routes/product/api/params/+server.ts` |
| Section editors | `src/lib/components/draft/{Parameters,Lines,Routing,Notes,Documents}.svelte` |
| Draft helpers (empty rows, renumbering) | `src/lib/draft.ts` |

## Load

`families.get(base)` (404 if missing; if it has no draft, redirect to FamilyDetail), then
`versions.get(id, draftVer)`, `units.list()`, `operations.list()`, and the families that can
be components (`families.list({ status: 'active' })`, those with a current version).

## Editing model

- The whole `DraftDefinition` lives in one `$state` object in the page. Section editors
  mutate it through bindable props. Nothing is saved until "Save draft".
- **Unsaved changes:** a "Unsaved changes" marker by the Save button, and leaving the page
  with unsaved changes asks via the browser's beforeunload prompt (not a JS confirm).
- **Save:** the definition is posted as JSON (`definition` field) to `?/save`;
  the server parses it and calls `versions.saveDraft`. On success: "Saved" with the time,
  and the state is replaced by what the server returned (canonical order, assigned IDs). On
  refusal: the rule in words, and the page keeps every edit.

## Sections (in this order, each a titled block)

1. **Specification:** markdown textarea. Under "More": explode default (none, to part, one
   level, full), family script, price formula.
2. **Parameters:** a table, in partname order (row order sets `pos`, renumbered on save).
   Columns: name (`var`), type (number, choice, text), unit (numbers), description, default,
   min, max. A choice parameter expands a sub-list of allowed values (value, description).
   Rows: add, remove, move up/down. A note shows the partname pattern being built:
   `a:chan(L,N,D)`.
3. **BOM lines:** rows in evaluation order (row order sets `pos`). Columns: component (a
   searchable list of families with a current version), one input per child parameter,
   labeled with the child's parameter names (fetched from `/product/api/params?base=`
   when the component changes), quantity expression, condition (`when`), step (select of
   routing steps or none), comment. "More" per row: script, pinned child version.
4. **Routing:** steps with an explicit step number (`idx`, so lines and notes can name it):
   operation (select), next step, setup time, labor per unit, machine per unit (each an
   expression, minutes), description. Add, remove.
5. **Notes and QC:** grouped by step; each note: type (step, figure, QC), text (markdown),
   document (select of this draft's documents or none). A QC note can carry a measurement:
   name, units, nominal, min, max, or pass/fail.
6. **Documents:** kind, name, link (`contentRef`). Add, remove.

## Errors in words (refused rules from catalog.qsql)

| Rule | Shown |
|---|---|
| ParameterVarFormat | "Parameter names are letters, digits and _, not starting with a digit, and not a reserved word." |
| ParameterVarUnique / duplicate | "Two parameters have the same name." |
| ParameterNumUnit | "A number parameter needs a unit." |
| ParameterRange | "Min and max apply to numbers, and min must not exceed max." |
| AllowedValueOfEnum | "Allowed values apply only to choice parameters." |
| BomLineComponent | "A line names a family that does not exist." |
| BomLineProcess / ProcessUnused | "A line names a routing step that does not exist." |
| ProcessNext | "A step's next step does not exist." |
| ProcessOperation | "Choose an operation for every step." |
| NoteProcess | "A note belongs to a step that does not exist." |
| NoteDocument | "A note points to a document that is not in this draft." |
| NoteMeasure | "Only QC notes carry a measurement." |
| other | the model's message |

## Not in this slice

Release (next slice), comparing with the current version (product-03 Q2), trying a
configuration (needs the BOM engine).
