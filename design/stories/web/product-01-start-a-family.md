# User Story: Start a new part family

## Story Overview
As an engineer
I want to start a new part family under a short name
So that I can describe a product line once instead of part by part

Context: The class (for example `a`, assemblies) and the unit (for example `ea`) already exist.

## Sequence
1. Engineer opens the product section and chooses to add a family.
2. Engineer enters the family name (`a:chan`), its unit and a short description.
   - If the name is malformed or already taken, the app says so and keeps the entry.
3. The family appears with an empty draft, version 1, and no released version.
4. Engineer can come back to the draft later, or discard it; a family never released can be deleted.

## Acceptance Criteria
- [ ] The class is taken from the name's prefix; an unknown class is refused with a clear message.
- [ ] The new family is listed and findable by name or description.
- [ ] Discarding the only draft leaves the family with no versions.

## Questions (for the owner; the working default is used until answered)
- Q1. On first use there may be no classes or units yet. Should starting a family let the engineer add a missing class or unit on the spot, or must they be set up first (ReferenceData)? *Default: set up first; the new-family form links there when the list is empty.*
- Q2. Should a new family be able to start as a copy of an existing one (same parameters and lines, new name)? *Default: not in this slice.*
- Q3. Which families does the list show by default: all, or only active ones (hiding restricted and obsolete)? *Default: active; a filter shows the rest.*
- Q4. What does the engineer search by? *Default: one search box over name and description, plus a class filter.*
