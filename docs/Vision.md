# Vision

## What WyattERP is

A **parametric manufacturing control system** for a startup that builds modular hydroponic
growing systems. It is built on the **Sereus** stack (local-first, peer-to-peer, strands of
shared Quereus SQL), and uses **Bonum** for its books.

It succeeds the ATI ERP, written between 1990 and 2013 for Action Target. That system
was PostgreSQL plus Tcl/Tk, and it ran a real manufacturing business for about 15 years. Its
manufacturing side worked well. WyattERP keeps its model and replaces the parts that didn't.

## Goals

1. **Run the hydroponics business's product, inventory, purchasing and production**, from a
   handful of users at first to many later (Q7).
2. **Preserve the parametric model:** product families with parameters, BOMs computed by
   scripts, packages that explode into stockable parts, and make-or-buy decided per buy.
3. **Demonstrate Sereus** doing something real and multi-party (Q7, Q13):
   * inviting a device into a strand gives a person a module's interface;
   * vendors and shops take part through their own strands;
   * shop-floor work continues while offline.
4. **Keep accounting in Bonum.** WyattERP posts economic events to Bonum, and doesn't compete
   with it.

## Product strategy the system must support (Q1, Q2, Q4)

* About **100 standard components**, made to stock in economical runs.
* **Customer systems configured to order** as packages, sold as DIY kits or as complete
  installations. Each installation can feel custom while its components are made in volume.
* Sales through salespeople at first (a configurator replacing ATI's hard-to-learn `ordtool`),
  and later an online store where customers design their own system. The engine runs in the
  browser, so the same engine serves both.

## Constraints

* **No deadline** (Q8). The build proceeds at the pace of the business.
* Low initial volume, a small team, in-house assembly with possible contract shops.
* Stack:
  * Sereus (Quereus SQL, Optimystic, strands) and TypeScript;
  * browser UIs built with the appeus design-first workflow (SvelteKit likely, not committed);
  * one domain contract, with several UIs over it.
* **Conscious purchasing.** People decide what to buy and from whom, and the system suggests.
  No favored vendors and no automatic kanban replenishment (Q10). The reason is economies of
  scale: carrying some inventory to buy and build in optimal lot sizes beats replenishing on
  demand. A more automated mode may come later.
* The ATI code, data and rights are privately held. The ATI sources and data are **study material,
  not part of this repository** (see [legacy/README.md](legacy/README.md)).

## Name

**WyattERP** is the parent brand, and it has had several incarnations:

* **Legacy:** the wylib, wyseman and wyselib libraries (PostgreSQL and Tcl/Tk), and the ATI
  ERP built on them.
* **sereus-erp:** this repository, the Sereus-based incarnation.

Packages use the `@wyatt/` scope. Sub-names for modules may follow the family's naming.
