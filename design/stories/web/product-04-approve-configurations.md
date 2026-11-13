# User Story: Approve configurations as parts

## Story Overview
As an engineer
I want to approve the configurations we will actually stock or sell
So that they become parts, without issuing part numbers before anyone needs them

Context: The family has a released version. Partnames are for engineering; part numbers are for orders, POs and inventory (domain/product.md §3).

## What the user needs to understand
- A family describes every possible configuration; a **part** is one configuration someone has approved to stock, buy or sell.
- A **partname** (`a:chan(1200,6,75)`) names a configuration by its parameter values, in order. A **part number** (`1234`) is a short number for commerce, issued only when an order, PO or label needs it.
- A part's **status** (proposed, active, restricted, obsolete) says whether it may be used in new orders.

## Sequence
1. On the family, engineer sees its approved parts, each shown with what its values mean (`L` 1200 mm, `D` 6, `H` 75 mm) and not only as a bare partname, with its part number or "no number yet", and its status.
2. When there are none yet, the list explains what approving a configuration does and offers to approve the first.
3. Engineer enters a configuration by its parameter values, each labeled with its parameter's name, unit and allowed range or choices, or pastes a partname (`a:chan(1200,6,75)`).
4. The app checks each value against the parameters (range, allowed choices, defaults for blanks), writes it in standard form, and shows the partname.
   - If a value is invalid, the app says which one and why.
   - If the configuration is already a part, the app shows that part.
5. The part is listed under the family by partname, with "no number yet".
6. When a part number is needed, the engineer (or, later, an order or PO) asks for one; the number appears as pending until it is confirmed, then as final. An explanation of why numbers are issued late is at hand.

## Acceptance Criteria
- [ ] Packages (`@:` families) cannot be approved as parts, and the app says why in words (a package is sold, then exploded into parts).
- [ ] `a:chan(1200.0, 06, 75)` and `a:chan(1200,6,75)` are recognized as the same part.
- [ ] A part number is never shown as final before it is confirmed, and never changes once final.
- [ ] Wherever parts are listed, a reader can tell what each value in a partname means without opening the family.

## Questions (for the owner; the working default is used until answered)
- Q1. Should the engineer be able to approve several configurations at once (for example every length from 600 to 2400 by 300, in both diameters)? *Default: one at a time in the first slice.*
- Q2. Should "issue a number" be offered on the part itself, or only when an order or PO first needs it? *Default: offered on the part, and later automatic from orders and POs.*
- Q3. Is a newly approved part `proposed` until someone marks it `active`, or active at once? *Default: proposed, as the domain says; the engineer can activate it.*
- Q4. Should a part also have a short readable description built from its family and values ("1/4-20 × 1 in hex bolt")? *Default: not stored; shown from the parameter names and units.*
