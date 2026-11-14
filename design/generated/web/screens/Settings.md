---
provides: ["screen:Settings"]
mocks: []
dependsOn:
  - design/stories/web/settings-01-this-device.md
  - design/stories/web/settings-03-machines.md
  - design/stories/web/settings-04-owner-keys.md
  - design/stories/web/settings-05-strands.md
  - design/stories/web/settings-06-move-a-machine.md
  - design/stories/web/settings-07-backup.md
  - design/specs/domain/deployment.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
depHashes: {}
---

# Settings: this machine, machines, owner keys, catalogs, backup

Stories settings-01 and -03 to -07 (STATUS.md slices 7 to 11). Reached from "Settings" at
the right of the top bar, and from the catalog name in the top bar (to the Catalogs section).
Every change is a call on the machine's `Installation` (`@wyatt/node`), the same the `wyatt`
command makes, so the two clients stay interchangeable (deployment.md §3).

## Files

| Piece | File |
|---|---|
| Screen at `/settings` | `src/routes/settings/+page.svelte`, `+page.server.ts` (load and form actions) |
| Export download | `src/routes/settings/export/+server.ts` |
| The installation | `src/lib/server/node.ts` → `@wyatt/node` |
| Top bar (catalog name, links) | `src/routes/+layout.svelte`, `+layout.server.ts` |

## Layout

One page, five sections with a short table of contents at the top. Each section starts with a
sentence or two saying what it is for (product stories' rule: explanations within reach).
Refusals are shown in the section that asked, in words.

- **This machine:** name, ID (short, copyable), role (owner or member), started here or joined,
  connected machines ("1 of 2 other machines"), data folder, addresses it can be reached at.
- **Machines:** table of name, ID, connected, last heard from; "Remove…" (owners, not this
  machine) opens an inline confirmation naming the machine, saying its owner key is removed
  separately, with "Remove even if it may hold the only copy". The help says how a move is
  done (settings-06: invite, owner grant, wait for ready, remove). **Invite a machine**
  (owners): for whom, days valid (1–30, default 7); the invitation is shown as text with a
  warning and how to use it (web Join page, or `wyatt init join`), and a note when only this
  machine can admit it. **Invitations waiting** with Withdraw.
- **Owner keys:** table of label, fingerprint, held here; Remove (owners, never the key held
  here or the last one). A notice while there is one key. Owners: **Make a recovery key**
  (a backup owner grant, never expires), **Give owner rights to another machine** (1-day
  grant), **Export this machine's owner key** (passphrase of 8 or more, locked export).
  Members: **Redeem an owner grant**.
- **Catalogs:** table of name, what it is for, company, ready or copying; "Work in this one"
  and Edit (name, purpose, company). Owners: **Found another catalog** (name, purpose, starting
  set), or a note that founding waits until this machine has finished joining. With several
  catalogs and none chosen, the layout sends every page here with a notice.
- **Backup:** Export (downloads `<company>-catalog-<date>.yaml`); Restore: choose a file, see
  what it holds (company, catalog, date, counts), confirm.
- **Memory mode:** one paragraph; no sections.

## Not yet

- Invitations and grants are text only; no QR code (settings-03 step 3).
- Removing a strand is not offered here (the `Installation.removeStrand` call exists).
- Joining or inviting another company's strand (settings-05 steps 5, 6; Q1 default: later).
