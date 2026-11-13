# User Story: Move the installation to another machine

## Story Overview
As the person responsible for our installation
I want to move a machine's role to a new one (a server taken from home to the office, or replaced) and retire the old one
So that nothing is lost and the old machine stops being part of the installation

Context: deployment.md §6. A move is not its own feature: it is adding a machine (settings-03), giving it an owner key if the old one had one (settings-04), and removing the old machine (settings-03). This story checks that those pieces make a move safe and easy to follow. It is the same whether the machines run the web app or are servers started from a terminal.

## Sequence
1. Owner invites the new machine (settings-03) and, if the old machine holds an owner key that will not be kept elsewhere, makes an owner grant for the new one (settings-04).
2. Owner starts the new machine with the invitation (web app Join page, or `cadre start --invitation …` on a server).
3. On Settings the owner sees the new machine join and its copies of each strand go from syncing to current.
4. Owner removes the old machine. Because the new one holds copies, the removal goes through with an ordinary confirmation, which also offers to remove the old machine's owner key.
5. If the owner tries to remove the old machine before the new one has its copies, the confirmation says the old machine holds the only copy of a strand (settings-03) and the owner can wait.

## Acceptance Criteria
- [ ] There is no separate Move or Replace control; the help for Invite and Remove mentions how a move is done.
- [ ] The old machine, if still running, stops syncing and says it was removed.
- [ ] Nothing in the move copies files between machines.
