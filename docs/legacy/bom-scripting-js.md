# BOM scripting in JavaScript: a trial against the real ATI corpus

This answers Q29: is JavaScript awkward for BOM scripts, and can one field hold either an
expression or a code block? I ported examples taken from `old/ati/src/dbm/work/prd_spread.sql`
(the "2000 snapshot": a `COPY` dump of the `prd_spread` table, file dated July 19, 2000; the
2014 production dump has a newer copy in the local, git-ignored `data/ati-2014/`; see [data-2014.md](data-2014.md)) and ran them in Node's `vm` module to check the semantics. Node's `vm` is
*not* a sandbox, but QuickJS follows the same ECMAScript rules. The test script is
[tools/legacy/comp.mjs](../../tools/legacy/comp.mjs).

## What the corpus actually contains

| Measure (2000 snapshot) | Count |
|---|---|
| Families with spreadsheets | 1,230 |
| Spreadsheet lines | 6,209 |
| Lines whose quantity is not a constant | 1,321 (21%) |
| Lines whose child parameters use variables | 454 |
| Lines with a script | 814 (13%) |
| …containing `if` | 727 |
| …calling `skip` | 563 (69% of scripts) |
| …setting variables | 204 |
| …using `switch` lookup tables | 79 |
| …calling `prompt` | 25, almost all used as an error message ("Invalid boom length entered") |

The **2014 production copy** (`data/ati-2014/pgdata-2014-Jan-03/prd_spread.d`) is about four times
larger, with the same profile:
* 26,905 lines in 4,587 families;
* 4,138 scripts, of which 3,374 use `skip`, 394 `switch`, 339 `prompt`, 242 `error`, 208
  loops, and only 3 `proc`;
* 6,733 formula quantities and 1,568 parameterized child parameters;
* 125 long scripts copied into 368 lines.

That 2014 table is the regression corpus for the engine.

So in practice scripts do four things:
1. **Option guards** (`if {$R != "mr"} skip`). This is by far the most common.
2. **Lookup tables** that map one parameter to derived values (lanes → pipe diameter).
3. **Validation** (`error "Invalid number of lanes!"`, or `prompt` used as an error).
4. **Derived variables** for the quantity and child-parameter fields (hose lengths from valve
   count).

Another finding: the same 15-branch lookup table in `@:dcu_r` is **copied verbatim into lines 22,
23 and 24**, because pass 2 had no family-level script. A family-level script that derives
variables once, before any line is evaluated, would remove that duplication. wyselib `prod`
was heading toward this with per-version `sval` values.

## Expression or block: one field handles both

JavaScript defines a *completion value*: the value of the last expression statement that ran.
QuickJS's `evalCode`, like `eval`, returns it, just as Tcl returns the result of the last
command. If the engine wraps each field in a block, `{ <field>\n }`:
* a plain expression works as is: `(W * H) / 7200` → `0.24`;
* a multi-statement script also works, and its last expression is the result;
* `let` and `const` stay local to that field.

There is no need to mark which kind a field is.

Verified results:

```
{"W":36,"H":48}  (W * H) / 7200                                   => 0.24
{"Z":4}          if (Z != 6) skip(); 1                            => SKIPPED
{"Z":6}          if (Z != 6) skip(); 1                            => 1
{"L":15}         if (L === 11) 12; else if (L === 15 || L === 20) 16;
                 else throw new Error('Invalid boom length')      => 16
{"M":7}          const Q = {1:5,2:5,…,12:25}[M]; Q ?? skip()      => 15
{"L":2}          let D; if (L<=1) D=3; else if (L<=2) D=4; else D=5; D*2   => 8
```

`skip()` is implemented by throwing a private sentinel that the engine catches, so it works at
any depth, inside a helper function too, just as in Tcl.

## Side by side

**Option guard**
```tcl
if {$R != "mr"} skip
```
```js
if (R != "mr") skip()
```
Or, with the proposed `when` column on the BOM line, the guard needs no script at all. `when` is
**not JavaScript syntax**. It is a field of the line, like quantity, and its contents are a
JavaScript boolean expression, here `R == "mr"`. The engine evaluates it first: if it is
false, the line is dropped and nothing else on the line is evaluated, and if it is empty, it
counts as true. The order per line is: `when`, then the script, then the quantity and child
parameters.

**Area-based quantity**: identical apart from the `$` signs.
```
($W * $H) / 7200              (W * H) / 7200
```

**Lookup table** (`a:cnts` line 38, quantity of conduit by M):
```tcl
switch $M { 1 {set Q 5} 2 {set Q 5} ... 12 {set Q 25} default {skip} }
```
```js
({1:5, 2:5, 3:5, 4:10, 5:10, 6:10, 7:15, 8:15, 9:15, 10:20, 11:25, 12:25})[M] ?? skip()
```

**Range bands** (`@:dcu_r`, lanes → diameter): 45 lines of Tcl `elseif`, written once as a
family-level script with a small `band()` helper provided by the engine:
```js
// family script: runs once, and its variables are visible to every line
const D = band(L, [[1,3],[2,4],[4,5],[5,6],[7,7],[10,8],[12,9],[15,10],[18,11],
                   [21,12],[24,13],[28,14],[32,15],[36,16]], "Invalid number of lanes");
const G = L <= 28 ? 26 : 24;
```

**Derived variables** (`a:mc90_pb`, hose lengths):
```js
if (!["d","s"].includes(PB) || !["A","B"].includes(PT)) error("Invalid variable entered");
const FH = PB == "d" ? (V == 2 ? 0.00134 : 0.00067) : 0;
const FI = PB == "d" ? (V == 1 ? 2 : V == 2 ? 1 : 0) : 0;
const HB = V * 0.00634 + FH;   // blue hose
const HG = V * 0.00667 + FH;   // green hose
```
This is shorter than the Tcl, because the Tcl had to pre-declare everything with
`set X [int 0]`.

**Child parameters.** Pass 2 used Tcl `subst` on `$S,$H,l`. In JavaScript, a child-parameter
field is either a template string (`` `${S},${H},l` ``) or, more cleanly, a list of expressions,
one per child parameter: `[S, H, "l"]`. The engine knows the child family's parameter list, so
the list form also lets it validate the count and the types.

## Where JavaScript is awkward, and the fixes

| Awkwardness | Fix |
|---|---|
| `==` vs `===` coercion surprises (`"6" == 6`) | Parameters arrive already typed (num/str from the family definition), so `==` behaves predictably. Optionally lint for `===` |
| Floating-point money and quantities (`0.1 + 0.2`) | Round at the engine boundary to each unit's precision. Provide `ceil(x, step)` and `round(x, step)` helpers for buying in increments |
| No `switch` *expression* | Object-literal lookup with `?? skip()`, or the `band()` and `table()` helpers |
| `$`-less variables can collide with helper names | Parameters are single uppercase letters by ATI convention, and helpers are lowercase. Reserve a small set of names |
| Engineers may reach for `async`, `Date` or `fetch` | Not present in the sandbox. QuickJS exposes only what the host injects |

## Alternatives to `skip` (EC on Findings §4)

Three mechanisms, which can be used together:
1. **A declarative `when` field per line.** Most of the 563 skips are a simple guard. Making the
   guard a column means it can be read, indexed and shown in the UI ("this line applies when
   R = mr") without reading the script. This is the cleanest option for the common case.
2. **Quantity 0 drops the line.** The engine filters out zero-quantity results, so
   `Z == 6 ? 1 : 0` works. Caveat: the child-parameter expression is still evaluated and must
   not fail for the skipped case. That is why `when` (evaluated first) is better for structural
   options.
3. **`skip()` in scripts** stays for the complex cases.

## Assessment

JavaScript is not awkward for this corpus. Most lines get slightly shorter, lookup tables get
much shorter, and expressions and blocks need no special syntax. The main risks are numeric
precision and coercion, and both are handled at the engine boundary. Next steps when the engine
spec starts:
* test QuickJS-wasm itself (start-up cost per context, speed on a deep explosion);
* write an automatic Tcl→JS translator for the corpus to see how much of it converts
  mechanically. Most of it should: guards, `switch` and `expr`.
