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
