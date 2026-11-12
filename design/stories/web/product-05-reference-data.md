# User Story: Set up units, classes and operations

## Story Overview
As the person setting up the catalog (admin)
I want to define the units, product classes and kinds of work the catalog uses
So that engineers can start families in the right class and unit, and route them through known operations

Context: Needed before the first family (product-01 Q1 default: set up first). The hydroponics line needs, for example, `ea`, `mm`, `m` and `l`; classes for assemblies, purchased parts and kits; operations such as cut, drill, plumb, wire, test.

## Sequence
1. Admin opens Units, classes and operations from the product section.
2. Admin sees three lists: units (code, name, dimension, decimal places stored, conversion to the base unit), classes (one-character prefix, name, kind: part, package or custom, storage notes), and operations (code, description).
3. Admin adds an entry to any list, or changes the name, description or other details of an existing one.
   - If the code is malformed or already used, the app says so and keeps the entry.
4. A code (unit code, class prefix, operation code) cannot be changed once created: families, parameters and routing refer to it.
5. The new entries are offered at once where they are used: units and classes when starting a family, operations in routing.

## Acceptance Criteria
- [ ] Each list shows what refers to an entry (how many families use a class or unit, how many routing steps an operation).
- [ ] A unit's decimal places cannot be changed once anything is counted in it: stored quantities would change meaning.
- [ ] An entry is never silently lost: a refused change keeps what was typed.

## Questions (for the owner; the working default is used until answered)
- Q1. Should unused entries be deletable (a unit nobody uses, a misspelled class)? *Default: not in this slice; an unused entry does no harm.*
- Q2. Should conversions between units of one dimension (mm ↔ m) be entered as a factor to the base unit, as the domain has it, or picked from a standard list? *Default: entered as a fraction to the base unit (1/1000 for mm when m is the base).*
- Q3. Is a class prefix limited to one character, as in ATI? *Default: yes (domain/product.md §2).*
