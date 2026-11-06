# Index of `old/ati`

Built from a read-only survey of the tree. Dates are file modification times. Tags:
**MFG** = products/BOM/inventory/orders/purchasing/shipping/shop/CAM, **ACCT** = GL/AP/AR/payroll,
**CRM**, **DOC**, **MISC**. ⚠ = probably contains personal or sensitive data (not read).

## Top level

| Path | Era | Tag | Contents |
|---|---|---|---|
| `acc/` | 1995–2002 | MFG/ACCT ⚠ | Flat-file records from the pass-0 era: orders, POs (377), manufacturing orders `mo/`, RAs (969), billing, bid archives, sales/GSA analysis `anl/`, registers `reg/`, withholding `wth/`. Parsed by the pass-0 C tools. `keys` and `reg/`/`wth/` flagged sensitive |
| `acp/` | 1994–97 | MISC | Lease, rent and impound forms in `fm` format (looks like a separate property business) |
| `doc/` | 1998–2013 | DOC | Document corpus: `mnt/` (1109 assembly/install docs, .tex), `snt/` shipping notes, `spc/` specs, `int/` internal engineering, `opr/` procedures, `fig/` tgif drawings (assy, eng, inst, burn, lathe, mill), `mtg/`, `tpt/` templates, `man/` |
| `grab.old`, `grab.src` | 2014 | MISC | rsync scripts that pulled this tree from host `tao` |
| `lst/` | 1997–2004 | CRM ⚠ | Mailing and contact lists |
| `man/` | 2000–2013 | DOC | nroff man pages, HTML ERP manuals, employee handbooks, DocBook webhelp |
| `prd/` | 1998–2005 | MFG | Pass-0 product data: `spd/` (451 spreadsheets/BOMs), `vnd/` (221 vendor price files), `invent.lst`, price lists, product artwork, PCB, firmware |
| `rad/` | 2000–2012 | MISC | R&D for electronic products: firmware (552/6805 asm), Eagle PCBs, SmartRange software |
| `src/` | 1990–2014 | — | All source code (see below) |

## `src/`

| Path | Tag | Contents |
|---|---|---|
| `README` | — | History of pass 0, pass 1 and pass 2 |
| `cmds/` | MISC | Office shell utilities |
| `cnc/` | MFG | C programs for the burn tables: `burnd` (Koike D-11 serial daemon), `watops`/`wmtops` (G-code to PostScript), `dxftom4`. Mostly replaced by bedit/camque |
| `fm/`, `mfm/` | DOC | Text formatters (fm was used in production; mfm was never deployed) |
| `pass0/` | MFG/ACCT | 1990–99 console C ERP. `manuf/` (mo, pullmo, donemo, **spread**, price, vndsel), `bidreq/` (vendor bid requests), `billing/`, `po/`, `invadj/`, `manif/`, `ra/`, `acanal/`, `whold/`, `libati/` |
| `dbm/` | all | **Pass-2 schema** (`*.sch`) and build scripts (see [ati-framework.md](ati-framework.md)). Subdirs: `pass0/`, `pass1/` (earlier schemas), `convert/` (migration scripts ⚠ contains table dumps), `work/` (fix scripts, plus **`prd_spread.sql`**, a July 2000 dump of the BOM spreadsheets), `wyseman/` (first wyseman prototype), `merrill/`, `test/`, `tmppga/` |
| `tcl/` | all | **Pass-2 applications** (table below) |

## Pass-2 Tcl applications (`src/tcl/`)

| App | Main files | Purpose |
|---|---|---|
| `lib/` | dbe, dbp, dbs, mpg, priv, **spread.tcl**, pdoc, cal, dia… | Shared framework, which later became wylib |
| **prodim** | `prodim`, `invman.tcl`, `prodim.man` | Product families, parameters, parts, spreadsheets, documents. `invman` handles cycle counts (`ad`/`bf` MTRs) |
| **ord** | `ordtool`, `inventory.tcl`, `custinv.tcl`, `deplink.tcl`, `ordrpt.tcl`, `ship.tcl`, `deplog` | Bids, orders, RMAs and requisitions. Package explosion, commit to MTRs, invoicing, deposits, shipping, sales reports |
| **potool** | `potool`, **`purchase.tcl`**, `bids.tcl`, `rectool.tcl`, `wmclose.tcl`, `apinv.tcl`, `sched.tcl`, `porpt.tcl`, `purchase.man` | Single POs. The **purchasing round** (purchase/award/make PO). Receiving, closing material issues, AP invoice matching, experimental schedule view |
| **vendim** | `vendim`, `vendbid` (+ .man) | Vendor and contact manager. `vendbid` is the **vendor-facing bid entry** program ("Vendor Access Program") |
| **shopman** | `shopman` (+ .sgml) | In-house shop view of work orders and material MTRs |
| conim | `conim`, cgroup, cservice, dataport | Customer/contact CRM and sales-territory ownership |
| appay | payroll, payreq, timecard, whold_*, apcheck | Payroll, time, AP checks ⚠ |
| emplim | `emplim` | Employee manager ⚠ |
| glman | `glman`, `mdep.tcl` | Accounting codes and GL |
| opr | requis, invwin, bankrec, ceedit, gledit, projman, privedit, maillog | Mixed operations tools: requisitions, bank rec, capital equipment, privileges |
| bedit | `bedit`, `cam/camd`, `cam/camfetch`, `koike.tcl`, `burny.tcl` | **CAM**: parametric burn-table shape editor, G-code drivers, CAM job queue (`cam.sch`) |
| noedit | `noedit`, `etw*.tcl` | Structured product-notes editor (figures, tables, BOM, QC checks), rendered with lout |
| vmail | `vmail.tcl`, `pmail.tcl` | Process vendor e-mail; patent fetcher |
| iteld, c, misc | | Phone-system daemon, C helpers, assorted utilities |
| old/ | ap, payroll, persim, pim, ledit*, projman, wylib-0.10/0.20, wyseman | Retired pass-1 apps and early library snapshots |

## Schema files (`src/dbm/*.sch`)

**Manufacturing core** (covered in depth in [ati-mfg-model.md](ati-mfg-model.md)): `prd`, `prd_bom`,
`prd_doc`, `prd_mtr`, `mtr`, `mtr_cost`, `mtr_stress`, `ord`, `ord_mtr`, `po`, `po_mtr`, `po_purch`,
`vend`, `vend_price`, `vend_doc`, `ship`, `ship_mtr`, `cam`, `proj`.

**Accounting**: `acc` (chart of accounts), `gl`, `glviews`, `ap`, `ap_mtr`, `appay`, `cinv`
(customer invoices), `inc` (deposits), `exp`, `checkreg`, `cape` (capital equipment), `other`
(bank, credit log), `pay`, `empl_whold`.

**People/CRM**: `empl` (also holds `priv`), `empl_doc`, `cont`, `cont_doc`, `cont_group`,
`cont_serv`, `pers`, `pers_doc`, `oldcont`, `promo`.

**Utility**: `misc`, `compat`.

## Related projects

| Path | What it is |
|---|---|
| `old/wyseman` | Schema manager that grew out of `dbm/`. Tcl-syntax `.wms`/`.wmt`/`.wmd`/`.wmi` files, object-level dependencies, data dictionary. Ruby gem 0.5 (2017) plus a small JS API |
| `old/wyseman-0` | Near-identical snapshot that also contains the built gem |
| `old/wylib` | Tcl/Tk widget library (third generation of `tcl/lib`), v0.35 (2018) |
| `old/wyselib` | Standard ERP schema library for wyseman: base (entity, address, priv), empl, acct (accounts, projects, close), **prod** (versioned parametric products, operations, BOM evaluated in the DB with PL/Tcl), cust, asset, payroll. See [ati-framework.md](ati-framework.md) §4 |

## Sensitive material flagged (not read)

`acc/reg`, `acc/wth`, `acc/keys`, `lst/`, `src/dbm/convert/{pay,pay1,pers,cont}`, and the `emplim`/`appay`
data. One `src/tcl/misc/xmail` script contains a hard-coded password string. Scrub all of these
before the tree is shared or moved into a repository.
