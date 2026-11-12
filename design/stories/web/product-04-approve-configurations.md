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
