# Product catalog

Owned by the **catalog** module ([architecture.md](architecture.md) §2).

## 1. Purpose

Describe a product line as a modest number of **parametric families**, so that a large number
of distinct configurations can be built from stocked standard components. Every possible
parameter combination has a name. Only deliberately approved combinations become stockable
**parts** with part numbers. **Packages** are configurations that are sold but never stocked.
Their parameters can take almost any acceptable combination, and they explode into parts when
ordered.

## 2. Entities

```
Unit ──< Family >── Class
            │
            ├──< Version ──< Parameter ──< AllowedValue
            │       ├──< BomLine
            │       ├──< Process ──< Note (by minor revision)
            │       ├──< MinorRevision
            │       └──< Document
            ├──< Part ──< PartVersion
            └──< StandardPackage
Operation ──< Process
```

### Unit
Unit of measure: `code` (`ea`, `m`, `m2`, `l`, `kg`, `ft`…), name, dimension (count,
length, area, volume, mass, time), `scale` (decimal places stored), and an optional
conversion factor to the dimension's base unit. Conversion between units of the same
dimension is exact through that factor.

### Class
A product category: a one-character `prefix`, name, and **kind**, which is one of:

| Kind | Meaning |
|---|---|
| `part` | Families whose approved combinations are stocked parts (raw material, purchased items, subassemblies, finished goods) |
| `package` | Sellable configurations, never stocked, exploded on ordering (ATI `@`) |
| `custom` | One-off engineered items for a specific order (ATI `K`). Parts, but expected to be used once |

Plus defaults for new families: storage and handling notes, and a default stock location type.
The prefixes are data, not code. ATI's set (a, b, c, e, h, i, o, s, u, z, @, K…) is one
possible seed. The startup defines its own.

### Family
* `base`: the unique name, `prefix:name`, matching `^[A-Za-z0-9@]:[A-Za-z0-9_]+$`. It is
  permanent once any version is released.
* class, unit (the unit its quantities are counted in), short description.
* `status`: `active`, `restricted` (no new orders or buys) or `obsolete`.
* `current_version`: the released version used when none is specified.
* `draft_version`: the version under development, if any.
* **Invariant:** at most one draft version exists, and it is numbered `current_version + 1`
  (pass-3 rule).

### Version
Identified by (family, `ver`), where `ver` is an integer ≥ 1.

| Field | Meaning |
|---|---|
| state | `draft` → `released` → `superseded` (a later version was released) or `retired` |
| released_at, released_by | set on release |
| interchangeable | Whether parts built to this version are **fully interchangeable** with the previous version (same form, fit and function). See §6 |
| change_summary | What changed and why |
| compat_notes | Consequences of mixing versions: which versions are fine for replacements, which are not for new installs, and so on |
| spec | Specification text (markdown) |
| family_script | Script run once per explosion node, before the lines ([engine.md](engine.md) §4) |
| price_formula | Expression giving the sell price of a configuration ([engine.md](engine.md) §9) |
| explode_default | Default depth for this family when exploded from an order: `to_part` for packages, `none` for parts |

**Invariants**
* A released version and everything that hangs off it (parameters, BOM lines, processes,
  documents) is immutable, **except** through minor revisions (§5).
* Release requires the `engineer`+`approver` role, a passing validation explosion (§8), and a
  set `interchangeable` flag.

### Parameter
Per version: `pos` (order in the partname), `var` (identifier; convention is one or two
uppercase letters, as in ATI), `type`, units (required for `num`), description, default,
and optional `min`/`max` for numbers.

| Type | Values |
|---|---|
| `num` | A decimal number, in the parameter's units |
| `str` | Free text (rare: prefer `enum`) |
| `enum` | One of the listed **AllowedValues**, each with a description (pass-3 `prod.sval`) |

**Canonical form.** Parameter values are normalized before they are compared or stored:
* numbers without trailing zeros, in the parameter's units;
* enum values as declared.

`b:nut(0.3750,16)` and `b:nut(.375,16)` are therefore the same partname.

### BomLine
Per version, ordered by `pos`:

| Field | Meaning |
|---|---|
| component | The child family's base |
| child_params | A list of expressions, one per child parameter in the child's order (pass 2 used `$S,$H,l` text substitution) |
| qty | Expression for the quantity **per one parent unit**, in the child's unit |
| when | Optional boolean expression. If it is false, the line does not apply (§7) |
| script | Optional script run before `qty` and `child_params` |
| process | Optional reference to the process step that consumes this component |
| child_version | Optional pin to a specific child version. Normally empty, meaning "current" |
| comment | Shown on BOM reports and travelers |

The language of expressions and scripts is defined in [engine.md](engine.md).

### Operation and Process (routing)
* **Operation:** a catalog of kinds of work: `code` and description (for example cut, burn,
  brake, weld, blast, paint, buff, mach, elect, assy, test, mat, out). ATI's 2013 list is a
  seed. Hydroponics will add plumbing, electronics assembly and test.
* **Process:** per version, a routing step: `idx`, operation, `next` step, setup time, labor
  time per unit, machine time per unit (each optionally an expression of the parameters),
  description.
* A version with no processes is bought or assembled in one undocumented step, as most of
  ATI's families were.

### Note (manufacturing and QC documentation)
Per process step: `seq`, `type` (`step` instruction, `fig` figure, `qc` acceptance
criterion), text (markdown), optional document reference, and for `qc` an optional
**measurement spec**: name, units, nominal, min and max, or pass/fail. Notes are versioned by
minor revision (§5).

### Document
Files attached to a version (drawings, CAD, datasheets, labels): kind, name, a content
reference, and the minor revision in which it was added or replaced.

### Part
An **approved parameter combination** of a family whose class kind is `part` or `custom`.

| Field | Meaning |
|---|---|
| pnum | Human part number. An integer, auto-allocated from a sequence, unique, never reused |
| family, params | The canonical parameter values. **Unique per family** (`prd_part` rule) |
| status | `proposed` → `active` → `restricted` → `obsolete` (ATI `elevel` gates, simplified) |
| stock policy | `min_level` (reorder point: ATI `buylev`), `target_level` (ATI `reclev`), `min_buy` (ATI `recbuy`). All optional, and set per stocking location in operations if needed |
| physical | weight, dimensions, stacking factor |
| tracking | `none`, `run` (lot = the run that built it) or `serial` (a serial number per unit within its run) |
| shelf_life | Optional, for perishables such as nutrients and media |
| comment | |

**Invariants**
* A part's family MUST be of kind `part` or `custom`. Packages never get part numbers.
* Creating a part requires the `engineer` or `approver` role. The engine never creates parts
  silently (Q20). An order-entry interface MAY offer "approve this combination" to a
  user who holds the role.
* Part numbers are not tied to versions: `1234` is `base(params)` in every version (§6).

### PartVersion (derived)
For each part and each released family version: the **explosion hash** (the hash of a
one-level explosion of that part under that version, [engine.md](engine.md) §10) and the
**effective interchangeability** with the previous version (§6). The system maintains it when
a version is released. It is not edited by hand.

### StandardPackage
A named, saved parameter set for a package family (ATI `prd_stdpkg`, 158 rows in 2014): name,
family, parameter values (which may leave some parameters open, to be filled at order time),
description. It is used for quick quoting and for the storefront.

## 3. Partnames and part numbers

| Form | Means |
|---|---|
| `a:chan(2400,4,w)` | The configuration, in the current version |
| `a:chan(2400,4,w).3` | The configuration as defined by family version 3 |
| `1234` | The part with that number, in the current version |
| `1234.3` | That part as defined by version 3 |
| `1234.0` / `….0` | **Version unknown or not tracked**: purchased commodity parts, legacy stock |

Parsing and formatting partnames are shared library functions ([architecture.md](architecture.md)
§11). How a missing version is interpreted depends on context:

* On **demand** (quotes, orders, packages, purchasing), a missing version means **the
  current version at the time the demand is instantiated**. Instantiation then records the
  version it used. It does not float afterwards.
* On **stock and moves**, the version is recorded as built (a run knows its version) or
  received (`.0` unless the supplier's revision is tracked). Stock never changes identity when
  a new version is released.

## 4. Versions: life cycle

1. **Create draft.** The draft starts as a copy of the current version, as `current + 1`.
   Only one draft may exist.
2. **Edit draft** freely: parameters, lines, routing, notes, spec.
3. **Validate.** The engine explodes a sample set: every active part of the family, every
   standard package, and any test cases stored with the family. Failures block release.
   Differences from the current version are shown per part: added, removed or changed
   components and quantities.
4. **Release.** Set `interchangeable`, the change summary and the compatibility notes. The draft
   becomes `released` and is now immutable. The previous version becomes `superseded`.
   `current_version` moves forward. PartVersion rows are computed.
5. **Retire** (rare). A retired version can no longer be chosen for new demand. Existing
   records that reference it stay valid.

ATI: pass 2 edited families in place, and `revision`/`minrev` were labels with no history.
Pass 3 introduced the draft/current pair. This spec keeps that model.

## 5. Minor revisions

The owner's question: may I change manufacturing notes or add QC criteria without a new version? **Yes.**

* **Version** changes (`.N`) cover what the product **is**: parameters, BOM lines and
  formulas, spec, routing that changes the result.
* **Minor revisions** cover how it is **made and checked**: notes, figures, work instructions,
  QC criteria, documents, typo fixes. They also cover adding or changing process *times*.
* A released version starts at minor revision 0. Saving any change to its notes, QC criteria,
  documents or process times **creates the next minor revision automatically**, recorded with
  who, when and a summary. Nobody has to manage the numbers.
* Notes and documents are stored with the range of minor revisions in which they are valid, so
  the full text as of any minor revision can be reconstructed.
* **Runs record the version and minor revision** they were built and inspected under (for
  example "R27-014 built 1234.3 under notes 3.5"). That is the per-run manufacturing and QC
  record ([operations.md](operations.md) §9).
* Minor revisions never change part identity, demand, interchangeability or explosion results.
* Judgment call: when a new QC criterion really changes what is acceptable as the product,
  release a new version instead. The default is a minor revision.

## 6. Interchangeability

Each version declares `interchangeable` with its predecessor. For each part, the **effective**
interchangeability of version N with N−1 is:

* **true** if the version declares it; otherwise
* **true** if the part's explosion hash is the same under both versions (the change did not
  touch this configuration, for example an option line it does not use); otherwise
* **false**.

Consequences in operations:
* Stock and supply of interchangeable consecutive versions are **netted together** in
  planning. Demand for `1234.3` can be filled from `1234.2` stock when 2→3 is
  interchangeable.
* Non-interchangeable versions are planned as **separate stock**, as if they were different
  parts, while keeping the part number. Demand for `.3` is filled only by `.3`, or by a later
  version that is interchangeable with `.3`.
* `.0` stock (version unknown) fills demand for any version, with a warning, unless the
  family is marked `version_strict` (an optional flag for serialized or safety-relevant
  families).

This replaces the question of when a change needs a new part number: it never strictly does.
An approver MAY still create a new family or part when the product has really changed
identity.

## 7. Options and guards

Options are expressed in the BOM, not as a variant matrix:
* `when` on a line gives a declarative condition (the common case: 3,374 of ATI's 4,138
  scripts were guards). Interfaces SHOULD show it ("applies when R = mr"), and a configurator
  MAY use it to tell which parameters influence which lines.
* A quantity that evaluates to 0 drops the line.
* `skip()` in a script drops the line for complex conditions.

## 8. Validation rules (on save and on release)

* Every line's `component` refers to an existing family, and the child parameter list has the
  child family's parameter count (checked against the version that would be used).
* Parameter names are unique within a version and do not collide with reserved names
  ([engine.md](engine.md) §6).
* No family can reach itself through its lines with the same parameters. The engine detects
  cycles at run time. Static checks warn about family-level cycles.
* Release validation explosions all succeed.

## 9. Roles

| Transition | Role |
|---|---|
| Create or edit a family draft | `engineer` |
| Release or retire a version | `approver` (not the same person as the last editor, when there are enough people. **Open:** enforce or only warn) |
| Edit notes, QC and documents (minor revision) | `engineer`, or `shop_lead` for notes |
| Create, approve or retire a part; set stock policy | `engineer`/`approver`; stock policy also `buyer` |
| Edit units, classes and operations | `admin` |

## 10. ATI migration

* Family, parameter, part and spreadsheet data from the 2014 dump
  (`data/ati-2014/`) serve as the test corpus, not as production data. Each ATI family
  becomes version 1. `revision`/`minrev` go into the change summary.
* ATI `prd_spread.oper` (4,102 lines) maps to `BomLine.process`. `prd_base_oper` maps to
  processes, with times empty, as they were in ATI.
