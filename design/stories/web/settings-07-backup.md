# User Story: Back up the catalog to a file, and restore it

## Story Overview
As the person responsible for our installation
I want to save the catalog to a file I can keep off-site, and restore it into a new installation
So that we can recover even if every machine is lost, and keep a readable copy of our data

Context: deployment.md §9. Copies on other machines (above all a storage machine) are the everyday protection; this file is the last resort and a way to move data. ATI's catalog came in by the same kind of replay (tools/legacy/README.md).

## Sequence
1. Owner opens Settings, **Backup**, and chooses **Export the catalog**.
2. The app writes a file and downloads it, named with the company and date, and says how many families, parts and part numbers it holds.
3. To restore, owner starts a new installation (settings-02, Start new), then in Backup chooses **Restore from a file** before entering anything. The app shows what the file holds and asks to confirm.
4. The restore shows progress and, at the end, what was restored and anything refused, with reasons.

## Acceptance Criteria
- [ ] Restore is refused into a catalog that already has families.
- [ ] After a restore, a regular user cannot tell the catalog from the original: identifiers, part numbers, authors and dates are all as they were (deployment.md §9).
- [ ] A file exported here can be restored with the `wyatt` command, and the reverse.

## Questions (for the owner; the working default is used until answered)
- Q1. Should exports also be made on a schedule, to a folder? *Default: later, on a storage machine.*
