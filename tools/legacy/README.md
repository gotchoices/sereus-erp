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
| `comp.mjs` | Checks that JavaScript completion values give "expression or block" fields (Node `vm`; not a sandbox) | `node tools/legacy/comp.mjs` |

Files are latin-1. The engine prototype will need a TypeScript equivalent of `pgcopy.py` to load
the corpus.
