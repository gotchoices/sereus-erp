# User Story: Add and remove the party's machines

## Story Overview
As an owner of our WyattERP installation
I want to invite another machine into it, see that it arrived, and remove one we no longer use
So that the people and servers that need the catalog have it, and a machine we gave up does not

Context: deployment.md §4. Settings already lists the party's machines (settings-01). An invitation admits one machine; the same can be done from a terminal (`cadre enroll invite`), and either kind is redeemed the same way (settings-02, or `cadre start --invitation`).

## Sequence
1. Owner opens Settings and chooses **Invite a machine**.
2. Owner names the machine to be ("shop laptop", "closet server") and may choose how long the invitation lasts (default 7 days).
3. Owner sees the invitation as text to copy and as a QR code, with a warning that whoever holds it can join, and how to use it: paste into a new web app's Join page, or `cadre start --invitation "…"` on a server.
4. The invitation is listed under **Invitations waiting** until it is used or expires; the owner can withdraw it there.
5. When the machine joins, it appears under the party's machines with its name, and its copies show as syncing, then current.
6. Owner can **Remove** a machine. The confirmation names the machine, says whether it holds an owner key (removed separately, settings-04), and says plainly when it holds the only copy of some strand: removing it then is refused unless the owner confirms that the data may be lost. This is also how a machine is moved or replaced (settings-06).

## Acceptance Criteria
- [ ] A user who is not an owner sees the machines but no Invite or Remove.
- [ ] A withdrawn or expired invitation is refused when redeemed (settings-02 shows why).
- [ ] A machine removed from a terminal (`cadre`) disappears from this list too.
- [ ] Machines show their names, not only IDs (settings-01 Q3 answered: names come with invitations).

## Questions (for the owner; the working default is used until answered)
- Q1. Should an invitation be usable more than once (one code for a whole shop floor)? *Default: one machine each.*
