# Open-source alternatives: survey and fit

Requirements are judged against the core capabilities of the ATI system (see
[ati-mfg-model.md](legacy/ati-mfg-model.md)):

* **P1** Parametric part families, where part number = family + parameter values
* **P2** BOMs whose quantities and child parameters are formulas or scripts of the parent's
  parameters, including option selection
* **P3** Packages: sell as a configuration, stock and ship as components
* **I1** Inventory as a ledger of transfers between locations or projects, with
  work/open/closed statuses that drive available and projected stock
* **M1** Level-by-level replenishment (MRP-like), with make-or-buy decided per buy
* **S1** Vendor bids (price breaks, lots, packages, lead time, expiry, history) and an award
  step, plus a vendor self-service portal
* **S2** Labor-only "‑A" subcontract bids that issue materials to the shop or vendor
* **A1** Accounting integration (Bonum, ideally)

Status notes reflect a light web check in November 2026 plus prior knowledge. Items marked
*(verify)* were not confirmed in current documentation.

## Candidates

### ERPNext / Frappe (GPLv3, Python + MariaDB)
* Has: item variants by attribute, BOM templates, multi-level BOM, work orders, routing and job
  cards, production plan / material request planning, **RFQ → supplier quotation through a
  supplier portal**, POs, receipts, subcontracting, a perpetual stock ledger, and full
  accounting.
* Gaps: **no formula-driven BOM in core**. A variant BOM is copied from a template and then edited
  by hand. Forum users with thousands of variants report that this is unworkable. Configurators
  exist as paid add-ons (for example, ECOSIRE's CPQ, from about $799, commercial license) or
  community experiments ("config to order", a "super BOM" with conditions and formulas).
* Fit: S1, M1, I1 (approximately) and A1 (its own accounting, which would duplicate Bonum).
  P2 would be a custom Frappe app. Writing that app is very doable, because Frappe apps are
  ordinary Python.

### Odoo Community (LGPLv3) + OCA modules
* Has: product variants, the MRP app (BOMs, work orders), purchase, inventory (double-entry stock
  moves between locations, conceptually close to MTRs), and the sale-side variant configurator.
* **OCA `mrp_bom_line_formula_quantity`** (AGPL-3, Odoo 16 and 18) adds a Python formula field
  for the quantity on each BOM line, driven by custom attribute values. The OCA
  `product-configurator` project (`product_configurator_mrp`) generates variant BOMs from
  configuration rules *(verify current version support)*.
* 8cells' "parametric product configurator" (Odoo 13–19) does dimension- and formula-based
  material sizing and creates a BOM specific to the order line. It is **OPL-1 (proprietary)**.
* Gaps: full accounting, MES, PLM and quality are Enterprise-only. Community accounting is
  limited, though OCA modules fill much of it. Upgrades between major versions are painful.
  Formulas set quantities but generally not child parameters, so recursive parametric
  sub-assemblies (P2 in full) are not native.
* Fit: P1, P2 and P3 are partly covered, and I1 and M1 are good. S1 has purchase agreements and
  calls for tender *(verify which edition)* but no vendor-maintained bid catalog.

### InvenTree (MIT, Python/Django)
* Has: parts with templates and variants, **parameters** (descriptive templates), multi-level
  BOMs, build orders that check BOM availability, **supplier parts with price breaks and
  packaging**, purchase orders that receive into stock, sales orders, stock locations and
  tracking, BOM-rolled-up pricing, and a REST API with a plugin system. Popular with small
  hardware makers.
* Gaps: no accounting. Parameters are not formulas, so BOM quantities are fixed. Planning is
  limited to "required vs. available" and low-stock levels. There is no award or auction
  workflow.
* Fit: a good **operational core for a small hardware startup** if paired with (a) a parametric
  generator that creates parts and BOMs through its API and (b) Bonum for the books.

### Tryton (GPLv3, Python)
* Has: a modular design, product variants, production with BOMs and routings, **stock supply
  (order points automatically create purchase requests)**, purchase request quotations (RFQs to
  several suppliers), and solid accounting.
* Gaps: a small ecosystem, a desktop/web UI that feels dated, and no formula BOMs.
* Fit: the closest in *philosophy* to ATI's purchasing rounds (request → quotation → award), but
  the community is small.

### Others
* **Dolibarr** (GPL): simple BOM and MRP modules. Light, but shallow.
* **iDempiere / metasfresh**: heavy, Java, aimed at larger operations.
* **frePPLe** (open-source planning engine): integrates with Odoo and ERPNext for MRP and
  scheduling. It is a planning tool, not a system of record.
* Commercial SaaS for reference (not open source): Katana, MRPeasy, Fishbowl.

## Coverage matrix

| | P1 families | P2 formula BOM | P3 packages | I1 ledger inventory | M1 MRP | S1 bids/award | S2 labor-only subcontract | A1 Bonum |
|---|---|---|---|---|---|---|---|---|
| ATI pass 2 | ●● | ●● | ●● | ●● | ● (manual) | ●● | ●● | — |
| ERPNext | ● variants | ○ add-on/custom | ● product bundle | ● | ●● | ● RFQ + portal | ●● subcontracting | ✕ (own GL) |
| Odoo CE + OCA | ● variants | ● qty formulas | ● kits | ●● stock moves | ●● | ○/● | ● | ✕ (own GL) |
| InvenTree | ● templates | ✕ | ○ | ● | ○ | ○ price breaks | ○ | via API (custom) |
| Tryton | ● | ✕ | ○ | ●● | ● | ● quotations | ● | ✕ (own GL) |
| New on Sereus | ●● | ●● | ●● | ●● | to build | ●● (strands) | ●● | ●● native |

●● strong ● adequate ○ weak/partial ✕ absent

## Bottom line

No open-source system has **recursive parametric families with formula-driven child parameters,
quantities and option logic** as a core feature. Every candidate treats variants as a matrix of
pre-created items. The closest are Odoo with OCA formula modules, and ERPNext with a custom app.
Everything else ATI did (stock ledger, MRP, RFQs, POs, receiving, subcontracting) is commodity
functionality that ERPNext, Odoo and Tryton already do well, and arguably better than pass 2 did.

So the parametric engine is the only piece worth building regardless of which route is chosen,
and it can be built as a portable library that feeds any of these systems.

## Sources
* [OCA mrp_bom_line_formula_quantity (PyPI)](https://pypi.org/project/odoo-addon-mrp-bom-line-formula-quantity) · [Odoo apps listing](https://apps.odoo.com/apps/modules/16.0/mrp_bom_line_formula_quantity)
* [8cells parametric product configurator (Odoo apps)](https://apps.odoo.com/apps/modules/18.0/parametric_product_configurator)
* [ERPNext BOM docs](https://docs.frappe.io/erpnext/v12/user/manual/en/manufacturing/bill-of-materials) · [Frappe forum: item variants and BOM templates](https://discuss.frappe.io/t/item-variants-and-bom-templates/85504) · [Frappe forum: config-to-order proposal](https://discuss.frappe.io/t/new-feature-config-to-order-erpnext-version-of-saps-variant-configuration-app-published-testing-needed/55621)
* [ECOSIRE ERPNext product configurator](https://ecosire.com/ja/apps/erpnext/erpnext-product-configurator-cpq) · [ECOSIRE Odoo vs ERPNext 2026 (vendor blog)](https://ecosire.com/blog/odoo-vs-erpnext-deep-comparison-2026) · [ECOSIRE open-source ERP for manufacturing 2026](https://ecosire.com/zh/blog/open-source-erp-for-manufacturing-top-5-2026)
* [InvenTree pricing docs](https://inventree-docs-matmair.readthedocs.io/en/latest/part/pricing/) · [Elestio InvenTree overview](https://blog.elest.io/inventree-free-open-source-alternative-to-fishbowl-sortly/)
* [Launchpad: OpenERP parametric MRP (2014, unmaintained)](https://qastaging.launchpad.net/mrpproductsparametric)
