# Engineering documentation

**Status: exploration (November 2026).** Nothing here is decided. It gathers what ATI did, what
WyattERP has today, and a proposed direction, so the owner can decide and the specs can follow.
Questions for the owner are Q38–Q44 in [legacy/Questions.md](legacy/Questions.md) §G. When
parts of this are adopted, the rules move into a domain spec (probably
`design/specs/domain/documentation.md`, with product.md §2 linking to it), the reasoning into
[Design.md](Design.md), and the decisions into the log in [STATUS.md](STATUS.md).

"Engineering documentation" here means everything that explains how a product is made, checked,
shipped, installed and used: notes, QC criteria, figures, drawings, and machine programs
(CAM, 3D printing). It is parametric for the same reason the BOM is: one family definition
must document every configuration.

## 1. Where things stand

**ATI** ([legacy/ati-engineering-docs.md](legacy/ati-engineering-docs.md)) had a mature system:
* documents per family, in classes for assembly, installation, shipping, owner's manual and
  sales;
* a structured notes editor (noedit) with sections, QC checks, figures, tables,
  cross-references, includes, and **live blocks**: part summary and BOM;
* notes printed **per part and per job**, with PO item, quantity and due date;
* **parametric burn programs**: m4 programs whose dimensions defaulted but were overridden by
  the part's parameter values (708 of about 860 programs), with one header per plasma table
  translating generic operations into that machine's G-codes.

**WyattERP today** (product.md §2, `catalog.qsql`, the draft editor in the web app):
* `Document` per family version: kind, name, `ContentRef`. It is valid over a range of minor
  revisions, so history is kept. `ContentRef` is a free-text link: **nothing stores files**.
* `Note` per routing step: `step`, `fig` (with an optional document) or `qc`, with a markdown
  body. A QC note can carry a measurement spec (nominal, min, max, or pass/fail).
* Notes, QC, documents and process times change through automatic minor revisions. Runs pin
  the notes revision ([operations.md](../design/specs/domain/operations.md) §9).
* `traveler()` is specified in the engine ([bom-engine.md](../design/specs/domain/bom-engine.md)
  §10) but not built, and nothing renders or prints.

**The gaps that change the model**, not only the UI:
1. Notes can hang only on routing steps, so installation, operation and shipping documentation
   has no home.
2. Nothing in notes or documents uses parameter values. QC limits are fixed numbers, although
   process times are already expressions of the parameters.
3. There is no file storage.

## 2. Principles

1. **One source of numbers.** Every value a document shows comes from the family's parameters
   and family script, evaluated by the BOM engine in the node's scope. Documents never keep
   their own copy of a dimension. A CAD model receives values. It does not originate any that
   the BOM also needs.
2. **Write per family, render per configuration.** Authors write once for the family. Output
   (packet, manual, drawing, program) is produced for a specific configuration, and for a job
   when there is one.
3. **Versioned like the rest of the catalog.** What defines the product changes by version.
   How it is made, checked and explained changes by minor revision (product.md §5). Output for
   a run is fixed when the run is released.
4. **Text and numbers render anywhere, offline.** Anything that needs only the catalog and the
   engine renders in the browser, on any device, without a server. Only geometry (CAD and CAM)
   needs a generator machine (§6).
5. **The cheapest output that does the job.** Values in text before tabulated drawings,
   tabulated drawings before generated drawings, DXF for the shop's own CAM before generated
   toolpaths.

## 3. Proposed model

### 3.1 Manuals: documentation beyond the shop

Keep ATI's classes, as **manuals** of a family version:

| Manual | Anchored to | Audience | Output |
|---|---|---|---|
| `build` | routing steps (as notes are today) | shop, contract shops | traveler / run packet |
| `install` | sections | installer, DIY customer | installation guide |
| `operate` | sections | customer | owner's manual |
| `ship` | sections | shipping | packing and shipping instructions |

`build` is today's model unchanged. The others are ordered, titled sections with notes in them.
The same note types apply in all of them. A QC check in an installation manual is a
commissioning check.

**Manuals compose through the explosion.** A package (a customer's hydroponic system) has no
routing, but it has an installation and an owner's manual. Its manual is its own sections
followed by the matching manual of each distinct component configuration in the exploded
tree, in tree order, each rendered with that configuration's values and quantity. A
configured system therefore gets a manual written for exactly what was sold, from
documentation written once per family. This matters for DIY kits, where the instructions are
part of the product.

*Open:* how deep composition goes (default: through the package's `to_part` depth, plus any
part whose manual is marked to be included in its parents'), and whether repeated components
are documented once with their count (default: yes).

### 3.2 Notes: values, live blocks, includes

Notes stay as rows, which keeps them addressable for QC results and versioned by minor
revision. Their markdown body gains:

* **Values:** `{{ expr }}` inline, evaluated by the engine in the node's scope (parameters and
  family-script declarations), formatted with units. For example: "Cut the channel to
  {{ L - 2*endcap }} mm."
* **Live blocks**, the successors of noedit's part summary and BOM. A small set of named
  directives:

  | Block | Shows |
  |---|---|
  | `summary` | partname, part number, version.minor, description, spec, each parameter with its value and meaning |
  | `bom` | components at a chosen depth, with line comments and quantities for the job |
  | `cutlist` | a flattened, filtered BOM (for example raw stock by length), summed |
  | `values` | a table of chosen values: the companion of a tabulated drawing (§5) |
  | `figure` | a document, sized and captioned, rendered for this configuration where it is generated |

* **Includes:** a note of type `include` names a shared **procedure** (painting, torque
  practice, pump priming). Procedures are catalog records with their own revision history. A
  family's notes include them rather than copying them.
* **Cross-references** between notes by tag, as in noedit, are cheap to add if wanted.

**QC limits become expressions.** A QC measurement's nominal, min and max may be expressions
of the parameters, as process times already are: nominal `L`, min `L - 0.5`, max `L + 0.5`.
The run's QC results record the evaluated limits, so they stand alone.

### 3.3 Documents: defining or illustrative

Add one flag to `Document`:

* **Defining** documents are part of what the product is: CAD models, CAM and print templates.
  They are frozen at release like BOM lines, and changing one needs a new version.
* **Illustrative** documents explain: figures, photos, datasheets, drawings that only annotate.
  They change by minor revision, as all documents do today.

This answers a question the FreeCAD work raises: does changing a model need a new version? It
does if the model is defining. A FreeCAD drawing can live in its own file that links to the
model file, so the drawing can be illustrative while the model is defining.

### 3.4 Output: packets and manuals

* **Run packet** (traveler): a header (partname, part number, version.minor, run ID, quantity,
  due date, and for contract shops the PO line), `summary`, then per routing step its notes,
  figures and QC checks, with blanks to fill in where results are not recorded on a device.
  The engine's `traveler()` supplies the structure, and the notes supply the content.
* **Manuals** for a part, a package configuration or an order (§3.1).
* Rendered as HTML with print styles, so they print to paper or PDF from any browser, and can be
  read on a shop tablet.
* **Frozen at release.** A run's packet is rendered when the run is released and kept. Any
  procedure included, figure generated or value computed is then exactly what the run was
  given, however the catalog changes later. Until files can be stored (§4), the run keeps the
  pinned notes revision and the time of release, and the packet is re-rendered as of that time.

## 4. File storage (prerequisite)

Sereus and Quereus have no file storage today (`ser/quereus/docs/sql.md`; strand contracts are
content-addressed, but that does not extend to application files). Strands hold SQL rows, and
drawings, models, PDFs and programs do not belong in rows. The proposal:

* `ContentRef` becomes either a **content hash** (`sha256:…`) or an external URL.
* The bytes of hashed files are kept by storage machines and fetched by hash from any member
  that has them. Identical files are stored once, and a hash can't silently point to changed
  content.
* Generated files (§6) use the same store, keyed by their inputs.

This is a requirement on Sereus and belongs in [sereus-requirements.md](sereus-requirements.md)
once agreed. Until then, external URLs work for illustrative documents.

## 5. Drawings

Three tiers, cheapest first:

1. **No drawing:** values in the note text (§3.2). Most assembly notes need numbers, not
   pictures.
2. **Tabulated drawing:** one drawing per version with letter callouts (L, W, H) and a
   generated `values` table for this configuration. It is how parametric families have
   traditionally been drawn, it never breaks, and it needs no CAD at render time.
3. **Generated drawing:** a to-scale drawing produced for the configuration from a CAD model
   (§6). Only where the scale picture matters, because dimension annotations are the fragile
   part (§6.4).

## 6. Generated geometry: CAD, CAM and printing

### 6.1 The idea

A defining CAD model is attached to a family version, with variables named like the family's
parameters. For any configuration, a **generator** sets the variables, rebuilds the model and
exports what is asked for: a drawing, an STL or 3MF for printing, a DXF for cutting, a CNC
program. This is ATI's burn-program design (§1) with a 3D model in the middle.

### 6.2 FreeCAD findings (version 26.3, headless `freecadcmd`, tried November 2026)

* Parameters in a `VarSet`, driving geometry through expressions, rebuilt correctly when a
  value changed.
* STL export works without the GUI.
* Drawing pages (TechDraw) project views and export DXF without the GUI. A dimension added to a
  view returned 0. This was not investigated further and may be how it was set up. PDF export of
  drawings has historically needed the GUI; SVG and DXF don't, and the workarounds are a virtual
  display or SVG to PDF conversion.
* The CAM and Assembly modules load without the GUI. Toolpath generation was not tried.
* Sheet-metal flat patterns need the SheetMetal add-on (not installed).
* FreeCAD is LGPL; running it as a separate program raises no licensing issue.

### 6.3 The generator contract

```
generate(template, inputs, output_kind, profile?) → files
```

* **template**: a defining document, with its kind (`freecad`, …).
* **inputs**: family, version, minor revision, canonical parameters, and the node's evaluated
  scope (parameters plus family-script declarations), each number with its units ("2400 mm").
  Enum parameters are turned into numbers or flags by the family script, so models don't
  branch on strings.
* **output_kind**: `drawing`, `stl`, `3mf`, `dxf`, `step`, `gcode`, `props` (mass, volume,
  overall size).
* **profile**: for machine output, a **machine profile**: a post-processor and its settings
  (a slicer profile, a CNC post). It is the successor of ATI's `std_koike.m` headers. It
  describes a machine, not a product, so it lives with shop reference data, not in the family.

Rules:
* **Tool-neutral.** FreeCAD is the first generator. CadQuery or build123d (code-based, natively
  headless) or a slicer are others. Simple 2D profiles could even be JavaScript in the BOM
  engine's sandbox, emitting SVG or DXF, which would run in the browser like ATI's m4 programs.
* **Runs on a generator machine:** a machine of the cadre with FreeCAD installed. It takes
  requests and writes results back, as the Bonum poster does
  ([architecture.md](../design/specs/domain/architecture.md)). FreeCAD can't run in the browser
  or on a phone.
* **Cached by inputs.** The key is the request plus the generator and tool versions. Outputs are
  not byte-reproducible (timestamps, tessellation), so they can't be identified by their own
  hash the way an explosion is. Generated files are disposable: they can always be made again
  and are never the record. The copy given to a run is kept with the run (§3.4).
* **Physical data for free.** `props` output can fill a part's weight and dimensions.

### 6.4 Release validation

product.md §4 step 3 explodes every active part, every standard package and the stored test
cases before release. With a defining model, validation also **rebuilds the model for each of
them** and refuses release when any rebuild fails. This catches a model that breaks somewhere in
the parameter range, the commonest failure of parametric CAD, before the version is released.
It also catches drawings whose dimensions lose their edges when the shape changes (FreeCAD's
"topological naming" problem).

### 6.5 Outputs by risk

| Output | Route | Risk |
|---|---|---|
| 3D printing | STL or 3MF, then a slicer CLI with a stored printer and material profile | low: scale comes from units; the slicer handles the machine |
| 2D cutting (laser, plasma, waterjet, router) | DXF of the profile or flat pattern, nested and toolpathed by the shop's own CAM | low: also what contract shops want ([purchasing.md](../design/specs/domain/purchasing.md) sends them drawings) |
| Generated drawings | FreeCAD TechDraw, exported SVG or DXF, PDF by conversion | medium: dimensions can break across configurations |
| CNC toolpaths | FreeCAD CAM, posted for the machine profile | high: operations attach to faces and edges, and a wrong path can damage the machine or the part |

For CNC toolpaths: only for families whose shape keeps the same structure across their whole
range; a first-article check or simulation per configuration before production use; and
programs for approved parts only (previews for any configuration). Sending programs to machines
(ATI's burn queue) is an operations concern for later.

## 7. Suggested order

1. **No new infrastructure:** build `traveler()` and the run packet; `{{ }}` values and the
   `summary`, `bom`, `cutlist` and `values` blocks; QC limits as expressions; manuals beyond
   `build`. All of it renders in the browser.
2. **Files:** content-hash storage (§4), figures from stored documents, tabulated drawings,
   shared procedures, packets frozen at release.
3. **Generators:** a generator machine, FreeCAD templates, STL and DXF output, `props`, release
   validation rebuilds. Prove it on one real hydroponics family, such as a printed fitting or a
   channel, across its validation set.
4. **Machines:** slicer and CNC profiles, generated drawings where needed, toolpaths for
   suitable families, and a machine queue.
