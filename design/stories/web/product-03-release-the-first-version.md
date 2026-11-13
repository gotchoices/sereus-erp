# User Story: Release a version

## Story Overview
As an engineer (approver)
I want to release the draft
So that the family's definition is fixed and others can rely on it

Context: Continues product-02. The same story covers later versions: a released version is never edited, so every change is a new draft that is released in turn.

## What the user needs to understand
- A **version** is a fixed snapshot of the definition. The **current** version is the one used wherever no version is named; older ones stay readable, because parts already built or ordered refer to them.
- A **draft** is the next version being prepared. There is at most one, and nothing uses it until it is released.
- A **minor revision** corrects the notes, QC checks or documents of a released version without changing what is built.
- **Interchangeable** means a part built to the new version can stand in for one built to the previous version.

## Sequence
1. Engineer sees the family's versions as a short history: which is current, which is a draft, when each was released and by whom, and what changed. An explanation of versions, drafts and minor revisions is at hand from there.
2. Engineer chooses to release the draft and is told what releasing means before confirming: the definition becomes fixed and current.
3. Engineer writes a change summary and, from version 2 on, says whether it is interchangeable with the previous version, with a short explanation of what that decides.
4. The app checks the definition: every component exists and is released, and each line gives the component the right number of parameters.
   - If a check fails, the release is refused, each failing line is shown with the reason in words, and the draft is unchanged.
5. The version becomes current and can no longer be edited. Its release date and who released it, by name, are shown.
6. When the engineer later wants to change the family, they are offered a new draft (version 2) that starts as a copy of the current one, and told that the current version stays as it is until the draft is released.

## Acceptance Criteria
- [ ] A released version cannot be edited; the app offers "start a new draft" instead and says why.
- [ ] Notes and QC checks of a released version can still be corrected, as a recorded minor revision, and the engineer can tell that choice apart from starting a new draft.
- [ ] People are shown by name, not by a machine or key ID.
- [ ] (Later, with the BOM engine) release also explodes sample configurations and shows any failures.

## Questions (for the owner; the working default is used until answered)
- Q1. Must the person releasing differ from the last editor (domain/product.md §9, open)? *Default: no check; one person does both today.*
- Q2. Before releasing version 2 or later, should the app show what changed from the current version (lines added, removed, changed)? *Default: yes, a simple side-by-side list of changes, when that slice comes.*
