# User Story: Release the first version

## Story Overview
As an engineer (approver)
I want to release the draft
So that the family's definition is fixed and others can rely on it

Context: Continues product-02.

## Sequence
1. Engineer chooses to release the draft and writes a change summary (and, from version 2 on, says whether it is interchangeable with the previous version).
2. The app checks the definition: every component exists and is released, and each line gives the component the right number of parameters.
   - If a check fails, the release is refused, the line and the reason are shown, and the draft is unchanged.
3. The version becomes current and can no longer be edited. Its release date and who released it are shown.
4. Later changes start a new draft (version 2) as a copy of this one.

## Acceptance Criteria
- [ ] A released version cannot be edited; the app offers "start a new draft" instead.
- [ ] Notes and QC checks of a released version can still be corrected, as a recorded minor revision.
- [ ] (Later, with the BOM engine) release also explodes sample configurations and shows any failures.

## Questions (for the owner; the working default is used until answered)
- Q1. Must the person releasing differ from the last editor (domain/product.md §9, open)? *Default: no check; one person does both today.*
- Q2. Before releasing version 2 or later, should the app show what changed from the current version (lines added, removed, changed)? *Default: yes, a simple side-by-side list of changes, when that slice comes.*
