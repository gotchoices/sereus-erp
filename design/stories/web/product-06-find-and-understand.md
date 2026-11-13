# User Story: Find a family or part and understand it

## Story Overview
As anyone working with the catalog (engineer, buyer, someone on the shop floor)
I want to find a family or a part and quickly understand what it is, what it is made of and where it is used
So that I can answer a question about a product without knowing in advance where to look

Context: Most visits to the catalog are to look something up, not to change it. A catalog with thousands of families and parts must still be easy to move around in. This story covers reading; the others cover changing.

## What the user needs to understand
- Where they are: which section, which family, which version, and how they got there.
- How families, parts, versions and components relate, so that following a link never feels like getting lost.

## Sequence
1. User starts from what they have: a family name, a description word, a partname or a part number. One search finds any of them, and a part number or partname leads straight to the part.
2. On a family, the user sees the current definition at once (what it is, its spec, its parameters, its components and how it is built) without first choosing a version. Older versions and any draft are a step away, and it is clear which one is being shown.
3. From a BOM line, the user can open the component family, and from any family see **where it is used**: the families whose lines name it.
4. On a part, the user sees its family, what each of its values means, its part number and status, and its stock policy.
5. Sections with nothing in them stay out of the way: the page says briefly that there are none and how to add one, without a stack of empty headings.
6. Wherever the user is, they can get back to where they came from, and can tell which section of the app they are in.

## Acceptance Criteria
- [ ] A part number typed in the search opens that part.
- [ ] Reading a family's current definition never requires opening a version first.
- [ ] Every component on a BOM line, and every family in "used in", is one step away.
- [ ] Pages stay readable with real data: long specs, families with hundreds of parts, BOMs with many lines.
- [ ] Every term the catalog uses (family, part, partname, part number, version, draft, minor revision, package) has a short explanation within reach on the pages that use it.

## Questions (for the owner; the working default is used until answered)
- Q1. Should there be one search for the whole app (in the top bar) rather than one per list? *Default: yes, one search for the catalog, in the top bar.*
- Q2. Should the explanations of terms also be gathered on one page (a short guide to the catalog)? *Default: yes, linked from each explanation.*
- Q3. Should a family show its parts and "used in" counts in the family list? *Default: yes, as counts.*
