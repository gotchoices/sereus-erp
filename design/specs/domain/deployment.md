# Deployment: machines, owners and strands

## 1. Purpose

The rules for setting up and keeping a WyattERP installation, the same whichever client does
the work: the web app, the `wyatt` command (apps/cli), or later a mobile app. The web app's
stories say how a person does these things there; the `wyatt` command documents its own
commands. This spec says what must hold however they are done.

WyattERP builds on Sereus for all of it (machines, keys, invitations, sync, reachability) and
adds only what is its own: which strands a party has, how they are founded and found, and
backup and restore of their data. Where a rule here is Sereus's, it is cited, not redefined
(`ser/sereus/docs/architecture.md`, `cadre-host.md`, `packages/cadre-cli/README.md`).

## 2. Terms

| Term | Meaning |
|---|---|
| **Party** | Who runs an installation: a company or a person. In Sereus, a party's machines form its **cadre**. |
| **Machine** | One running node of the party: the web app's server on a desktop, a server in a closet, later a phone. Each has its own identity (its peer ID) and a label people choose ("office server"). |
| **Storage machine** | A machine that keeps a copy of every strand the party has, whether or not it runs WyattERP (Sereus's `storage` profile: `cadre start`, or a node of `cadre-host`). It gives redundancy and reachability. |
| **Owner key** | A key held by a person, not by a machine, that admits and removes machines and other owner keys and founds strands. A machine may hold one (the web app does; `cadre start --owner`). |
| **Recovery key** | An owner key, or a grant that makes a new one, kept off the machines: a passphrase-locked export or an owner grant that does not expire (Sereus: Owner Keys, Owner grants). |
| **Strand** | A module's shared database (architecture.md §2): the catalog today, operations, purchasing and the others later. Each has its own members. |
| **Client** | A program that works in WyattERP's strands through `@wyatt/core`: the web app, the `wyatt` command. Sereus's own `cadre` command manages machines and keys but
not WyattERP's strands or data. A storage machine without a client still holds and serves the strands. |

## 3. Clients are interchangeable

* Whatever one client does here, the strand records only its effect. A strand founded, a
  machine admitted or an owner key added from one client MUST work exactly the same in every
  other.
* Each client SHOULD offer the operations below, or say where they are done instead. The
  `wyatt` command does what is WyattERP's own (founding and finding strands, export and
  restore, §7, §9) and leaves machines and keys to `cadre` (`cadre enroll invite`,
  `cadre owner-key`, `cadre start --owner`).

## 4. A party and its machines

* **Starting.** A first machine starts a new party: it founds the party with an owner key of
  its own, and founds the party's first catalog strand (§7). Any other machine joins an
  existing party instead, by a **machine invitation** that an owner made (Sereus: Enrollment Flow: Invitation Redeemed at Any Member). A client
  starting fresh MUST let the person choose between the two, and MUST NOT found a party when
  the person meant to join one.
* **Invitations.** An invitation admits one machine, expires (at most 30 days) and may be
  withdrawn. It is a credential: whoever holds it can join. It can be redeemed at any member
  that is reachable, so the owner who made it may be offline.
* **A new machine** starts empty and copies the party's strands. Until a strand is copied, the
  machine shows it as syncing (settings-01), never as missing.
* **Removing a machine** is an owner's act. It stops the machine from syncing and leaves owner
  keys alone: a removed machine that held an owner key keeps it until the key is removed too
  (Sereus: What an owner key decides).
* **Redundancy.** A client SHOULD warn before removing the last machine that holds a copy of a
  strand, and SHOULD suggest a storage machine to a party that has none.

## 5. Owner keys and recovery

* A party always has at least one owner key. Sereus refuses removing the last one, or one
  removing itself.
* A client SHOULD prompt for a recovery key while the party has only one owner key, and
  SHOULD show, for each owner key, its label and whether it is held on this machine.
* An owner key's private half never leaves a machine except as an export the person asked for
  and was warned about. An export SHOULD be passphrase-locked.
* Adding an owner key to another machine is by importing an export or redeeming an owner grant.
  A grant gives a new key of its own, so it is the safer way to make a second owner.

## 6. Moving a machine

Moving an installation (a server taken from home to the office, or replaced) is a sequence of
the operations above, never a copy of files:

1. Admit the new machine by invitation. If the old one held an owner key, give the new one an
   owner key too (an owner grant, or importing an export).
2. Wait until the new machine holds a copy of every strand.
3. Remove the old machine, and its owner key if no one keeps it.

A client SHOULD guide the sequence and refuse step 3 before step 2 is done, unless the person
confirms that another machine holds the copies.

## 7. Strands

* **Founding** a strand is an owner's act, and it is a deliberate one: founding again makes a
  second, separate strand, never a copy of the first. A party usually has one strand per
  module, and MAY have several (a second catalog for a separate product line, a test catalog).
  Sereus treats each as its own strand, so there is nothing to detect or reconcile.
* **Every strand says what it is for.** Founding asks for a name and a note of intent ("Main
  catalog", "Catalog for the outdoor line, kept apart from the main one"), stored with the
  strand and shown wherever strands are listed. It records intent that the strand's contents
  would not show until it fills up, and it is how a person tells two of one module apart.
* **Which one a client works in.** With one strand of a module, a client uses it. With several,
  it asks which, and remembers the choice per machine. A new machine of the party shows the
  strands it finds as they arrive; a client SHOULD NOT offer to found a module's strand on a
  machine that has not finished joining, since the strand it is looking for may still be on
  its way.
* **Another party's strands.** Joining a strand another party founded (a vendor link, a shop
  link, a customer's catalog) is by a **strand invitation** from that party, not a machine
  invitation, and makes this party a member of that one strand only (Sereus: strands.md). A
  client SHOULD keep "add a machine of ours" and "join someone else's strand" plainly apart.
* **Removing a strand** removes it from every machine of the party. It is an owner's act, and
  a closed strand removed can never admit members again, so a client MUST confirm it.

## 8. Reachability

* A machine is reachable by any means Sereus supports: a public address, a mapped or
  forwarded port, a relay. Nothing in WyattERP assumes machines share a network.
* A machine that no other can reach still works alone and syncs when one can. A client SHOULD
  show whether this machine can be reached and, if not, what would make it so (settings-01
  shows its listen addresses).

## 9. Backup and restore

* **Copies first.** Other machines' copies, storage machines above all, are the first defense:
  a lost machine is replaced by admitting a new one (§6), and nothing is restored.
* **Exports.** An owner MAY export a strand to a YAML file: every record of the module, with
  its identifiers, part numbers and audit fields, in a form a person can read. An export is
  for keeping off-site and for moving data between parties. It is not needed to add or move a
  machine.
* **Restore** writes an export into a new, empty strand, and only there: restoring into a
  strand that has any records is refused. It reproduces every record as it was, identifiers,
  part numbers and audit fields included, so a restored strand cannot be told from the
  original by a regular user (Q34). Each write of the restore carries the original author and
  time as its mutation context, which the audit rules already accept.
* *Open:* when writes become signed and the author is checked against the signer
  (architecture.md §9, catalog.qsql header), a restore by another machine can no longer write
  as the original authors. *Default then: a restore is an owner-signed act on an empty strand
  that the audit rules recognize. Not needed until signed writes are enforced.*
* *Open:* speed. A strand write takes about a second today (STATUS.md, the ATI import), so a
  restore of thousands of records takes hours. Restore SHOULD write in large transactions,
  and the cost is a finding to take to Sereus.
