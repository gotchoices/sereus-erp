# Legacy analysis tools

Small, throwaway scripts used to study the 2014 ATI extract ([../../docs/legacy/data-2014.md](../../docs/legacy/data-2014.md)).
They contain no ATI data. They read the local, git-ignored `data/ati-2014/pgdata-2014-Jan-03/`
directory and print statistics.

| Script | Purpose | Run |
|---|---|---|
| `pgcopy.py` | Iterates the rows of a `pg_dump` `COPY … FROM stdin` data file (`<table>.d`) as dicts keyed by column name | library |
| `analyze.py` | Product-side statistics: families, parameters, parts, BOM lines and script keywords, BOM depth, duplicated scripts, routing | `python3 tools/legacy/analyze.py data/ati-2014/pgdata-2014-Jan-03` |
| `analyze2.py` | MTR ledger by type, status and year; bids by kind and age | same argument (reads all of `mtr_reg.d`, 517 MB: about a minute) |
| `parse_spread.py` | Statistics for the 2000 `prd_spread.sql` snapshot; `show` prints sample scripts | `python3 tools/legacy/parse_spread.py <devel>/old/ati/src/dbm/work/prd_spread.sql [show]` |
| `ati-catalog.ts` | Loads the product tables into a WyattERP catalog through `CatalogModel` (mapping below) | library; run by `yarn import:ati` in `apps/web` |
| `comp.mjs` | Checks that JavaScript completion values give "expression or block" fields (Node `vm`; not a sandbox) | `node tools/legacy/comp.mjs` |

Files are latin-1. `ati-catalog.ts` has a TypeScript port of `pgcopy.py` (`copyRows`), for the
engine prototype too.

## The catalog import (`ati-catalog.ts`)

A browse and volume test, never working data (STATUS.md C3). From `apps/web`:

```bash
yarn import:ati --memory [--only a:,b:]   # dry run in memory; writes data/ati-import-report-memory.json
yarn import:ati [--only a:,b:]            # into the node folder data/wyatt-ati/ (git-ignored)
yarn import:ati --sample 5                # each class's 5 richest families and what they use (about an hour)
yarn import:ati --home data/other …       # into another node folder
yarn dev:ati                              # the app on that node, port 5175, labeled "ATI 2014 test data"
```

`--only` takes base prefixes and adds every family they use. `--sample N` is the browsing set:
from each class the N active families richest in BOM lines, routing, parameters, parts and
documents, plus what they use (a family that would pull in more than 40 is passed over). To
replace the data under a running `dev:ati`, import with `--home` into a new folder, swap the
folders, and restart the server. Re-running skips what is there;
delete `data/wyatt-ati/` to start over. The report lists counts and each kind of problem with
examples. It stays in `data/` because the examples are ATI part names.

How ATI maps to the catalog:

| ATI | Catalog |
|---|---|
| `prd_base.units`, `prd_parm.units` (40 spellings) | A few unit codes: `pc.`, `.pc`, `pc`, `p`, `na`, empty → `ea`; `ft.`, `lnft.` → `ft`; `in.` → `in`; `gal.`, `qt.`, `lbs.`, `sqft.` and so on with exact factors. A unit with none of the catalog's six dimensions (V, A, AWG, tpi, ga., deg., ohms) comes in as a `count` unit and is reported |
| class letter (first character of the base) | A class, named from docs/legacy/ati-mfg-model.md; `@` package, `K` custom, the rest part |
| `prd_oper`, plus operations named only in lines or routing | Operations |
| `prd_base` | A family: description, spec, price formula (as written). Status `o` → obsolete, `d` → restricted, `p` and `c` → active. `revision` and `minrev` are not kept |
| `prd_parm` | Parameters in order. `num` keeps its unit (`ea` when it had none); `str` and `eng` become text (eng values such as `4k7` are not plain numbers), with the unit added to the description |
| `prd_base_oper` | Routing, renumbered 1… in sequence, `nxt` mapped |
| `prd_spread` | BOM lines. `cparm` split on top-level commas; `quant`, `cparm` and `script` kept as written (Tcl, which the engine does not run yet); `oper` → the routing step for that operation, added if the family had none |
| release | Version 1, children first. A family stays a draft when a child is not released, a line's child-parameter count is wrong, or it is in a cycle |
| `prd_part` | A part of a released family, with ATI's part number. `elevel` −1 → obsolete, 1 → proposed, else active; `buylev`, `reclev`, `recbuy` (0 → none) → min, target, min buy; size, weight, stack, comment |
| `prd_stdpkg` | Standard packages, named by `parm_descr` |

Not imported: prices and costs, cached inventory figures (`prd_part_inv`), bids, POs, MTR,
documents.
