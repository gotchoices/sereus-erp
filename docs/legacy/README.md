# Legacy: the ATI ERP

Study material on the system WyattERP succeeds: the Action Target (ATI) ERP written
between 1990 and 2013 (PostgreSQL + Tcl/Tk), and the wylib/wyseman/wyselib libraries that grew
out of it. Read this to understand *where the domain model came from*. The specs don't require
it, but they cite it in their **ATI:** notes.

**Nothing from ATI is checked in here.** The sources and data live outside this repository and
are private:
* do not copy ATI code, schema files or data into the repository;
* `data/` (the local 2014 extract) is git-ignored;
* personal, payroll, credential and contact data in the ATI tree and dump were deliberately not
  read or extracted (paths flagged ⚠ in [ati-index.md](ati-index.md)). Keep it that way.

The wyseman, wylib and wyselib libraries are the owner's open reference software. They may be
quoted, referenced or reused freely where relevant.

## Documents

| Document | Contents |
|---|---|
| [Findings.md](Findings.md) | What ATI was, what the 2014 data shows, where its logic lived, lessons (keep / fix / drop), and an assessment of the MTR ledger against mainstream designs |
| [Questions.md](Questions.md) | The owner's answers, Q1–Q33: the source of most design decisions |
| [ati-mfg-model.md](ati-mfg-model.md) | Detailed technical model: tables, MTR types and statuses, planning formulas, purchasing steps |
| [ati-framework.md](ati-framework.md) | The `dbm` schema tooling and Tcl framework, and the wyseman/wylib/wyselib lineage |
| [ati-index.md](ati-index.md) | Directory index of `old/ati` and related trees, with sensitive paths flagged |
| [bom-scripting-js.md](bom-scripting-js.md) | Trial port of real ATI BOM scripts to JavaScript (the evidence for the engine's language decision) |
| [data-2014.md](data-2014.md) | The 2014 production dump: what was extracted, how to re-create the extract, and highlights |

## Where the sources are

Paths are relative to the workspace root (the directory that contains `ser/` and `old/`). All are read-only.

| Resource | Path | Notes |
|---|---|---|
| ATI source overview | `old/ati/src/README` | Explains passes 0, 1 and 2 |
| Schema (pass 2) | `old/ati/src/dbm/*.sch` | Start with `prd`, `prd_bom`, `mtr`, `ship_mtr`, `ord_mtr`, `po_mtr`, `po_purch`, `vend_price` |
| Schema build tooling | `old/ati/src/dbm/{README,mkdb,mkfile,mkscan,depord}` | |
| BOM spreadsheet data (2000) | `old/ati/src/dbm/work/prd_spread.sql` | Real formula and script examples, about 1,200 families |
| BOM evaluator | `old/ati/src/tcl/lib/spread.tcl` | The core of the parametric engine; the basis for the Tcl oracle |
| Product manager | `old/ati/src/tcl/prodim/{prodim,prodim.man,invman.tcl}` | The manual is the best conceptual introduction |
| Order tool | `old/ati/src/tcl/ord/{ordtool,ordtool.man}` | `use_pkg`, `order_commit` |
| Purchasing | `old/ati/src/tcl/potool/{purchase.tcl,purchase.man,potool,rectool.tcl,wmclose.tcl}` | `purchase.man` describes the purchasing round step by step |
| Vendor bids | `old/ati/src/tcl/vendim/{vendbid,vendbid.man,vendim}` | The vendor-facing program |
| Shop manager | `old/ati/src/tcl/shopman/{shopman,shopman.sgml}` | |
| Inventory design notes (1998) | `old/ati/src/tcl/opr/README.prdman` | |
| Pass-0 C tools | `old/ati/src/pass0/{manuf,bidreq,po,...}` | Pre-1999 predecessors |
| 2014 production dump | `<archive>/ati/pgdata-2014-Jan-03.tgz` | 16 GB; see [data-2014.md](data-2014.md) |
| wyseman | `old/wyseman` | Schema manager (Tcl-syntax formats, Ruby gem) |
| wylib | `old/wylib` | Tcl/Tk widget library |
| wyselib | `old/wyselib/schema/prod` | **Pass-3 product model:** versions, operations, BOM evaluated in the database. The basis for WyattERP's versioning |

Related: **Taleus** (`ser/taleus`) is a wyseman/PostgreSQL application being rebuilt on Sereus.
It is the precedent for porting a wyseman-style schema into Quereus constraints.

## Analysis tools

[../../tools/legacy/](../../tools/legacy/README.md) has the small scripts that produced the
statistics in [Findings.md](Findings.md) §2 and [data-2014.md](data-2014.md). They read the
local extract and print counts.
