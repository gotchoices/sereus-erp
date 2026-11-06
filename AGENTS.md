# Agent rules: WyattERP

## Orientation

WyattERP is a parametric manufacturing ERP and the parent brand of this project. This repository,
`sereus-erp`, is its Sereus-based incarnation and the successor to the ATI ERP. It is in the
**design phase**: there are specifications and a yarn workspace scaffold (`packages/`, `apps/`)
with no domain logic yet. The layout is in [docs/STATUS.md](docs/STATUS.md).

"The owner" in these docs is the project's author and decision-maker, who also wrote the ATI
ERP and the wylib/wyseman/wyselib libraries.

To get up to speed, read in this order:
1. [docs/Vision.md](docs/Vision.md): what and why.
2. [docs/STATUS.md](docs/STATUS.md): where things stand, **what to do next** ("Resume here"),
   and the decision log.
3. [docs/Design.md](docs/Design.md): the reasoning behind the decisions.
4. [docs/specs/](docs/specs/README.md): the domain contract. architecture.md first; it sets the
   conventions the others assume.

Read [docs/legacy/](docs/legacy/README.md) when an **ATI:** note or a Q number needs context,
or when working on the BOM engine's corpus migration.

These documents are meant to be complete. If you learn something a later agent would need, put
it in them (usually STATUS.md or the relevant spec), not only in your reply.

## Paths

* This project lives at `ser/erp` in the workspace, beside `ser/bonum`, `ser/sereus` and
  `ser/quereus`. Paths written `old/...` or `ser/...` are relative to the workspace root.
* Sibling projects are read for reference. Change them only when the owner asks.

## Legacy boundary

* The ATI sources (`old/ati`), the 2014 dump and the local extract in `data/` are private.
  They are read-only study material and **must not be committed**: `data/` and ATI schema files
  are git-ignored. Don't copy ATI code, schema or data into tracked files. Short quoted
  excerpts for analysis in `docs/legacy/` are fine.
* **Never read or extract** personal, payroll, credential or contact data from the ATI tree or
  dump (the ⚠ paths in [docs/legacy/ati-index.md](docs/legacy/ati-index.md), and tables such as
  `pay_*`, `empl*`, `cont_*`, `time_clk`).
* The ATI code is not to be published or open-sourced.
* wyseman, wylib and wyselib (`old/wyseman`, `old/wylib`, `old/wyselib`) are the owner's reference
  libraries. Reference or reuse them freely where relevant.

## Working conventions

* **Specs are the source of truth** for behavior. When a decision changes, update the spec, the
  decision log in STATUS.md, and Design.md if the reasoning changed.
* Specs use MUST / SHOULD / MAY. **ATI:** notes are context. **Open:** marks a deliberate gap
  with its working default. Specs describe data, rules and behavior, never UI; UIs are specified
  later per appeus target. The specs are written to move into an appeus project as
  `design/specs/domain/`.
* "Q12" and similar cite the owner's answers in [docs/legacy/Questions.md](docs/legacy/Questions.md).
  New questions for the owner go in a new lettered section at the end of that file, for the owner to
  answer inline. Summarize them in your reply.
* Confirm Sereus and Quereus capabilities against their own docs (`ser/sereus/docs`,
  `ser/quereus/docs`) before relying on them. Cross-strand joins in one connection are not
  built in Sereus today; see STATUS.md.
* Bonum (`ser/bonum`) is the accounting system and its conventions (integer money, unit model,
  ULID-style IDs) are followed here. WyattERP posts to Bonum and never writes Bonum's tables
  directly.
* Commit only when the owner asks.

## Editorial Comments
The user may edit comments into markdown files for agent consumption using the form:
<!--EC -->
When present, follow the enclosed instructions and/or integrate relevant content into the document where appropriate and then remove the comment.
