---
provides: ["screen:Settings"]
mocks: []
dependsOn:
  - design/stories/web/settings-01-this-device.md
  - design/specs/project.md
  - design/specs/web/navigation.md
  - design/specs/web/screens/index.md
  - design/specs/domain/architecture.md
depHashes: {}
---

# Settings: this device, its strands and its connection

Story settings-01 with its defaults: read-only (no invitations, Q1; no offline switch, Q2;
IDs, not names, Q3). Reached from "Settings" at the right of the top bar.

## Files

| Piece | File |
|---|---|
| Screen at `/settings` | `src/routes/settings/+page.svelte`, `+page.server.ts` |
| What the node reports | `src/lib/server/device.ts` (`deviceReport`) |
| Top-bar link | `src/routes/+layout.svelte` |

## Reads

From the running node (`runningNode()`), never from a catalog model: `peerId`, `isOwner()`,
the data folder, `listMachines()`, `getStrands()` with `getSAppId`, `status`,
`getStrandOfflineMode` and `getUnreachedStrandMachines`, `getControlConnectionCount()`,
`getMultiaddrs()`. Each read is guarded: one that throws is shown as "unknown", and the rest
of the page still renders.

## Layout

Four sections, each a short definition list or table.
- **This device:** ID shortened to its last 12 characters with a Copy button for the whole
  ID; "Owner of the party" or "Member"; data folder.
- **Machines of the party:** table of ID (short), "this device" or trusted / not trusted,
  last heard from (relative time, exact time as tooltip). Empty: "Only this device."
- **Strands:** table of what it is (catalog strand named "Catalog", the one in use marked
  "in use"; others by sApp ID), ID (short, copyable), state, online/offline, and the
  party's machines holding it that are not connected now (count, IDs as tooltip).
- **Connection:** "N of the party's machines connected" and the listen addresses, or "Not
  listening: other machines cannot reach this device yet."
- **Memory mode:** one paragraph, "This app is running on an in-memory catalog (variant X).
  There is no device or strand." No sections.

State words: starting, syncing ("waiting for its first data from another member"), active,
idle, hibernating, stopping, stopped, error.
