# ATI engineering documentation

What ATI kept besides the BOM: assembly and installation notes, figures, and burn-table
programs, and how they were tied to product families. This is the background for
[../engineering-docs.md](../engineering-docs.md). Paths are relative to the workspace root and
are read-only.

| Piece | Sources | What it did |
|---|---|---|
| Document store | `old/ati/src/dbm/prd_doc.sch`, `old/ati/src/tcl/lib/pdoc.tcl` | Per-family documents in the database, with check-out and check-in |
| noedit | `old/ati/src/tcl/noedit/` (manual: `noedit.sgml`) | Structured notes editor, typeset with lout |
| bedit | `old/ati/src/tcl/bedit/` (manual: `bedit.sgml`) | Burn-table shape editor, m4 programs, machine drivers, a CAM queue |
| Corpus | `old/ati/doc/` | 1,082 assembly and installation documents (`mnt/`, LaTeX), about 4,300 figure files (`fig/`) |

## 1. The document store (`prd_doc`)

A document belonged to a family (`base`, not a part), keyed by **type**, **class** and a free
**annotation** (so a family could have, for example, a front and a rear figure):

| Type | Meaning |
|---|---|
| `notes` | noedit documents |
| `fig` | figures: tgif drawings, imported PostScript |
| `cam` | burn, mill, lathe and punch programs |
| `arch` | archived material |

| Class | Who it was for, and who maintained it |
|---|---|
| `assy` | assembly (the shop) |
| `inst` | installation (field crews) |
| `rang` | range design (R&D) |
| `ship` | shipping |
| `oper` | the owner's manual (customer service) |
| `sale` | sales |

Each document had a `format` (noedit, tgif, ps, eps, zip…). Files were gzipped and stored in
chunks in `prd_doc_data`. Editing checked a document out to a work file under a lock and checked
it back in. There was no history: check-in replaced the content.

**Class is the point worth keeping.** Documentation covered the product's life after the shop:
installation, shipping, operation, sales. It was not only manufacturing instructions.

## 2. noedit: structured notes (2001)

A notes document was text with **embedded windows**, blocks that each typeset as something
larger:

| Block | Purpose |
|---|---|
| Section | Levels 1–3. Typical shop sections: cut list, fabrication, painting |
| QC check | A line to initial. The manual's rule: the narrative says how; the QC check says what MUST be true. Everything that matters for quality goes in a QC check |
| Figure | Type (assembly, exploded, burn…), width or scale, orientation (portrait, landscape, or **native**: a page of its own at true scale), optional caption, tag |
| Table | Cut lists and other tables, importable from delimited text |
| Reference | A cross-reference to a section or figure by tag |
| Include | Another notes document inline, for procedures written once and used in many (painting) |
| Comment | Not printed: change log, to-do list |
| Part summary | Live from the catalog: name, description, spec, and each parameter with its value for the part |
| Bill of materials | Live from the BOM evaluator (`spread::run`), with each line's comment and no prices |
| Formatting | Page breaks, special characters |

**Live, part-specific output.** Notes were written per family and printed per part. The
header carried the part number, partname, description, notes version, print date, and, when
printed for a job, the **PO item, quantity and due date** (`pdoc::view_bp`). The part summary,
the BOM and burn figures were filled in for that part's parameter values. When a family had no
notes, a generic document was made on the fly: part summary plus default figure.

**Versioning was by hand.** Each document had a `major.minor` version, described as the version
of *the assembly itself*: major for a redesign, minor for anything smaller, and changed even
if only the assembly changed and the notes didn't. A change-log comment at the top recorded
who changed what. WyattERP's family versions and automatic minor revisions
([product.md](../../design/specs/domain/product.md) §4–5) replace this.

**Known weaknesses**, from the manual and its TODO file: spacing bugs when blocks were adjacent,
fragile figure sizing, specs that had to be hard-wrapped, and the lout toolchain.

## 3. Parametric CAM: bedit and the burn programs

The plasma burn tables ran programs generated from **m4 macro files** (`doc/fig/brn`, about
860 `.m4` programs among 1,729 files). The design:

* **Parameters with defaults.** A program declared its dimensions with `defind(name, default)`,
  which defines the name only if it is not already defined. **708 of the programs use it.**
  When a program was compiled for a part, the part's parameter values were defined first, so
  they overrode the defaults (`etwfig.tcl` passes the part's `var value` pairs as `-vars`).
  One program therefore cut every size of a family.
* **Shared shapes.** Macro libraries for recurring features (keyholes, hanger holes, bases)
  were included by programs.
* **One header per machine.** `std_koike.m`, `std_burny.m` and `std_b1250.m` map generic
  operations (kerf left, kerf right, kerf off…) to each table's G-codes. This is a
  post-processor by another name. Drivers (`koike.tcl`, `burny.tcl`, `serial.tcl`) sent the
  result to the machines.
* **Tooling around it:** a shape editor with a simulator, a Tcl shape language (`beasy`), DXF
  import, and a **burn queue** (`camque`) that set the part's variables before compiling, with
  a button to view the part's figure. Its TODO list records "show burnouts in notes" as done:
  a burn figure in the notes was the part's actual cut path.

So ATI already generated machine programs from family parameters, for 2D plasma cutting, with
the machine dialect kept separate from the shape. WyattERP's CAD and CAM generation
([../engineering-docs.md](../engineering-docs.md) §6) is the same idea with a 3D model in the
middle.

## 4. What carries forward

| ATI | WyattERP |
|---|---|
| Documents per family, check-out locks, no history | Documents per family version, valid over a range of minor revisions (built) |
| Document classes (assembly, installation, owner's manual…) | Not yet: notes hang only on routing steps |
| QC checks as lines to initial | QC notes with a measurement spec (built); limits are fixed numbers, not yet expressions |
| Live part summary and BOM in notes | Not yet |
| Includes (shared procedures) | Not yet |
| Notes printed per part and job (PO item, quantity, due) | Travelers specified ([operations.md](../../design/specs/domain/operations.md) §9) but not built |
| Parametric burn programs, per-machine headers | Not yet; proposed as generators |
| Files stored in the database | `ContentRef` is a link with no storage behind it |

The ATI document corpus is not migrated. Like the BOM corpus, it could at most serve as test
material for the notes format.
