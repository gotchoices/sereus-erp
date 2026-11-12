# User Story: Approve configurations as parts

## Story Overview
As an engineer
I want to approve the configurations we will actually stock or sell
So that they become parts, without issuing part numbers before anyone needs them

Context: The family has a released version. Partnames are for engineering; part numbers are for orders, POs and inventory (domain/product.md §3).

## Sequence
1. Engineer enters a configuration by its parameter values (`1200, 6, 75`) or as a partname (`a:chan(1200,6,75)`).
2. The app checks each value against the parameters (range, allowed choices, defaults for blanks), writes it in standard form, and shows the partname.
   - If a value is invalid, the app says which one and why.
   - If the configuration is already a part, the app shows that part.
3. The part is listed under the family by partname, with "no number yet".
4. When a part number is needed, the engineer (or, later, an order or PO) asks for one; the number appears as pending until it is confirmed, then as final.

## Acceptance Criteria
- [ ] Packages (`@:` families) cannot be approved as parts.
- [ ] `a:chan(1200.0, 06, 75)` and `a:chan(1200,6,75)` are recognized as the same part.
- [ ] A part number is never shown as final before it is confirmed, and never changes once final.

## Questions (for the owner; the working default is used until answered)
- Q1. Should the engineer be able to approve several configurations at once (for example every length from 600 to 2400 by 300, in both diameters)? *Default: one at a time in the first slice.*
- Q2. Should "issue a number" be offered on the part itself, or only when an order or PO first needs it? *Default: offered on the part, and later automatic from orders and POs.*
- Q3. Is a newly approved part `proposed` until someone marks it `active`, or active at once? *Default: proposed, as the domain says; the engineer can activate it.*
