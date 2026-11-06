# ATI framework: dbm, the Tcl app library, and their descendants

## 1. dbm: the schema system (`old/ati/src/dbm`)

* A `.sch` file is plain SQL with section markers inside comments: `--DT:`/`--CT:` drop/create
  tables, `I` indexes, `S` sequences, `V` views, `F` functions and triggers.
* The free-form header must contain a `Dependencies: a b c` line naming the other schema files
  that must be built first.
* Files are run through `m4 -P` for macros. For example, `prd.sch` uses an `X(...)` macro to
  generate a set of status-filtered views with their rules.
* `mkfile <sys> <act> <db>` runs `cat sys.sch | m4 -P | mkscan -v m=<regex> | psql db`. The
  `<regex>` picks which sections run, for example `DV` then `CV` to rebuild only the views or
  only the functions of a module on a live database without touching its tables.
* `depord` gives a topological order of the schema files. `listdeps` prints the dependency tree.
* `mkdb` builds a database in three steps: create objects in dependency order, load the
  `tmpdata` dumps (checking row counts), then build indexes and sequences. `mkdump` writes those
  dumps.
* Changing a table is a manual process: dump, drop, rebuild, reload.
* `convert/` holds one-off migration scripts from the pass-1 to pass-2 port. `dbm/wyseman/` is the
  first wyseman prototype, which stored the schema in relational tables.

## 2. The Tcl app framework (`old/ati/src/tcl/lib`)

* **mpg**: wrapper around pgtcl. `mpg::exec q -trans`, `mpg::one q` (exactly one row, otherwise
  an error), `mpg::qlist q`, and quoting helpers. Queries are built by string interpolation.
* **dbe**: record editor pane. **dbp**: preview/list pane. **dbs/dbsrch**: search and "loadby".
* An app is a set of declarative configuration lists. From `potool/purchase.tcl`:

  ```tcl
  -table mtr_reg_v_pt -pkey {{ropnum inum minum bminum} ...}
  -b {delrec {UnPurchase} -pre {priv::usercheck user -priv purchase} ...}
  -f {pnum  ent 5  {Part:} -s 0 -ro 1 -spf scm -data {-eval {mpg::qlist "..."}}}
  -f {pname inf 20 {:}     -fdep pnum -field part_name(%pnum)}
  ```

  Field types are `ent`, `inf` and `inv`. Field switches: `-s` line number, `-ro` read-only, `-spf`
  popup (calendar, calculator, editor, selector), `-fdep`/`-field` (field computed by SQL).
  Buttons take `-pre`/`-pst` hooks, and that is where app business logic attaches.
* **priv**: `priv::haspriv` calls the SQL function `priv_has()`, `usercheck` and `runcheck`
  enforce privileges, and `priv::alarm` e-mails supervisors about unusual events. This
  "alarm" pattern is used throughout ordtool and purchase.
* **Views with INSTEAD rules as the security and business-rule layer.** Apps write to views,
  not tables. Each view is granted to a role, and its rules allow only certain transitions.
  For example, `po_items_v_rec` lets receiving change only `open → clsd`. `ap.sch` has 26 such
  rules, `po_mtr.sch` 15, `pay.sch` 13 and `prd.sch` 12.

## 3. Descendants

* **wyseman** (GPL, 2005 onward; Ruby gem 0.5 in 2017):
  * Schema files are written in Tcl syntax: `.wms` holds objects (`table name {deps} {sql}
    -grant …`, with dependencies declared per object), `.wmt` the data dictionary (titles and
    help text for tables and columns), `.wmd` display defaults, and `.wmi` initial data.
  * Objects are stored in `wm.objects` and dependencies are resolved by a recursive view, so
    any branch can be dropped and rebuilt with automatic dump and restore.
  * It has release numbering and language-tagged text tables. Table migrations remained a TODO.
* **wylib**: the Tcl/Tk widget library (dbe/dbp/dbs, dew/mdew, sql.tcl, document editor), v0.35
  in 2018, which then merged with a JavaScript source. The later JS/Vue wylib, used by MyCHIPs,
  is not in this tree.
* **wyselib**: the reusable ERP schemas for wyseman.

## 4. `wyselib/schema/prod`: the unfinished pass-3 product model

This is the most relevant precursor to any new implementation. It **fixes several pass-2
weaknesses**:

| Pass 2 (ATI) | wyselib `prod` |
|---|---|
| `prd_base` with one `revision` integer | `prod.prod` family plus **`prod.vers`** (base, rev), with a current version and at most one development version (`curr`/`maxv`), and `prod.minr` minor-revision notes |
| `prd_parm` | `prod.parm` **per version**, with units FK, default value, and `prod.sval` enumerations for string parameters |
| `prd_spread` flat line list | **`prod.oper`/`prod.proc`** operations (routing steps) with BOM lines (`prod.boms`) attached to process steps, and `prod.note` work instructions per step |
| BOM evaluated in client Tcl (`spread.tcl`) | **BOM evaluated in the database** with PL/Tcl (`prod.bom()`, `bom_init/ex/ev/su/sp`) in a safe interpreter, with `skip`/`end`. Results are cached per part number in **`prod.bomc`** |
| `prd_doc` | `prod.doc` + `doc.doc` with checkout and checkin |

The README sketches a nested BOM DSL (`oper assembly { part 1 o:decal(top); oper 1 paint { … } }`).
TODOs that were never finished include packages, "systems", and an expanded BOM view. wyselib has
**no** inventory, MTR, order, vendor or purchasing schemas; those exist only in ATI pass 2.
