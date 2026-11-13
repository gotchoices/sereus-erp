# User Story: Start a new part family

## Story Overview
As an engineer
I want to start a new part family under a short name
So that I can describe a product line once instead of part by part

Context: The class (for example `a`, assemblies) and the unit (for example `ea`) already exist (product-05). The engineer may be new to parametric families: in most systems every part is defined on its own.

## What the user needs to understand
- What a **family** is: one definition of a product line, with parameters (length, diameter) that name each variation, rather than a list of separate parts.
- What a **class** is (the letter before the colon) and what a family's **unit** means (what one of it is counted in).
- That a new family starts as a **draft** that nobody else relies on until it is released (product-03).

## Sequence
1. Engineer opens the product section and lands on the list of families. The page says what it lists, and a short explanation of what a family is is at hand, with a pointer to how to start one.
2. When the list is empty (a new installation), the page explains what families are for and offers to start the first one; if there are no classes or units yet, it says so and leads to setting them up (product-05) first.
3. Engineer chooses to add a family and sees what each entry means as they fill it in: the name (`a:chan`, the class letter, a colon and a short name), its unit and a short description.
   - If the name is malformed or already taken, the app says so in words, shows what a valid name looks like, and keeps the entry.
4. The family opens with an empty draft, version 1, and no released version. The page says plainly what comes next: define its parameters and components (product-02), then release it (product-03).
5. Engineer can leave and come back to the draft later, or discard it; a family never released can be deleted.

## Acceptance Criteria
- [ ] The class is taken from the name's prefix; an unknown class is refused with a clear message that names the known classes.
- [ ] The new family is listed and findable by name or description.
- [ ] Discarding the only draft leaves the family with no versions.
- [ ] A person who has never used the app can tell, from the family list alone, what it is listing and how to add to it.
- [ ] Every term the page uses (family, class, unit, draft) has a short explanation within reach, without leaving the page.

## Questions (for the owner; the working default is used until answered)
- Q1. On first use there may be no classes or units yet. Should starting a family let the engineer add a missing class or unit on the spot, or must they be set up first (ReferenceData)? *Default: set up first; the new-family form links there when the list is empty.*
- Q2. Should a new family be able to start as a copy of an existing one (same parameters and lines, new name)? *Default: not in this slice.*
- Q3. Which families does the list show by default: all, or only active ones (hiding restricted and obsolete)? *Default: active; a filter shows the rest.*
- Q4. What does the engineer search by? *Default: one search box over name and description, plus a class filter.*
