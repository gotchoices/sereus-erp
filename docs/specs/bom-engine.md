# Parametric BOM engine

A shared library (`@wyatt/bom-engine`, [architecture.md](architecture.md) §11). It has no
storage, UI or network access of its own. It evaluates catalog definitions
([product.md](product.md)) and returns results. Everything else (order entry, purchasing,
runs, the storefront, cost reports, AI assistants) calls it.

## 1. Purpose

Given a family, its parameter values and a quantity, produce the **bill of materials** that
the family's definition implies, recursively and deterministically. Also produce its cost and
price where requested. This is the successor to ATI's `spread.tcl` and to wyselib's
`prod.bom()`, and the one piece of WyattERP that no off-the-shelf ERP provides.

## 2. Interface

```
explode(request, catalog, providers) → result
```

**Request**

| Field | Meaning |
|---|---|
| root | Family base + parameter values, or a part number. Either may carry a version (`.N`) |
| qty | Quantity of the root (default 1) |
| depth | `full`, `to_part`, `one_level` or `root_only` (§7) |
| pricing | `none`, `history`, `best`, `worst` or `provider` (§9) |
| version_policy | `current` (default), `draft` (engineering preview: use the draft of any family that has one) or `as_of` a timestamp |
| limits | Overrides of the default limits (§11) |

**Catalog** is a read-only, synchronous view of the catalog: families, versions, parameters,
lines, processes and parts. It is usually backed by the catalog strand, or by a snapshot for
tests and for the storefront. The engine reads nothing else.

**Providers** are optional, synchronous callbacks for data the engine does not own: unit
costs and labor costs (§9). Whatever they return is recorded in the result, so the explosion
can be reproduced without them.

**Result**: see §10.

The engine is synchronous from the caller's point of view, apart from loading the sandbox
once. It MUST also run in a browser, in Node and in React Native.

## 3. Algorithm

For a node (family F, version V, parameters P, quantity Q, path from the root):

1. **Resolve the version.** Use the requested `.N` if given. Otherwise apply the version
   policy, then record the version used.
2. **Bind parameters.**
   * Validate P against V's parameters: count, types, enum membership, min and max.
   * Normalize P to canonical form ([product.md](product.md) §2).
   * Apply defaults for missing trailing parameters.
   * Bind each parameter as a variable named after it (`W`, `H`…). Numbers are bound as
     numbers, and strings and enums as strings.
3. **Look up the part number** for (F, canonical P), if F's class is `part` or `custom`.
4. **Check for cycles.** If (F, P) is already on the path, fail with `cycle`.
5. **Decide whether to stop:** see §7. If the node is a leaf, emit it and return.
6. **Run the family script**, if V has one, once, in this node's scope. The variables it
   declares are visible to every line of this node.
7. **For each BOM line in `pos` order:**
   1. evaluate `when`. If it is falsy, drop the line;
   2. run `script`. If it calls `skip()`, drop the line;
   3. evaluate `qty`. If the result is 0, drop the line. It MUST be a finite, non-negative
      number;
   4. evaluate `child_params`, as one expression per child parameter;
   5. recurse on the child with quantity `qty × Q`, and record the line reference, the
      comment and the process.
8. **Price**, if requested (§9).
9. **Emit the node** with its children.

Lines are evaluated in order and independently. A line cannot see variables set by another
line's script; shared values belong in the family script. This differs from ATI, where one
interpreter per level let earlier lines' `set` leak into later ones. The corpus migration
(§12) must check for that dependency.

## 4. Scopes

Each node has its own scope, containing:
* the parameters;
* the family script's top-level declarations;
* the host API (§6).

Each field (`when`, `qty`, a child parameter, a line `script`) is evaluated **as a block**
(`{ … }`) inside that scope, so `let` and `const` inside a field stay local to it. A node's
scope is discarded when the node finishes. **Nothing leaks between nodes or between
explosions.**

## 5. Language and sandbox

* Expressions and scripts are **JavaScript**, executed in **QuickJS compiled to WebAssembly**
  (for example `quickjs-emscripten`). Decision: Q29. Lua or Tcl-in-wasm are the
  fallbacks if experience shows awkwardness.
* **A field is either an expression or a block of statements, with no marker needed.** Its
  result is the JavaScript completion value: the value of the last expression statement
  executed. This was verified in a trial port of real ATI scripts
  ([../legacy/bom-scripting-js.md](../legacy/bom-scripting-js.md)).
* Scripts are synchronous. The sandbox does not provide `async`, timers, promises, I/O,
  `Date`, `Math.random`, `eval` or `Function`. `Math` otherwise stays available.
* The sandbox has **no access to the host** except the host API (§6). It runs with a memory
  ceiling and an instruction budget (§11).
* One QuickJS runtime MAY be reused across explosions for speed, as long as every node gets a
  fresh scope (a new context, or an equivalent reset). Implementations MUST prove isolation
  with a test that tries to leak state between nodes.

## 6. Host API

Available in every scope. Names are reserved: parameter names must not use them.

| Function | Meaning |
|---|---|
| `skip()` | Drop the current line. Allowed only in a line `script`, `qty` or `child_params` |
| `error(msg)` | Abort the explosion with a user-facing message (replaces ATI `error`, `abort` and the `prompt`-as-error usage) |
| `warn(msg)` | Record a warning on the node, and continue |
| `band(x, table, msg?)` | Range lookup: `table` is `[[upper, value], …]`, sorted by upper bound. Returns the value of the first band with `x ≤ upper`. Calls `error(msg)` if `x` is above every band |
| `table(key, map, dflt?)` | Exact lookup in an object or `Map`. Returns `dflt` if given, otherwise calls `error` |
| `ceil(x, step=1)`, `floor(x, step=1)`, `round(x, step=1)` | Rounding to a step (for example `ceil(len, 0.5)`) |
| `clamp(x, lo, hi)` | |
| `conv(x, from, to)` | Unit conversion within a dimension, using the catalog's units |
| `part(base, ...params)` | Read-only attributes of an *approved part*: `{pnum, weight, dims, exists}`. Deterministic for a given catalog snapshot |
| `self` | `{base, ver, pnum, params, qty, depth}` of the current node |

ATI's `prompt` (asking the user in the middle of an explosion) is **not** supported. The engine
must be deterministic and non-interactive, and in the 2014 corpus `prompt` was used almost
entirely as an error message. Missing inputs are an error that the caller handles by asking
the user and retrying.

## 7. Depth

| Depth | A node is a leaf when… | Used by |
|---|---|---|
| `root_only` | always: no explosion | price lookups |
| `one_level` | it is not the root | awarding a labor-only bid, and runs ([purchasing.md](purchasing.md), [operations.md](operations.md)) |
| `to_part` | it is not the root **and** it has a part number | order entry for packages, purchasing rounds (ATI "1st Part") |
| `full` | it has no BOM lines | costing, engineering reports |

With `to_part`, a non-root node without a part number is exploded further, unless it is of
kind `part` and has no lines. Then it is an **unnumbered leaf**, reported as
`missing_part`. That configuration must be approved as a part before it can be ordered or
stocked. ATI asked the user interactively at this point. The engine reports it, and the caller
decides.

## 8. Numbers and rounding

* Evaluation uses JavaScript numbers (IEEE-754 doubles, which behave identically in QuickJS on
  every platform).
* At the boundary, each quantity is **rounded to 1e-9 relative precision** to remove float
  noise (so 0.1 + 0.2 becomes 0.3). It is then reported as an exact decimal string. The result
  stays fractional: rounding to stock units happens when operations instantiates the result
  ([operations.md](operations.md) §7).
* Parameters are compared in canonical form (§3, step 2). A computed child parameter is
  normalized before the part lookup, so `0.375000001` does not create a phantom partname.
  Numbers round to the parameter's declared precision (default 6 decimal places).

## 9. Cost and price

* **Cost roll-up** (when `pricing` ≠ `none`):
  * For a leaf: unit cost from the provider, by `history` (the average actual cost), `best`
    (the lowest active whole-part bid), `worst` (the highest) or a custom provider. A missing
    cost is a warning, valued at 0, and flagged.
  * For an exploded node: the sum of its children's extended costs **plus labor**. Labor comes
    from the provider: the best or worst labor-only bid, or the historical run cost per unit
    for the part. If there is none, it is computed from process times × labor rate, and
    flagged as an estimate.
* **Price:** the version's `price_formula`. It is evaluated after the cost roll-up, in the
  node's scope, with `cost` (the node's rolled-up unit cost) also bound. It can be a markup
  (`cost * 2.2`), a list price table, or a mix. A package price may be the sum of its
  children's prices plus an adjustment; `children` is bound for that.
* Every cost and price used is recorded in the result, with its source and date.

## 10. Result

A tree of nodes. Each node has:
* identity: base, version used, canonical parameters, partname, part number (if any);
* quantities: per parent unit and extended (the root quantity applied);
* where it came from: the line `pos`, the line comment and the process step;
* status: `ok`, `missing_part`, `missing_cost` or `error`;
* unit cost, extended cost and price with their sources, when pricing was requested;
* any warnings.

Plus a header:
* the request;
* **`engine_version`**, and the **catalog versions used**: a map from family to version;
* summary totals, and errors with their paths;
* **`hash`**: SHA-256 of a canonical serialization of the tree, excluding cost and price
  fields.

**Invariant (determinism):** the same request, catalog content (families at the versions used)
and engine version always produce the same tree and the same hash. This is what allows:
* **re-explosion with a diff** ([operations.md](operations.md) §8);
* the **PartVersion** interchangeability check ([product.md](product.md) §6);
* another peer **auditing** an instantiation by running it again.

Utilities shipped with the engine:
* `flatten(result, {by: 'part'|'leaf'})` gives a summed component list.
* `diff(a, b)` gives added, removed and changed components with their quantities.
* `traveler(result, catalog)` gives the per-process view, joined with notes for runs.

## 11. Limits and errors

Defaults: maximum depth 32 (ATI's deepest observed tree was 11 levels), maximum 20,000
nodes, 50 ms of interpreter time per field, 2 s per explosion, and 32 MB of sandbox memory.
Exceeding any of them is an `error`.

Errors are structured:
* kind: `syntax`, `runtime`, `user_error` (from `error()`), `param_invalid`,
  `unknown_family`, `cycle` or `limit`;
* the path from the root;
* the family, version and line;
* the field (`when`, `qty`…);
* the message;
* for syntax and runtime errors, a source excerpt.

The engine never throws for a data problem. It returns a result with `error` status, so
interfaces can show the path.

## 12. Migration of the ATI corpus

The 2014 `prd_spread` table (26,905 lines in 4,587 families, in the local, git-ignored
`data/ati-2014/`; see [../legacy/data-2014.md](../legacy/data-2014.md)) is the
**regression corpus**.

1. **Translator** (Tcl → JavaScript), mostly mechanical:
   * `$X` becomes `X`;
   * `expr` becomes the expression itself;
   * `if {...} skip` becomes a `when`;
   * `switch` becomes `table()`;
   * `if`/`elseif` range chains become `band()`;
   * `set X v` becomes `const X = v`;
   * `error` and `prompt` become `error()`.

   Scripts it cannot convert are listed for hand or AI conversion.
2. **Hoisting:** a lookup table repeated across a family's lines (125 scripts in 368 lines)
   moves into the family script. So does any variable that one line sets and a later line uses
   (the ATI scope leak, §3).
3. **Oracle:** a Tcl harness runs the original `spread.tcl` semantics over the same data
   (with no database and no GUI) for every 2014 part number that has a spreadsheet, and the
   results are compared node by node with the new engine. Acceptance: identical component
   sets and quantities within 1e-9, or a documented reason for each difference.

The corpus tests the engine. It does not become WyattERP product data.

## 13. Performance targets

* Explode a 500-node tree in under 100 ms on a mid-range laptop, browser included.
* Load the sandbox once per session, in under 300 ms.
* For a purchasing round over 1,000 parts with `to_part` depth: under 30 s.

Results MAY be memoized per (family, version, canonical parameters, depth) within one
explosion request. They are deterministic, so this is safe.
