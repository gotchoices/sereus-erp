# User Story: See, found and join strands

## Story Overview
As an owner of our installation
I want to see our strands and what each is for, found a new one when we need it, and join a strand another company invites us to
So that each module's data is shared with exactly the machines and parties it should be

Context: deployment.md §7. Today the only module is the catalog, founded at the start (settings-02). Later modules (operations, purchasing) and other parties' strands (a vendor link, a customer's catalog) follow the same rules. Settings already lists the strands this machine holds (settings-01).

## Sequence
1. Owner opens Settings, **Strands**. Each strand shows its name, its module, its note of intent, whether it is ours or another party's, its state, and which of our machines hold it.
2. **Found a strand:** owner picks the module (only the catalog for now), gives it a name and a note saying what it is for ("Catalog for the outdoor line, kept apart from the main one"), and confirms. The strand appears, and every other machine of ours picks it up. The name and note can be edited later.
3. While this machine has not finished joining, Found is not offered; the page says strands may still be arriving.
4. With more than one strand of a module, the app asks which one to work in, shows the current one's name in the top bar, and lets the user switch. A machine remembers its choice.
5. **Join another company's strand:** owner pastes the strand invitation that company sent, sees which company and module it is for, and confirms. The strand appears as theirs.
6. **Invite another company** into one of our strands: owner makes a strand invitation and sends it; it is listed until used.
7. **Remove** a strand: the confirmation says it leaves every machine of ours, and that a closed strand removed can never admit anyone again.

## Acceptance Criteria
- [ ] A strand founded from a terminal or another machine shows up here and works the same.
- [ ] A second strand of a module is a separate strand: nothing is copied between them, and neither is treated as a mistake.
- [ ] The note of intent is visible before the strand has any records.
- [ ] Adding a machine of ours (settings-03) and joining another company's strand are never on the same control.

## Questions (for the owner; the working default is used until answered)
- Q1. Is there anything to join from another company soon (a vendor or a supplier)? *Default: build the list and found now; joining and inviting other companies when the first vendor link arrives.*
